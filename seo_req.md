You are working on the TripBuddy frontend.

Before making any change, read completely:

- README.md
- architecture.md
- package.json
- Expo configuration

Treat README.md and architecture.md as the source of truth.

CURRENT ARCHITECTURE

TripBuddy currently uses:

- Expo 52
- Expo Router 4
- React 18
- React Native
- React Native Web
- TypeScript
- one shared source tree for Web, Android and iOS

The app uses Expo Router file-based routing.

Important existing routes:

/
→ landing page

/trip/create
→ planner and itinerary generation

/trip/itinerary
→ itinerary review and customization

/trip/booking
→ travelers, transport, hotel and booking

/trips
→ saved/recovered trips

/bookings
→ booking history placeholder

The existing production web build is:

npm run build

and outputs to:

dist/

IMPORTANT:
The current Expo web export is configured as a SPA-style static export.
The hosting environment must fall back to index.html for application routes.

Do NOT assume that dynamic Expo Router routes automatically generate separate physical HTML files.

Do NOT migrate the application to Next.js.

Do NOT replace Expo Router.

Do NOT introduce a second independent web application.

==================================================
GOAL
==================================================

Improve TripBuddy's Google discoverability by adding public SEO-oriented travel and itinerary landing routes while preserving the existing Expo Router and cross-platform architecture.

TripBuddy currently supports 18 cities.

Its core product flow is:

planner
→ itinerary generation
→ itinerary review/customization
→ booking

The SEO layer should send users into this existing flow rather than duplicate it.


==================================================
1. INSPECT THE CURRENT APPLICATION FIRST
==================================================

Inspect at minimum:

app/_layout.tsx
app/+html.tsx
app/index.tsx
app/trip/create.tsx
app/trip/itinerary.tsx
app/trip/booking.tsx

src/rn/chrome.tsx
src/rn/data.ts
src/rn/services/api.ts
src/rn/services/osrm.ts
src/rn/state/tripStore.tsx
src/rn/theme.ts
src/rn/types.ts
src/rn/ui.tsx
src/rn/useResponsive.ts

package.json

Expo configuration files

Determine:

- where the 18 supported destinations are defined
- how destination/city is represented
- how planner input is passed between routes
- how itinerary generation is triggered
- how trip duration is represented
- whether existing city metadata exists
- how Expo Router 4 handles web route metadata
- whether this Expo 52 setup supports any static rendering/prerendering mechanism compatible with the current SPA build

Do not change code before understanding these areas.


==================================================
2. ADD SEO ROUTES
==================================================

Add public routes such as:

/travel/hyderabad
/travel/hyderabad/1-day-itinerary
/travel/hyderabad/2-day-itinerary
/travel/hyderabad/3-day-itinerary
/travel/hyderabad/4-day-itinerary
/travel/hyderabad/5-day-itinerary

Use Expo Router file-based routing.

Use one dynamic/reusable implementation rather than creating separate source files for every city/duration.

Possible route structure should be investigated, for example:

app/
  travel/
    [city]/
      index.tsx
      [duration].tsx

Choose the structure that best matches Expo Router 4.


==================================================
3. CENTRAL SUPPORTED-CITY CONFIGURATION
==================================================

Reuse the existing destination data if suitable.

If necessary, introduce one centralized configuration:

type SupportedCity = {
  name: string;
  slug: string;
};

All of the following should derive from the same configuration:

- route validation
- city landing pages
- itinerary-duration landing pages
- sitemap
- internal linking
- metadata
- destination navigation

Do not maintain multiple independent city lists.


==================================================
4. CITY LANDING PAGE
==================================================

Example:

/travel/hyderabad

Content should include:

H1:
Hyderabad Travel Planner

Short useful description of TripBuddy's itinerary-planning capability.

Links to:

1 Day Hyderabad Itinerary
2 Day Hyderabad Itinerary
3 Day Hyderabad Itinerary
4 Day Hyderabad Itinerary
5 Day Hyderabad Itinerary

CTA:

Generate Your Personalized Hyderabad Itinerary

The CTA should use the existing planner flow.

Prefer:

/trip/create

