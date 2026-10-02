# TripBuddy UI Architecture

## Overview

TripBuddy is an Expo Router application built with React Native, React Native Web, and TypeScript. Shared routes, state, services, types, and UI primitives target web, Android, and iOS from one source tree.

The primary product flow is:

1. Start a new trip from the landing page or a featured destination.
2. Enter dates, pace, and preferences in the planner and stream an itinerary from Itinerary Service.
3. Review and customize each day by moving or adding places, editing timing and duration, or compacting a day.
4. Add travelers and book transport and accommodation.
5. Reopen, email, recover, or delete saved trips from My Trips.

## Technology Stack

- Expo 52
- Expo Router 4
- React 18
- React Native and React Native Web
- TypeScript
- `lucide-react-native` icons

Cross-platform React Native components are the default. Browser-only APIs and DOM behavior must remain guarded or isolated so native targets do not evaluate them.

## Project Structure

```text
app/
  _layout.tsx                    Root TripProvider and web head links
  +html.tsx                      Web HTML shell, favicon, manifest, and fonts
  index.tsx                      Landing page
  bookings/
    index.tsx                    Standalone booking-history placeholder
  travel/
    index.tsx                    Public destination directory
    [city]/
      index.tsx                  Public city travel planner
      [duration].tsx             Public duration landing page
  trip/
    create.tsx                   Planner and itinerary generation
    itinerary.tsx                Itinerary details and customization
    booking.tsx                  Travelers, transport, stays, and booking
  trips/
    index.tsx                    Saved trips, email, recovery, and deletion

src/rn/
  chrome.tsx                     Shared header, footer, and account UI
  data.ts                        Default trip and fallback booking data
  react-dom.d.ts                 Minimal React DOM declarations used on web
  services/
    api.ts                       Auth, itinerary, trip, and booking APIs
    browserNotifications.ts      Web notification permission and delivery
    osrm.ts                      Driving-route distance and time lookup
  seo/
    cities.ts                    Typed city and duration helpers
    SeoHead.tsx                  Web route metadata and breadcrumb schema
    site.ts                      Canonical site URL helper
    supportedCities.json         Authoritative 19-city frontend configuration
  state/
    tripStore.tsx                App state, persistence, and server sync
  theme.ts                       Colors, spacing, radii, and shadows
  types.ts                       Shared domain models
  ui.tsx                         Shared React Native UI primitives
  useResponsive.ts               Responsive breakpoint helper

src/imports/                     Logo and other imported assets
public/
  favicon.svg                    Browser favicon
  manifest.webmanifest           Installable web app metadata
  tripbuddy-icon-192.png         App and notification icon
  tripbuddy-icon-512.png         Large install icon
  tripbuddy-notification-sw.js   Notification click service worker
  robots.txt                     Generated crawler rules
  sitemap.xml                    Generated public route sitemap
scripts/
  generate-seo-files.mjs         Sitemap and robots generator
  serve-static.mjs               Clean-URL production preview server
```

## Navigation

Expo Router maps files to routes:

- `/` - landing page
- `/trip/create` - planner
- `/trip/itinerary` - itinerary review and customization
- `/trip/booking` - trip booking
- `/trips` - My Trips
- `/bookings` - standalone bookings placeholder
- `/travel` - public destination directory
- `/travel/:city` - public city travel planner
- `/travel/:city/:duration` - public one- to five-day itinerary landing page

`Header` in `src/rn/chrome.tsx` owns primary navigation and account controls. All pages compose `Screen`, `PageScroll`, shared header/footer chrome, and route-specific content.

## State Model

`TripProvider` in `src/rn/state/tripStore.tsx` is the central client state container. It owns:

- the active `trip`
- the `savedTrips` cache
- the authenticated `account` and current `session`
- planner input handoff between routes
- itinerary updates
- active saved-trip selection and deletion
- traveler, transport, hotel, and booking mutations
- account registration, login, logout, deletion, and password reset
- remote trip refresh and OTP-based trip recovery

Starting a new trip clears the active saved-trip selection and resets the planner state. Generating an itinerary creates a local trip identifier. Subsequent itinerary changes update the active trip snapshot and attempt server synchronization when an organizer email is available.

On provider mount, the app restores local state, resolves the current auth session, and merges server trips into the local list. Backend failures are intentionally non-fatal so locally cached trips remain usable.

## Persistence

Web state is persisted in `window.localStorage`:

- `tripbuddy.auth.v1` stores access and refresh tokens.
- `tripbuddy.savedTrips.v1` stores generated trip snapshots.
- `tripbuddy.activeTrip.v1` stores the selected trip identifier.
- `tripbuddy.itineraryUndo.v1.<trip-key>` stores up to 20 customization snapshots for each trip.

Native targets currently keep these values in memory for the current app session.

Trip Service is canonical for server-backed trips. Server records include a public `tripCode`, and recovery uses the trip code, organizer email, OTP verification, and a short-lived recovery token. Local storage acts as a web cache and fallback rather than a replacement for server persistence.

## Service Layer

### API Client

