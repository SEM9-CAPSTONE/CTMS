# CTMS-378 — Host operational overview UI

Implements CTMS-87-T02 using the CTMS-377 read model at
`GET /api/host/monitoring/overview`. The Host landing page presents the five
server KPIs plus Booking, active Trip, owned Route, assigned Porter, unresolved
SOS and weather sections. Existing operational map controls remain available.
No Route/Trip business logic or production backend logic is changed.

## Data and presentation

- The backend owns scope, KPI totals, Booking day/timezone, assignments and risks.
  The client does not infer totals from the current page or calculate weather risk.
- Zod validates the transport response. A malformed response produces an explicit
  error instead of invented zero/empty data.
- Zero is displayed as zero; a null KPI or unavailable source is labeled unavailable.
  Empty sources and empty pages have separate messages.
- Loading, initial failure/retry, background refresh failure, old responses and
  per-route stale/unavailable weather are represented explicitly. Historical
  weather evidence remains labeled historical, with its original timestamps.
- Query keys include authenticated Host, page and limit. Polling runs every 30 seconds;
  successful data has a 15-second cache freshness interval. A response older than
  60 seconds or a failed refresh displays a stale notice. These are presentation
  thresholds; persisted weather freshness remains server authoritative.
- HTTP 401/403 hides cached dashboard data and stops polling. The Host component
  remounts when the signed-in user changes.
- Booking, Porter and Route tabs each retain their own page and show pagination
  inside the inventory card. Requests reuse the authorized overview endpoint and
  Host/page/limit cache keys; only the selected inventory source is rendered from
  that response. Paging a Route list does not page the KPI/Trip/SOS/weather views.
  A separate toolbar pager is shown for Trip/SOS/weather only when needed.
  Full source totals determine page count; they do not change KPI values.
- Trip and owned Route actions open existing supported detail pages. Booking/SOS
  actions open their Trip; no unsupported Host Booking detail is introduced.
  Porter actions open supported assignments/Trip pages. Weather Route navigation
  is offered only when the owned Route projection supplies that Route.

The revised layout uses a compact KPI strip, separate Trip/alert columns and
keyboard-accessible Booking/Porter/Route tabs. Weather evidence expands per row;
lists use normal page scrolling instead of nested scroll containers. Missing
weather Route names are resolved through the existing authorized `getMineById`
client API and cached per Host/Route. A denied or failed label lookup preserves
the authoritative weather risk and displays the route identifier as fallback.
No existing Route/Trip service implementation is modified.
Panels use explicit card/plain variants so Tailwind class collisions cannot add
nested padding. If today's Booking source is successfully empty, the initial
inventory tab selects an available Route or Porter list with records; users can
still switch to the empty Booking tab. Unavailable Booking sources stay visible.

## Validation

The user approved the revised UI before automated validation resumed. Desktop cards have equal widths and equal heights per row; inventory tabs retain independent pages. Mobile cards stack without horizontal overflow.

Run from `apps/web`:

```powershell
node node_modules/vitest/vitest.mjs run src/features/host-overview src/features/role-landing
node node_modules/@playwright/test/cli.js test --config playwright.host-overview.config.ts
node node_modules/@playwright/test/cli.js test --config playwright.mentor-ui.config.ts
```

Task/landing unit and component tests: **14 files, 83 tests passed**.
Task browser tests: **5 passed**, including responsive states, API pagination,
restricted access, retry, and a real UI login against the API/PostgreSQL.
Existing mentor UI browser regression: **5 passed**. API unit regression:
**136 suites, 1,540 tests passed**. Web TypeScript and task Biome checks passed.
The dedicated E2E server requires an isolated database ending in `_test`
(default `ctms_378_test`); it never invokes the destructive development seed.

Run repository checks from the repository root:

```powershell
pnpm lint:all
pnpm build:all
pnpm test:all
```

`lint:all` and `build:all` passed; existing lint/chunk-size warnings remain.
The final `test:all` completed with exit code 1: API passed 136 suites and all 1,540 tests; Web passed 215 files and 1,421 tests, with eight failed tests across four files (219 files, 1,429 tests total). All eight Web failures were reproduced on an unmodified archive of baseline `9e97dc74`: four in `TripDetailPage.test.tsx`, one in `PorterQualificationsPanel.test.tsx`, two in `AppRoutes.booking-details.test.tsx`, and one in `AppRoutes.trips.test.tsx`. These unrelated Route/Trip, authentication-routing and Porter behaviors are outside this change. Do not mark the full regression check as passed.
Required remote CI checks must be assessed after pushing the branch; this document
does not claim that every story DoD check has passed.

## Evidence

CTMS-377 evidence files were removed from source as requested. Test screenshots,
traces and local baseline reports belong in ignored `test-results` directories
and can be attached to the PR. Do not commit evidence folders or generated reports.