with Hyderabad pre-selected through the existing planner-input handoff if the current architecture supports this cleanly.

Do not trigger itinerary generation automatically.


==================================================
5. ITINERARY LANDING PAGE
==================================================

Example:

/travel/hyderabad/3-day-itinerary

Display:

H1:
3 Day Hyderabad Itinerary

Include:

- concise city/duration introduction
- explanation that TripBuddy can generate a personalized itinerary
- links to other Hyderabad durations
- link back to Hyderabad Travel Planner
- CTA to generate the actual personalized itinerary

CTA example:

Generate My Personalized 3-Day Hyderabad Itinerary

The CTA should enter the existing:

/trip/create
→ itinerary generation
→ /trip/itinerary

workflow.


==================================================
6. DO NOT GENERATE SEO ITINERARIES AT BUILD TIME
==================================================

The application currently generates itineraries through:

POST /itinerary/api/stream

Do not call this API during npm build merely to create SEO content.

Do not invent:

- attractions
- timings
- driving distances
- routes
- opening hours
- itinerary contents

If reusable destination information already exists in the repository, use it.

Otherwise keep the SEO page concise and send users to the real itinerary generator.


==================================================
7. PRESERVE ITINERARY CUSTOMIZATION
==================================================

Do not modify or duplicate the existing itinerary customization architecture.

The current itinerary screen supports:

- moving places
- adding places
- changing duration
- changing start time
- rescheduling days
- compacting days
- undo
- undo all

SEO routes are acquisition pages only.

Actual itinerary interaction remains under:

/trip/itinerary


==================================================
8. PRESERVE SERVICE BOUNDARIES
==================================================

Screens should continue using typed functions in:

src/rn/services/

Do not add direct fetch calls from new SEO route components when an existing service abstraction exists.

SEO landing pages should generally not require backend API calls.


==================================================
9. PRESERVE CROSS-PLATFORM ARCHITECTURE
==================================================

React Native components remain the default.

Avoid DOM-only dependencies.

Any browser-only implementation must be:

- guarded with Platform.OS === 'web'
- or isolated to an appropriate web-specific implementation

Native Android/iOS builds must not evaluate unsupported browser APIs.


==================================================
10. METADATA
==================================================

Investigate the correct Expo Router 4 / Expo 52 mechanism for per-route web metadata.

Each SEO route should expose unique web metadata where technically supported:

<title>

meta description

canonical URL

Open Graph title

Open Graph description

Example:

Hyderabad:

Hyderabad Travel Planner & AI Itinerary | TripBuddy

3-day:

3 Day Hyderabad Itinerary & AI Trip Planner | TripBuddy

Do not hardcode localhost.

Introduce/use a production-site environment variable such as:

EXPO_PUBLIC_SITE_URL

if no equivalent already exists.

Example:

EXPO_PUBLIC_SITE_URL=https://thetripbuddy.in


==================================================
11. IMPORTANT: VERIFY STATIC SEO CAPABILITIES
==================================================

The current architecture states that Expo Router is operating as a SPA in the static web export.

Do NOT assume generateStaticParams, static rendering, or prerendering works with the existing build.

First determine exactly what the currently installed versions support.

Before implementing prerendering:

1. inspect package versions
2. inspect Expo configuration
3. determine the current web output mode
4. identify whether Expo Router 4 / Expo 52 supports an official static rendering solution compatible with this project
5. explain any required configuration change

Do not migrate frameworks.

If true static HTML generation is not practical without a significant architecture change:

- keep the Expo Router SEO routes
- implement correct routing, metadata and internal linking
- clearly document the SEO limitation
- recommend the smallest future improvement separately

Do not silently reconfigure the whole application.


==================================================
12. SITEMAP
==================================================

Create a sitemap for:

/
all 18 /travel/<city> URLs

and:

/travel/<city>/1-day-itinerary
/travel/<city>/2-day-itinerary
/travel/<city>/3-day-itinerary
/travel/<city>/4-day-itinerary
/travel/<city>/5-day-itinerary

Generate it from the centralized city configuration.

Do not manually maintain 100+ entries.

