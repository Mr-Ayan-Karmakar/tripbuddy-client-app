Do not build this as a conventional React DOM-only web application.

## Documnets links (Important: Go through all the below docs)
- API gateway: /Users/ayankarmakar/Documents/trip buddy/nginx-conf/nginx/README.md
- Itinery Service: 
1. /Users/ayankarmakar/Documents/trip buddy/itinerary-service/API_ENDPOINTS.md
2. /Users/ayankarmakar/Documents/trip buddy/itinerary-service/ARCHITECTURE.md
3. /Users/ayankarmakar/Documents/trip buddy/itinerary-service/README.md
- Booking Service:
1. /Users/ayankarmakar/Documents/trip buddy/booking-service/API_ENDPOINTS.md
2. /Users/ayankarmakar/Documents/trip buddy/booking-service/README.md
- Auth Service:
1. /Users/ayankarmakar/Documents/trip buddy/auth-service/API_ENDPOINTS.md
2. /Users/ayankarmakar/Documents/trip buddy/auth-service/README.md

## Required technology stack

Use:

* Expo
* React Native
* React Native Web
* TypeScript
* Expo Router

The application must run from the same codebase on:

* Web
* Android
* iOS

Prefer cross-platform React Native components and APIs wherever possible.

Avoid browser-only dependencies unless they are isolated behind a platform-specific abstraction.

Do not use a DOM-centric UI architecture that would require rewriting the application for React Native later.

Use platform-specific files only where the UX or platform APIs genuinely require them.

Example:

```text
TripDatePicker.tsx
TripDatePicker.web.tsx
TripDatePicker.ios.tsx
TripDatePicker.android.tsx
```

Business logic, application state, API access, validation, types and most visual components should remain shared.

---

# 0. Mandatory repository and architecture discovery before implementation

Before designing screens, changing architecture, creating services, defining frontend data models, or writing substantial application code, first inspect the existing repository and read the following project documents in full if they exist:

```text
micro service wise architechture.md
readme.md
api_endpoints.md
```

Also inspect any closely related architecture, API, deployment, authentication, environment, or service documentation referenced by those files.

Treat these documents as the primary source of truth for the existing backend architecture and API contracts.

Do not invent frontend APIs, backend routes, service ownership, request formats, response formats, authentication behavior, or domain boundaries before reviewing these documents.

After reading them, inspect the relevant existing source code to confirm how the documented architecture is actually implemented.

Before implementation, create a concise internal implementation plan covering:

* existing microservices and their responsibilities
* APIs required by each TripBuddy page
* request and response models already defined by the backend
* authentication requirements
* APIs that already exist and should be used directly
* missing APIs or unclear contracts
* places where mock data is temporarily required
* frontend domain models that should map to backend contracts
* any mismatch between the UX requirements and the existing backend architecture

If documentation and implementation disagree, do not silently guess. Prefer the actual implemented contract when it can be verified, and clearly note the discrepancy.

If a required API does not exist, keep the frontend integration behind a service abstraction and provide a mock or adapter implementation without inventing a production endpoint.

Do not modify backend architecture merely to make the frontend easier unless there is a strong reason and the change is explicitly justified.

---

# 0.1 API integration strategy

Map each user-facing feature to the existing backend APIs discovered in `api_endpoints.md`, `micro service wise architechture.md`, `readme.md`, and the source code.

Create a centralized typed API/service layer rather than calling HTTP endpoints directly from screens or visual components.

For example, prefer abstractions such as:

```ts
interface TripService {
  createTrip(input: CreateTripInput): Promise<Trip>;
  getTrip(tripId: string): Promise<Trip>;
  updateTrip(tripId: string, input: UpdateTripInput): Promise<Trip>;
}

interface ItineraryService {
  generateItinerary(input: GenerateItineraryInput): Promise<Itinerary>;
  regenerateDay(input: RegenerateDayInput): Promise<ItineraryDay>;
  replaceActivity(input: ReplaceActivityInput): Promise<ItineraryActivity>;
}

interface BookingService {
  searchTransport(input: TransportSearchInput): Promise<TransportOption[]>;
  searchHotels(input: HotelSearchInput): Promise<HotelOption[]>;
  saveBooking(input: BookingInput): Promise<Booking>;
}
```

The exact interfaces, method names, and DTOs should be derived from the existing API documentation and backend contracts rather than copied literally from these examples.

Keep transport, hotel, itinerary, traveler, authentication, profile, and trip APIs separated according to the actual microservice boundaries.

Use a shared HTTP client layer for concerns such as:

* base URL selection
* authentication headers/tokens
* request serialization
* response parsing
* standardized error handling
* retries where appropriate
* cancellation
* timeouts
* logging/telemetry hooks

Do not duplicate API wiring across pages.

---