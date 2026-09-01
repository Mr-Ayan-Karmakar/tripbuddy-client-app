# TripBuddy

TripBuddy is an Expo Router app built with React Native, React Native Web, and TypeScript. The same codebase targets web, Android, and iOS.

## Requirements

- Node.js 20 or newer
- npm
- Expo CLI via `npx expo`

## Install

```bash
npm install
```

## Run Web

```bash
npm run dev
```

The web app starts on:

```text
http://127.0.0.1:5173/
```

If port `5173` is already in use, stop the existing process or change the port in `package.json`.

## Run Native

```bash
npm run android
npm run ios
```

Native runs require the usual Expo/React Native emulator or device setup.

## Typecheck

```bash
npm run typecheck
```

## Build Web Export

```bash
npm run build
```

This writes the default Expo web export to `dist/`.

For the local static-server workflow used during development, export to:

```bash
npx expo export -p web --output-dir /private/tmp/tripbuddy-wireframes-expo-export
```

## Backend API

The planner page calls the TripBuddy backend through `src/rn/services/api.ts`.

Default API base URL:

```text
http://localhost:8080
```

Currently used endpoints:

- `POST /auth/api/guest`
- `POST /auth/api/otp/send`
- `POST /auth/api/otp/verify`
- `POST /auth/api/register`
- `POST /auth/api/login`
- `POST /auth/api/password-reset/*`
- `POST /itinerary/api/stream`
- `POST /trip/api/trips`
- `PATCH /trip/api/trips/:tripId`
- `GET /trip/api/trips`
- `POST /trip/api/recovery/*`
- `POST /booking/api/transport/book`
- `POST /booking/api/hotel/book`

Make sure the backend/API gateway is running before generating an itinerary.

## Local Data

Generated itineraries are cached locally and synced to Trip Service once an organizer email is available:

- Web: `localStorage`, key `tripbuddy.savedTrips.v1`
- Native: in-memory for the current app session

Server-backed trips receive a public Trip ID such as `TB-7K9P2M` and can be recovered with organizer email plus OTP.

## Project Docs

See [architecture.md](./architecture.md) for the app architecture, page flow, state model, and persistence details.

## Do Not Commit

The repo ignores generated and local-only files such as:

- `node_modules/`
- `.expo/`
- `dist/`
- build/cache/log files
