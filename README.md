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
- `POST /itinerary/api/stream`

Make sure the backend/API gateway is running before generating an itinerary.

## Local Data

Generated itineraries are saved locally:

- Web: `localStorage`, key `tripbuddy.savedTrips.v1`
- Native: in-memory for the current app session

## Project Docs

See [architecture.md](./architecture.md) for the app architecture, page flow, state model, and persistence details.

## Do Not Commit

The repo ignores generated and local-only files such as:

- `node_modules/`
- `.expo/`
- `dist/`
- build/cache/log files
