# TripBuddy UI Architecture

## Overview

TripBuddy is an Expo Router application built with React Native, React Native Web, and TypeScript. The same source tree targets web, Android, and iOS. Web is exported with Expo and currently served locally from a static export directory.

The app models a travel planning flow:

1. Landing page: collect origin/destination and promote popular destinations.
2. Planner page: collect trip details and call the itinerary service.
3. Itinerary page: display the generated itinerary and nearby restaurants/reviews.
4. Booking page: manage travelers, transport, stays, and booking status.
5. My Trips page: list locally saved generated itineraries and allow users to review, book, or delete them.

## Technology Stack

- Expo
- Expo Router
- React Native
- React Native Web
- TypeScript
- `lucide-react-native` for icons

Avoid DOM-only dependencies unless they are isolated behind a platform guard. Shared business logic, app state, API access, and visual components should remain cross-platform.

## Project Structure

```text
app/
  _layout.tsx              Root provider and navigation layout
  +html.tsx                Web HTML shell metadata/fonts
  index.tsx                Landing page
  trip/
    create.tsx             Planner page
    itinerary.tsx          Generated itinerary page
    booking.tsx            Booking page
  trips/
    index.tsx              Saved local itineraries list

src/rn/
  chrome.tsx               Shared header/footer
  data.ts                  Default data and seed options
  services/
    api.ts                 Backend API integration layer
  state/
    tripStore.tsx          Trip state, saved trips, persistence
  theme.ts                 Shared colors/spacing/radius/shadows
  types.ts                 Domain types
  ui.tsx                   Shared React Native UI primitives
  useResponsive.ts         Responsive breakpoint helper

src/imports/               SVG/logo assets
public/
  favicon.svg              Static web favicon
```

## Navigation

Routing is file-based through Expo Router:

- `/` -> landing
- `/trip/create` -> planner
- `/trip/itinerary` -> itinerary review
- `/trip/booking` -> transport/accommodation booking
- `/trips` -> saved local itineraries

The shared `Header` in `src/rn/chrome.tsx` owns the primary navigation. The `My Trips` nav item is active only on `/trips`, not while viewing an itinerary.

## State Model

`TripProvider` in `src/rn/state/tripStore.tsx` is the central client state container.

It exposes:

- `trip`: the currently selected/editable trip.
- `savedTrips`: generated itineraries stored locally.
- planner input handoff from landing to planner.
- itinerary generation draft updates.
- saved trip selection/deletion.
- traveler, transport, hotel, and booking mutations.

When a generated itinerary is created, the store assigns a local saved-trip id and saves the full trip snapshot. Updates to the selected trip are synchronized back to that saved trip while the current trip has itinerary content.

## Persistence

Saved itineraries are local-only:

- Web: persisted in `window.localStorage` using key `tripbuddy.savedTrips.v1`.
- Native: retained in provider memory for the current app session.

This is intentionally separated from backend persistence. If server-side trips are added later, keep the local saved trip adapter behind the store/service boundary and introduce a typed trip service instead of calling endpoints from pages directly.

## API Integration

Backend access is centralized in `src/rn/services/api.ts`.

Current integration:

- Guest auth: `POST /auth/api/guest`
- Itinerary streaming: `POST /itinerary/api/stream`

The planner page calls `generateItinerary`, which handles auth, streaming response parsing, and mapping backend itinerary data into the shared `DayPlan` domain model.

Screens should not call HTTP APIs directly. Add future transport, hotel, traveler, or booking calls as typed service functions in `src/rn/services/`.

## UI System

Shared UI primitives live in `src/rn/ui.tsx`:

- `Screen`
- `Container`
- `Stack`
- `Row`
- `Text`
- `Heading`
- `Card`
- `Button`
- `Input`
- `Chip`
- `StatusPill`
- `AppModal`
- `Logo`

Theme constants live in `src/rn/theme.ts`. Page-specific styles stay with each route file unless reused across pages.

## Web-Specific Behavior

The app still uses React Native components as the primary UI layer. Web-only behavior is isolated:

- favicon injection is guarded by `Platform.OS === 'web'`.
- localStorage persistence is guarded by `Platform.OS === 'web'`.
- planner calendar CSS fixes are scoped to the planner page.

## Build And Run

Install dependencies:

```bash
npm install
```

Run local web development:

```bash
npm run dev
```

Typecheck:

```bash
npm run typecheck
```

Export web:

```bash
npx expo export -p web --output-dir /private/tmp/tripbuddy-wireframes-expo-export
```

## Generated Files

Do not commit dependency folders, local Expo state, or exported web bundles. These are ignored by `.gitignore`:

- `node_modules/`
- `.expo/`
- `dist/`
- `build/`
- `web-build/`
- cache/log/environment files
