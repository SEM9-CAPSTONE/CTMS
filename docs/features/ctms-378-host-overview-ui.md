# CTMS-378 — Host operational overview UI

The Host dashboard uses the authorized CTMS-377 read model at
`GET /api/host/monitoring/overview`. The revised dashboard presents five server
KPIs, active Trips, rescue requests and Booking/Porter/Route inventory tabs.

## Presentation and scope

- The weather panel and duplicate operational monitoring section are removed as
  requested for this UI revision. This is an explicit change from the original
  CTMS-87 weather presentation requirement; the backend weather projection remains.
- Active Trips and rescue requests share equal-width, equal-height desktop cards;
  cards stack on narrow screens. Inventory spans the full row below them.
- Active Trips show the Trip's persisted cover image, title, server status, dates
  and supported detail link. Missing or failed images fall back to an icon.
  The overview SQL adds only `coverImageUrl`; Route/Trip business logic is unchanged.
- Active Trips have independent server pagination with a limit of three. Booking,
  Porter and Route tabs retain their own pages. Rescue requests use their own
  toolbar pager. Paging one source does not change the other sources' pages or
  recompute KPI totals.
- The SOS title is “Yêu cầu cứu trợ”; the helper explains that the count includes
  requests awaiting acknowledgement or receiving assistance. A genuine empty
  source is explicitly empty, while an unavailable source remains unavailable.

## Refresh and data integrity

- Polling runs every 30 seconds while the dashboard is active, with a 15-second
  cache freshness interval. Returning to the tab or reconnecting triggers a new
  request. Hidden-tab polling remains paused.
- Background refresh keeps existing data visible without repeated warning banners.
  Responses older than 60 seconds or failed refreshes have a compact “Chưa cập nhật”
  indicator; per-source load timestamps remain visible. The timestamp/timezone
  subtitle below “Hoạt động & cảnh báo” is removed.
- HTTP 401/403 hides cached dashboard values and stops polling. Query keys include
  Host identity, page and limit. The Host component remounts when the user changes.
- The backend owns scope, totals, Booking day/timezone and assignments. Zod validates
  responses; the UI does not invent zeroes, infer Trip lifecycle from dates or
  recalculate Route/Trip rules. Existing supported detail pages handle navigation.

## Validation

Current UI revision (2026-11-02):

- Host overview and role landing unit/component tests: **14 files, 81 passed**.
- Host overview backend unit tests: **10 passed**.
- Browser tests: **6 passed**, including independent three-Trip pagination, aligned desktop
  cards, narrow-screen empty/error states, silent polling, restricted access and
  real UI login against API/PostgreSQL.
- `pnpm lint:all`: passed with 11 existing warnings and zero errors.
- `pnpm build:all`: passed; Vite reports the existing large-chunk warning.
- Web TypeScript and task Biome checks passed.
- Full `test:all` regression and remote CI are not claimed as passed by this revision.

Commands:

```powershell
# apps/web
node node_modules/vitest/vitest.mjs run src/features/host-overview src/features/role-landing
node node_modules/@playwright/test/cli.js test --config playwright.host-overview.config.ts

# services/api
node node_modules/jest/bin/jest.js --runInBand host-overview.service.spec

# repository root
pnpm lint:all
pnpm build:all
```

The dedicated E2E server requires an isolated database ending in `_test`
(default `ctms_378_test`). Tests create and clean up their own records;
this workflow never invokes the destructive development seed.

## Evidence

Test screenshots, traces and reports belong in ignored `test-results` directories
and can be attached to the PR. Do not commit generated evidence folders.
PR evidence should list the actual commands, results and limitations inline.
