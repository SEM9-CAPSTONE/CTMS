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
- A shared page control follows the endpoint's page/limit contract. Full source
  totals determine page count; they do not change the KPI values.
- Trip and owned Route actions open existing supported detail pages. Booking/SOS
  actions open their Trip; no unsupported Host Booking detail is introduced.
  Porter actions open supported assignments/Trip pages. Weather Route navigation
  is offered only when the owned Route projection supplies that Route.

## Validation

Run from `apps/web`:

```powershell
node node_modules/vitest/vitest.mjs run src/features/host-overview src/features/role-landing
node node_modules/@playwright/test/cli.js test --config playwright.host-overview.config.ts
node node_modules/@playwright/test/cli.js test --config playwright.mentor-ui.config.ts
```

Task/landing unit and component tests: **14 files, 77 tests passed**.
Task browser tests: **4 passed**, including responsive states, API pagination,
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
`test:all` completed with exit code 1: API passed all 1,540 tests; Web passed
1,418 tests and failed five (217 passing files, two failing files). The five
Web regression failures already exist on the baseline: four in
`TripDetailPage.test.tsx` (cancelled Booking/navigation-result reconciliation)
and one in `PorterQualificationsPanel.test.tsx` (verified-edit warning).
All five were reproduced on an unmodified archive of baseline `9e97dc74`.
These unrelated Route/Trip and Porter behaviors are outside this change.
Required remote CI checks must be assessed after pushing the branch; this document
does not claim that every story DoD check has passed.

## Evidence

CTMS-377 evidence files were removed from source as requested. Test screenshots,
traces and local baseline reports belong in ignored `test-results` directories
and can be attached to the PR. Do not commit evidence folders or generated reports.