`src/rn/services/api.ts` centralizes TripBuddy backend requests. Its base URL comes from `EXPO_PUBLIC_API_BASE_URL` and defaults to `http://localhost:8080`.

The client:

- creates guest sessions when no token exists
- stores web tokens in localStorage
- sends bearer authorization headers
- refreshes expired sessions and retries failed authenticated requests once
- parses service error envelopes into user-facing errors
- maps backend DTOs into shared frontend domain types
- parses the itinerary server-sent event stream

Integrated service areas are:

- Auth Service under `/auth/api`
- Itinerary generation and editing under `/itinerary/api`
- Booking availability and confirmation under `/booking/api`
- Trip persistence, linking, email, deletion, and recovery under `/trip/api`

Screens consume typed service functions rather than constructing backend HTTP requests themselves.

### Itinerary Customization

The itinerary route supports moving places within or across days, insertion from remaining place suggestions, duration/start-time changes, day rescheduling, day compaction, and undo/undo-all.

Changes that affect scheduling are validated by Itinerary Service through:

- `/itinerary/api/itinerary-edit/move-place`
- `/itinerary/api/itinerary-edit/add-place`
- `/itinerary/api/itinerary-edit/reschedule-day`
- `/itinerary/api/itinerary-edit/compact-day`
- `/itinerary/api/trip-vibe-cache/remaining-places`

The service response replaces the affected day or days in client state. Undo snapshots are stored locally on web and are scoped to the trip.

### Routing Estimates

`src/rn/services/osrm.ts` requests driving routes from `EXPO_PUBLIC_OSRM_BASE_URL`, defaulting to the public OSRM server. It formats distance and duration, retries HTTP 429 responses with bounded backoff, and supports request cancellation.

Itinerary rendering uses this service when the backend marks a travel leg as requiring client-side routing. These estimates are informational and may vary by route and traffic.

### Browser Notifications

`src/rn/services/browserNotifications.ts` requests notification permission during itinerary generation and shows an itinerary-ready notification after success. On supported browsers it registers `public/tripbuddy-notification-sw.js`; clicking the notification focuses or opens `/trip/itinerary`.

Notification failures are swallowed because they must not interrupt itinerary generation.

## UI System

Shared primitives in `src/rn/ui.tsx` include:

- `Screen` and `PageScroll`
- `Container`, `Stack`, and `Row`
- `Text` and `Heading`
- `Card`, `Button`, and `Input`
- `Chip` and `StatusPill`
- `AppModal`
- `Logo`

Theme constants live in `src/rn/theme.ts`. Route-specific styles remain beside their screens unless a pattern is reused across the application.

## Web-Specific Behavior

Web-only behavior is explicitly guarded or kept within web-capable paths:

- localStorage for auth, trip, active-trip, and undo persistence
- favicon, Apple touch icon, manifest, and hosted font links
- browser notification and service worker APIs
- DOM drag-and-drop, pointer handling, auto-scroll, and portal-based touch previews in itinerary customization
- CSS properties required for web layout and planner controls

The web manifest provides standalone display metadata and install icons. `app/+html.tsx` defines initial document links, while `app/_layout.tsx` ensures favicon and manifest links also exist at runtime.

## SEO Travel Layer

`src/rn/seo/supportedCities.json` is the shared source for the 19 supported destinations. Route validation, static route parameters, the home destination directory, planner location seeds, metadata, and sitemap generation derive from this configuration. Supported durations are defined once in `src/rn/seo/cities.ts`.

The public acquisition routes are lightweight and do not generate itineraries, request routes, ask for notification permission, or hydrate auth/trip data. Their CTAs call `startNewTrip` to pass destination and optional duration into the existing planner.

`SeoHead` uses `expo-router/head` to emit titles, descriptions, canonical links, Open Graph fields, robots directives, and valid `BreadcrumbList` JSON-LD. `EXPO_PUBLIC_SITE_URL` supplies the canonical origin and defaults to `https://thetripbuddy.in`. The user-specific `/trip/itinerary` page is `noindex, follow`.

`scripts/generate-seo-files.mjs` reads the same city JSON and generates `public/sitemap.xml` and `public/robots.txt`. The build script runs this generator before Expo export.

## Build And Deployment

Install and run:

```bash
npm install
npm run dev
```

Validate and export:

```bash
npm run typecheck
npm run build
```

The production web export is written to `dist/`. `app.json` sets `web.output` to `static`, so Expo Router renders separate HTML files for application routes and for every city/duration returned by `generateStaticParams`. The travel layer therefore has crawlable HTML and does not depend on an SPA fallback.

`npm run preview` serves the exported files with directory-index and extensionless HTML resolution, plus the generated not-found page for unsupported paths. The repository has no provider-specific deployment configuration. Hosting credentials and production API, OSRM, and site URLs should be supplied by the deployment environment.

## Generated Files

`.gitignore` excludes dependency folders, Expo state, static exports, native prebuild output, caches, logs, coverage, editor files, and environment files. In particular, do not commit `node_modules/`, `.expo/`, `dist/`, `build/`, `web-build/`, `android/`, or `ios/`.