Use EXPO_PUBLIC_SITE_URL or the equivalent production-domain configuration.


==================================================
13. ROBOTS.TXT
==================================================

Create/update:

public/robots.txt

Allow indexing of:

/travel/

Include the sitemap URL.

Do not block the application accidentally.


==================================================
14. INTERNAL LINKING
==================================================

All supported destinations must be reachable through crawlable links.

Do not expose cities only through a dropdown.

Add an appropriate destination section to a public page.

Example:

Explore Destinations

Hyderabad
Rishikesh
Jodhpur
Mysuru
...

Use Expo Router Link where appropriate.


==================================================
15. BREADCRUMBS
==================================================

Example:

Home
> Travel
> Hyderabad
> 3 Day Itinerary

Use crawlable navigation links.

If JSON-LD is implemented, keep it web-safe and only add valid BreadcrumbList schema.


==================================================
16. INVALID ROUTES
==================================================

Only the configured 18 cities are valid.

Example:

/travel/not-a-city

should display/not-found appropriately.

Supported SEO itinerary durations initially:

1
2
3
4
5

Reject:

/travel/hyderabad/99-day-itinerary


==================================================
17. USER-SPECIFIC ITINERARY PAGES
==================================================

Do not treat:

/trip/itinerary

as an SEO landing page.

It represents generated/user-specific trip state.

Where technically practical, configure it as:

noindex, follow

on web.

The public /travel/... pages should be the indexable acquisition layer.


==================================================
18. DO NOT BREAK EXISTING FEATURES
==================================================

Existing behavior that must remain working includes:

- itinerary streaming
- itinerary customization
- saved trips
- trip recovery
- authentication
- account state
- transport/hotel booking
- OSRM estimates
- browser notifications
- localStorage persistence
- service worker behavior

Do not modify these unless necessary for the requested SEO implementation.


==================================================
19. PERFORMANCE
==================================================

SEO landing pages should be lightweight.

They should not:

- create guest auth sessions unnecessarily
- start itinerary generation
- call OSRM unnecessarily
- request browser notification permission
- load itinerary customization logic unnecessarily

Lazy-load expensive functionality where appropriate.


==================================================
20. REUSE EXISTING UI
==================================================

Use the existing shared UI system from:

src/rn/ui.tsx
src/rn/theme.ts
src/rn/useResponsive.ts

Reuse existing:

Screen
PageScroll
Container
Stack
Row
Text
Heading
Card
Button
Logo

and existing header/footer components from:

src/rn/chrome.tsx

Do not create a second design system.


==================================================
21. BEFORE IMPLEMENTING
==================================================

First provide a concise implementation plan that explains:

- current relevant architecture
- files to modify
- files to create
- proposed Expo Router route structure
- city configuration strategy
- metadata approach
- sitemap approach
- planner handoff approach
- whether actual prerendered/static HTML is possible with the current Expo setup
- any configuration change required

Then implement.


==================================================
22. VALIDATION
==================================================

Run:

npm run typecheck
npm run build

Verify existing routes:

/
/trip/create
/trip/itinerary
/trip/booking
/trips
/bookings

Verify new routes:

/travel/hyderabad
/travel/hyderabad/3-day-itinerary
/travel/rishikesh/2-day-itinerary

Verify:

- city validation
- duration validation
- metadata
- canonical URLs
- internal linking
- responsive layout
- sitemap.xml
- robots.txt

Inspect dist/ and explain what Expo actually emitted for the SEO routes.


==================================================
23. FINAL REPORT
==================================================

After implementation provide:

1. files created
2. files modified
3. routes added
4. city configuration location
5. how to add a new city
6. how to add another duration
7. sitemap generation approach
8. metadata implementation
9. build results
10. whether routes are true static HTML or SPA routes
11. SEO limitations of the current build
12. recommended next SEO improvement, if needed


MAIN PRINCIPLE

Do not create another TripBuddy frontend.

The new /travel/... layer exists to attract users through search.

Actual trip generation and editing remain:

/trip/create
→ /itinerary/api/stream
→ /trip/itinerary

Preserve the Expo Router + React Native + React Native Web shared architecture.