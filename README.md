# TripBuddy

TripBuddy is a cross-platform travel-planning application built with Expo Router, React Native, React Native Web, and TypeScript. The same source tree targets web, Android, and iOS.

The app supports itinerary generation and customization, trip persistence and recovery, traveler management, transport and hotel booking, account authentication, and browser notifications when an itinerary is ready.

## Requirements

- Node.js 20 or newer
- npm
- Expo CLI through `npx expo`
- TripBuddy API gateway and backend services for API-backed features

## Install

```bash
npm install
```

## Run

Start web development on port `5173`:

```bash
npm run dev
```

Run a native target with the usual Expo emulator or device setup:

```bash
npm run android
npm run ios
```

## Validate And Build

```bash
npm run typecheck
npm run build
```

`npm run build` first regenerates `public/sitemap.xml` and `public/robots.txt`, then creates a statically rendered web export in `dist/`. Expo emits an HTML document for each application route and each configured travel page.

Preview the production export with clean, extensionless route handling:

```bash
npm run preview
```

The preview defaults to `http://127.0.0.1:7010`. Override it when needed, for example: `PORT=7011 npm run preview`.

This checkout does not currently include a provider-specific deployment configuration.

## Environment

The client recognizes these public Expo environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | `http://localhost:8080` | TripBuddy API gateway base URL |
| `EXPO_PUBLIC_OSRM_BASE_URL` | `https://router.project-osrm.org` | OSRM routing service used for driving distance and time |
| `EXPO_PUBLIC_SITE_URL` | `https://thetripbuddy.in` | Canonical origin used by metadata, the sitemap, and robots.txt |

Create a local `.env` when overriding these values. Environment files are ignored by Git.

## Application Routes

- `/` - landing page and popular destinations
- `/trip/create` - trip planner and itinerary generation
- `/trip/itinerary` - itinerary review and customization
- `/trip/booking` - travelers, transport, stays, and trip booking
- `/trips` - saved and recovered trips
- `/bookings` - standalone booking-history placeholder
- `/travel` - supported destination directory
- `/travel/:city` - public city travel planner
- `/travel/:city/:days-day-itinerary` - public one- to five-day itinerary landing page

## Search Discovery

The public travel layer is statically rendered for the 19 destinations in `src/rn/seo/supportedCities.json`. Each city has a planner page and one- through five-day landing pages. These pages contain per-route metadata, canonical URLs, Open Graph fields, breadcrumb schema, internal links, and a CTA into the existing planner.

The generated, user-specific `/trip/itinerary` route is marked `noindex, follow`. Itinerary content is never requested from the backend during the build.

Run the crawl-file generator independently with:

```bash
npm run seo:generate
```

To add a destination, add one entry to `src/rn/seo/supportedCities.json`; routes, static parameters, internal links, planner locations, and sitemap entries derive from that file.

## Backend Integration

Most backend access is centralized in `src/rn/services/api.ts`. The API client creates or refreshes bearer-token sessions and retries a request once when an access token has expired.

Integrated API groups include:

- Auth: guest session, refresh, current account, OTP, registration, login, logout, account deletion, and password reset under `/auth/api`
- Itinerary: streaming generation at `/itinerary/api/stream`
- Customization: move, add, reschedule, and compact operations under `/itinerary/api/itinerary-edit`
- Place suggestions: `/itinerary/api/trip-vibe-cache/remaining-places`
- Booking: transport/hotel availability and booking under `/booking/api`
- Trips: create, update, list, delete, email, booking links, deletion OTP, and recovery under `/trip/api`

API-backed workflows require the gateway at `EXPO_PUBLIC_API_BASE_URL` to be reachable and configured for the web app's origin.

## Local Persistence

On web, the app uses `localStorage` for:

- `tripbuddy.auth.v1` - authentication tokens
- `tripbuddy.savedTrips.v1` - cached generated trips
- `tripbuddy.activeTrip.v1` - currently selected trip
- `tripbuddy.itineraryUndo.v1.<trip-key>` - up to 20 itinerary customization snapshots per trip

Native currently retains this client state in memory for the app session. Trip Service remains the canonical store for server-backed trips, while local saved trips provide a web cache and offline fallback.

## Browser Features

Web builds include:

- a web app manifest and install icons
- a service worker used for itinerary-ready notification clicks
- an SVG favicon
- optional browser notifications after itinerary generation

Browser notification permission is requested from the planner flow. Notifications are optional and do not block itinerary generation.

## Project Documentation

See [architecture.md](./architecture.md) for the route structure, state model, service boundaries, persistence, and platform-specific behavior.

## Generated Files

Do not commit generated or machine-local content. `.gitignore` excludes `node_modules/`, `.expo/`, `dist/`, `build/`, native prebuild folders, caches, logs, coverage, editor state, and environment files.
