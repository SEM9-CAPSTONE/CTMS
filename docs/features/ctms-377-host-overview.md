# CTMS-377 / CTMS-087-T01 — Host operational overview

Read-only implementation of BR-270. `GET /api/host/monitoring/overview?page=1&limit=20`
requires an active account with the Host role. JWT verification re-reads account/roles;
all source queries derive `host_id` from the authenticated actor. No client-supplied
Host/Trip scope is accepted. Responses are private/no-store. No migrations, seed,
new persistence, external weather calls or source-record mutations are involved.

## Source and KPI definitions

These definitions make the currently unspecified date basis and aggregation semantics
explicit for this implementation; they do not add financial KPIs or safety detection rules.

| Section / KPI | Existing source and meaning |
| --- | --- |
| `bookings` / `todaysBookings` | Bookings created during the configured local calendar day, joined through owned Trips. All stored Booking states are included and returned; this is a Booking count, not seats, payment count, confirmed participants or departures today. |
| `activeTrips` | Owned Trips whose stored lifecycle status is `ongoing`. Time passing does not independently change a Trip's state. |
| `routes` | All Routes owned through `trekking_routes.host_id`, with actual stored status. |
| `porters` / `assignedPorters` | Distinct Porter IDs in current `trip_porters` records with `assigned` or `pending_reconfirmation`, on owned published/ongoing Trips. Multiple Trip assignments count once. Returned assignment states distinguish pending reconfirmation from confirmed assignment. Unassigned records and completed/cancelled Trips are excluded. This is schedule context, not available-Porter eligibility or the size of the global Porter pool. |
| `sos` / `unresolvedSos` | `active` and `acknowledged` persisted SOS on any owned Trip. Closed/cancelled SOS are excluded. An unresolved historical SOS remains visible until its authoritative lifecycle changes. |
| `weather` | One latest persisted assessment per distinct Route used by owned published/ongoing Trips, with snapshot/rule context. A shared Route is counted once. No risk is fabricated or recalculated. |

The current implemented assignment source is `trip_porters`, also used by
`TripsRepository.findPorterAssignmentHistoryByHost`. The future `porter_assignments`
design is not implemented here. Route/package versions are not invented: weather remains
the current route-scoped assessment projection, not proof of immutable Trip package validity.

## Availability and freshness contract

- Every section has `source`, `queriedAt`, `availability` and nullable `data`.
- Successful reads return `{ total, items }`; a genuine empty result has zero total.
  Query failure returns `availability=unavailable`, `data=null` and a null related KPI.
  Other sources remain usable. Internal SQL/error details are not exposed or logged.
- `generatedAt` is the request's reference time. Sources are independent statement
  snapshots, not one cross-domain transaction. Each count and page share a statement
  snapshot. `queriedAt` is read completion time, not the domain's last change time.
- Source timestamps are preserved: Trip/Route update, Booking creation, SOS original
  event/receipt/update and weather assessment/observation/fetch. An old unresolved SOS
  is still unresolved; its age is not used to auto-close or hide it.
- Weather row `state`: `unavailable` when no assessment/successful corresponding snapshot
  or observation time exists; `stale` for an inactive/missing rule, future observation/fetch/
  assessment time, observation/fetch older than configured max age, or any newer fetch
  attempt not represented by the assessment (including failure). Otherwise `available`.
  Retained risk and criterion scores are historical source values; consumers must use
  `state` and timestamps, never display stale risk as current safety assurance.
- `weather.availability=available` means the database projection was read, even if some
  individual Route rows have stale/unavailable weather. Missing risk stays null.
- Each section independently uses the same page/limit (default 1/20, max 100,
  maximum page 1,000,000). Totals/KPIs cover the full matching source, including when
  the requested page is empty. Ordering is deterministic by timestamp and ID.

## Configuration

`HOST_OVERVIEW_TIME_ZONE` defaults to `Asia/Ho_Chi_Minh`. The local day's lower bound
is inclusive and upper bound exclusive, converted to timestamptz by PostgreSQL;
the database/host OS timezone does not define the Booking day.

`HOST_OVERVIEW_WEATHER_MAX_AGE_SECONDS` defaults to 3600. This is a dashboard display
freshness policy chosen for this read model, not a new Weather Risk/Booking hard rule.
It does not affect calculation, booking eligibility or SOS state. Invalid timezone
or nonpositive/nonfinite age configuration fails startup.

The TypeScript contract is `host-overview.types.ts`; Swagger publishes the response
schema from `host-overview.schema.ts`.

## Validation and limits

Test screenshots are attached/referenced in PR #788. Evidence artifacts are not
maintained in the source tree; local generated reports belong in ignored test-results.

Verified on this branch: 136 API unit suites / 1,540 tests passed; after final module
wiring/schema changes, focused overview/sync-evaluation unit coverage passed again
(17 tests). Full-AppModule task integration passed (8 PostgreSQL/HTTP tests), including
source-record immutability. API TypeScript, Nest build, changed-source ESLint/Biome,
branch validation and Git whitespace checks passed. No Web UI or browser E2E is included
in this Preparation + Logic task.

- Unit coverage: Host/active-account denial before reads, local-day reference,
  empty versus unavailable sources, full totals despite pagination, configuration.
- Real PostgreSQL + HTTP integration: real JWT/database roles, suspended account,
  cross-Host exclusion for every source, distinct Porter/shared Route counting,
  unresolved SOS states, local-day boundaries, bounded pagination/scope rejection,
  missing/stale weather and partial source failure.
- Integration uses `ctms_377_test` and the repository's `_test` database guard.
  It boots the full AppModule with no business-response mocks;
  one test injects a source exception explicitly to exercise partial failure handling.
- Full AppModule startup initially exposed existing missing exports needed by
  SyncEvaluationService. GpsTrackingModule now exports GpsTrackingService/GpsLogRepository,
  and SafetyEventsModule exports SafetyEventsService/SafetyEventRepository. This fixes
  module wiring only; their business logic is unchanged.

Run task integration from `services/api`:

```powershell
$env:TEST_DATABASE_URL='postgresql://ctms:ctms@127.0.0.1:5432/ctms_377_test'
node node_modules/jest/bin/jest.js --config test/jest-integration.json --runInBand --runTestsByPath test/host-overview.integration-spec.ts
```
