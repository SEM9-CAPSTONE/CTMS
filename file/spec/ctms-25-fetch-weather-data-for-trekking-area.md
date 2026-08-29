# CTMS-25 - Fetch Weather Data for Trekking Area

**Spec Reference**  
/file/spec/ctms-25-fetch-weather-data-for-trekking-area.md

**Story Title**  
Fetch Weather Data for Trekking Area

**Status**  
To Do

**Story**  
As the system, I want to fetch Weather Data for Trekking Area so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [ ] Rain, wind, temperature, visibility, thunderstorm data, and timestamp are stored.
- [ ] API timeout or missing data is handled.

## Business Rules Checklist
- [ ] BR-064: Weather Risk must be displayed when an assessment is available.
- [ ] BR-065: The system must store rainfall, wind, temperature, visibility, thunderstorm data, and timestamp.
- [ ] BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.
- [ ] BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.
- [ ] BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.
- [ ] BR-228: Users may disable ordinary notifications, but mandatory safety or emergency alerts cannot be disabled while participating in the related Trip.
- [ ] BR-229: When an external service times out or returns incomplete data, the system must record the error, must not assume success, and must not create unverifiable data.
- [ ] BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.
- [ ] BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data.
- [ ] BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.
- [ ] BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.
- [ ] BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.

## Dev Notes
- Jira status on 2026-08-04: `To Do`.
- Priority: `Must Have`; Story points: `5`; Commitment: `Committed`.
- Epic: `EPIC 4. Weather Risk`.
- Sprint: `Sprint 2`; planned window: `2026-08-09` to `2026-08-22`.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks
- CTMS-25-T01 [BE / Shared Logic] Implement `Fetch Weather Data for Trekking Area` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-228, BR-229, BR-064, BR-065, BR-206, BR-207. Ref: /file/spec/ctms-25-fetch-weather-data-for-trekking-area.md#backend-preparation-logic-and-tests
- CTMS-25-T02 [UI Web/Mobile/Consumer] Implement `Fetch Weather Data for Trekking Area` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-240, BR-241, BR-242, BR-064, BR-065. Ref: /file/spec/ctms-25-fetch-weather-data-for-trekking-area.md#ui-and-tests

## Task to Acceptance Criteria Traceability
| Acceptance criterion / BR | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: Rain, wind, temperature, visibility, thunderstorm data, and timestamp are stored | CTMS-25-T01, CTMS-25-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC2: API timeout or missing data is handled | CTMS-25-T01, CTMS-25-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. | CTMS-25-T01, CTMS-25-T02 | Tests and review evidence must prove this exact rule is enforced: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. |
| BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data. | CTMS-25-T01, CTMS-25-T02 | Tests and review evidence must prove this exact rule is enforced: Users may only view or change data they own unless their role and business relationship allow access to another user's data. |
| BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. | CTMS-25-T01, CTMS-25-T02 | Tests and review evidence must prove this exact rule is enforced: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. |
| BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. | CTMS-25-T01, CTMS-25-T02 | Tests and review evidence must prove this exact rule is enforced: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. |
| BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. | CTMS-25-T01, CTMS-25-T02 | Tests and review evidence must prove this exact rule is enforced: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. | CTMS-25-T01, CTMS-25-T02 | Tests and review evidence must prove this exact rule is enforced: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. |
| BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect. | CTMS-25-T01 | Tests and review evidence must prove this exact rule is enforced: Cases with insufficient permission or unmet business conditions must not create any side effect. |
| BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. | CTMS-25-T01 | Tests and review evidence must prove this exact rule is enforced: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. |
| BR-228: Users may disable ordinary notifications, but mandatory safety or emergency alerts cannot be disabled while participating in the related Trip. | CTMS-25-T01 | Tests and review evidence must prove this exact rule is enforced: Users may disable ordinary notifications, but mandatory safety or emergency alerts cannot be disabled while participating in the related Trip. |
| BR-229: When an external service times out or returns incomplete data, the system must record the error, must not assume success, and must not create unverifiable data. | CTMS-25-T01 | Tests and review evidence must prove this exact rule is enforced: When an external service times out or returns incomplete data, the system must record the error, must not assume success, and must not create unverifiable data. |
| BR-064: Weather Risk must be displayed when an assessment is available. | CTMS-25-T01, CTMS-25-T02 | Tests and review evidence must prove this exact rule is enforced: Weather Risk must be displayed when an assessment is available. |
| BR-065: The system must store rainfall, wind, temperature, visibility, thunderstorm data, and timestamp. | CTMS-25-T01, CTMS-25-T02 | Tests and review evidence must prove this exact rule is enforced: The system must store rainfall, wind, temperature, visibility, thunderstorm data, and timestamp. |

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped BR missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements
- Implement the `Fetch Weather Data for Trekking Area` workflow exactly within `EPIC 4. Weather Risk`.
- Enforce role-based access before executing any domain action.
- Validate all required fields, enum values, date ranges, ownership boundaries, and cross-entity references before writing data.
- Return consistent API errors: 401 for authentication failures, 403 for authorization failures, 404 for missing resources, 409 for business conflicts, and 422 for invalid input.

## Data and Persistence Requirements
- Persist only validated data and keep all foreign-key relationships scoped to existing, authorized CTMS records.
- Use transactions for multi-record updates, capacity checks, payments, booking changes, equipment changes, synchronization, or any workflow with side effects.
- Store timestamps in a consistent server-side format and preserve source timestamps when client-side events are synchronized later.
- Avoid hard deletes unless the related database model and business rule explicitly allow them.

## State and Audit Requirements
- Validate the current state before every transition and reject transitions that are not explicitly allowed.
- Record important create, update, approval, cancellation, payment, synchronization, administrative, and safety-related actions in audit logs.
- Capture actor, target type, target id, before value, after value, timestamp, and reason whenever those fields apply.
- Notify affected users when the workflow changes booking, trip, route, campsite, Porter, SOS, emergency, or administrative state.

## File Structure Notes
- Backend: place controllers, DTOs, services, repositories, guards, and tests in the module that owns the domain entity.
- Frontend: place screens, components, hooks, API clients, schemas, and tests in the feature folder that owns the workflow.
- Shared constants, enums, query keys, and validation schemas should be centralized only when reused by more than one feature.
- Keep migration, seed, and fixture changes close to the persistence model they support.

## Implementation Guidance for the Dev Agent
- Start by reading the existing module patterns before adding new files or abstractions.
- Keep the implementation narrow to this story and reuse existing CTMS helpers for auth, validation, transactions, i18n, API errors, and tests.
- Build backend behavior first when the UI depends on an API contract, then wire the frontend to the typed contract.
- Do not mark the story Done until mapped ACs, business rules, audit behavior, and regression tests are all covered.

## Testing Requirements
- Add unit tests for domain validation, permission checks, state transitions, and mapped business rule violations.
- Add API or integration tests for success, invalid input, unauthorized access, missing resource, conflict, and rollback cases.
- Add UI/component tests for rendering, validation messages, disabled states, loading states, error handling, and successful submission where UI exists.
- Add E2E coverage for the primary user journey and at least one critical failure path.
- Every BR listed in the Business Rules Checklist must appear in at least one test or review evidence item.

## Backend Preparation Logic and Tests

### Actors
- **Host**: the owner of the Route's Campsite. Can trigger a refresh and view the latest snapshot only for a Route they own.
- **Admin**: can trigger a refresh and view the latest snapshot for any Route, bypassing ownership.
- **System**: no scheduled/cron trigger exists yet in this task's scope -- every fetch is initiated by a Host or Admin action, matching "Implementation Guidance": keep the implementation narrow to this story.

### Preconditions
- The Route (`CTMS-19`) must already exist and be in `active` status.
- The actor must hold a valid session and the `host` or `admin` role (`RolesGuard`); a Host must additionally own the Route's Campsite.

### Decision Gates (frozen)
- **Geographic granularity**: one snapshot per **Route**, not per Checkpoint -- fetched for the centroid of `route_geom` (`ST_Centroid`). CTMS-93's own Unit Test Checklist item ("Provider data is normalized for **the route area**") reads as route-level, not checkpoint-level, and a route can have many checkpoints but only one weather assessment makes sense for "the area."
- **Provider**: Open-Meteo (`https://api.open-meteo.com`) -- no API key/account required (this codebase has no existing weather-provider secret anywhere in `.env`), free tier with no enforced request quota, and its `current` block carries every BR-065 field (rain, wind, temperature, visibility) plus a WMO weather code standard enough to derive `thunderstorm` from without inventing a threshold (WMO codes 95/96/99 are the standard's own thunderstorm family).
- **Trigger**: on-demand only, via `POST .../weather/refresh`. No scheduler/cron in this task -- out of scope for "preparation + logic," and nothing in the story or Jira checklist calls for one.
- **Storage**: append-only. Every fetch attempt (success or failure) inserts a new `weather_snapshots` row; existing rows are never updated, so a later consumer (`CTMS-26`) can look up exactly which snapshot it used (the "reproducible" requirement carried by AC2 of the parent CTMS-26 story).
- **Retry/backoff (BR-230)**: 3 attempts, in-memory, exponential backoff (500ms / 1000ms / 2000ms). Only the final outcome (one success or one recorded failure) is ever written -- a retry can never itself create a duplicate row.
- **On total failure (BR-229)**: a `FAILED` snapshot row is inserted recording the error; every weather/provider column stays `NULL` -- no fabricated reading is ever stored. The API responds `503 Service Unavailable`.
- **BR-228 is not applicable to this task's scope**: this fetch-and-store endpoint sends no notifications of any kind; BR-228 (mandatory safety alerts cannot be disabled) belongs to a later story that actually surfaces/alerts on Weather Risk (`CTMS-27`/`CTMS-29`), not this one.

### Main Flow (Refresh)
1. Host or Admin calls `POST /trekking-routes/:routeId/weather/refresh`.
2. The Route is looked up with its Campsite's `host_id` and the centroid of `route_geom`.
3. Ownership is checked (Admin bypasses; a Host must own the Campsite).
4. The Route's `status` must be `active`, checked before any provider call or DB write (BR-243).
5. Open-Meteo is called for the centroid's `[latitude, longitude]`, retried up to 3 times on failure.
6. A `SUCCESS` snapshot row is inserted and returned (`201`).

### Alternate Flow (Read latest)
- `GET /trekking-routes/:routeId/weather/latest` returns the most recently stored snapshot for the Route (`200`, empty body if none has ever been recorded), under the same ownership/role checks as refresh, without calling the provider.

### Exception Flows
- Route not found -> `404`.
- Not the owning Host and not an Admin -> `403`.
- Not authenticated -> `401`.
- Route not `active` -> `409`, no provider call, no DB write.
- Provider fails after 3 attempts -> a `FAILED` row is persisted, response is `503`.

### API Contract
| Method | Path | Roles | Success | Errors |
| --- | --- | --- | --- | --- |
| `POST` | `/trekking-routes/:routeId/weather/refresh` | Host (owner), Admin | `201 WeatherSnapshotResponseDto` | `401, 403, 404, 409, 503` |
| `GET` | `/trekking-routes/:routeId/weather/latest` | Host (owner), Admin | `200 WeatherSnapshotResponseDto \| null` | `401, 403, 404` |

`WeatherSnapshotResponseDto`: `id, routeId, status ('success'|'failed'), observedAt, rainfallMm, windKph, temperatureC, visibilityM, thunderstorm, errorMessage, createdAt`. `providerResponse` (raw) and `providerWeatherCode` are stored but intentionally not exposed in the API response -- internal fields kept for audit/debugging and future rule-tuning (`CTMS-26`/`CTMS-30`).

### Data Mapping
- New table `weather_snapshots`: `route_id` (FK -> `trekking_routes`, `ON DELETE CASCADE`), `status` (`success`/`failed`), `observed_at`, `rainfall_mm`, `wind_kph`, `temperature_c`, `visibility_m`, `thunderstorm`, `provider_weather_code`, `provider_response` (jsonb), `error_message`, `created_at`. A `CHECK` constraint enforces the success/failed shape at the database level (a `failed` row must have `error_message`; a `success` row must have `observed_at` and no `error_message`).
- Index on `(route_id, created_at)` for "latest snapshot per route" lookups.

### Test Evidence
- Unit: `pnpm --filter @ctms/api test -- weather` -> 24 passed (`open-meteo-weather.provider.spec.ts`, `weather-snapshots.repository.spec.ts`, `weather.service.spec.ts`), covering provider response parsing (including all 3 WMO thunderstorm codes), provider error/timeout/malformed-response handling, ownership/Admin-bypass, the active-route gate with zero side effects (BR-243), retry-then-succeed, and give-up-after-3-attempts persisting exactly one `FAILED` row (BR-229/BR-230).
- All backend unit tests: `pnpm --filter @ctms/api test` -> 315 passed.
- API/E2E (real PostGIS + a **real** call to the live Open-Meteo API, no mocking): `pnpm --filter @ctms/api test:integration -- weather.integration-spec.ts` -> 8 passed -- real happy path (fetch, persist, `getLatest` returns the same row), 404, 403 (non-owning Host), Admin bypass, 409 with zero rows written for a non-active route, 401, 403 for a Camper, and an empty `getLatest` before any snapshot exists.
- All backend integration tests: `pnpm --filter @ctms/api test:integration` -> 185 passed.
- Backend lint: `pnpm --filter @ctms/api lint` -> passed. Backend build: `pnpm --filter @ctms/api build` -> passed.

## UI and Tests

### Web UI Implementation

- **Web only.** Mobile has no counterpart: this endpoint is Host/Admin-only, and the mobile app's own router carries an explicit comment that Host/Admin manage CTMS from the web dashboard, not the app.
- Adds a `RouteWeatherPanel` to the existing Host route-management page (`TrekkingRoutesPage.tsx`), alongside the existing `RouteStatusActionDialog`/`RouteCheckpointsPanel` for the currently-selected Route.
- On mount / Route change, reads `GET .../weather/latest` (no provider call); a dedicated "Làm mới thời tiết" button calls `POST .../weather/refresh`. Never auto-refreshes -- matches this codebase's own Decision Gate that no external call fires without an explicit user action.
- Renders loading / load-error-with-retry / empty (never fetched) / a distinct "last attempt failed" state (for a `FAILED` snapshot, BR-229) / success (rain, wind, temperature, visibility, thunderstorm, observed-at) states.
- The refresh button is disabled with an explanatory badge whenever the Route is not `active`, matching the backend's own 409 gate (BR-243) -- the UI never even attempts a call the backend would reject.
- Refresh errors (401/403/404/409/503) are mapped to distinct Vietnamese messages and shown without clearing an already-displayed snapshot.

### Two real bugs found and fixed while wiring this up (not invented, not hidden)

- **`httpClient.ts` crashed on a genuinely empty response body.** `GET .../weather/latest` with no snapshot yet sends `Content-Length: 0` (a truly empty body), not the JSON string `"{}"` -- confirmed against a real request, not assumed from a testing library's own body-defaulting convenience (which is what the backend's own integration test's `response.body` had been reading). `httpClient`'s success path called `response.json()` unconditionally, throwing `SyntaxError: Unexpected end of JSON input` on that exact byte stream. Fixed by returning `undefined` for a `204` or a `Content-Length: 0` response before ever calling `.json()` -- a real, narrow, pre-existing gap in shared client infra that this story's endpoint was simply the first caller to expose (every other endpoint always returns a real JSON body on success).
- **A stale sibling panel stayed mounted after switching Routes.** `RouteWeatherPanel` was originally given `key={selectedRoute.id}` to force a reset on Route change, mirroring `RouteCheckpointsPanel`'s own pattern. In the real dev server, switching from one Route to another left the *previous* Route's panel additionally mounted alongside the new one (reproduced live and confirmed via each panel's own `route.id`/`route.status`, not guessed). The `key` was redundant to begin with -- `useRouteWeather(routeId)` already reacts correctly to a `routeId` change through its own internal `useEffect` dependency, so removing the `key` prop is the correct fix, not a workaround: the component no longer needs a forced remount at all.

### CTMS-25-T02 Test Evidence

- Unit/component (Vitest + Testing Library, service layer mocked, real hooks/component code): `useRouteWeather.test.ts` (6), `useRefreshRouteWeather.test.ts` (9), `RouteWeatherPanel.test.tsx` (7) -- 22 new tests covering every load/refresh state, the active-route gate, and BR-241-style duplicate-submission prevention.
- `httpClient.test.ts` -- 3 new tests added for the empty-body fix above (204, `Content-Length: 0`, and a normal JSON body still parses correctly).
- Full `trekking-routes` feature + `httpClient` suite run together: `pnpm --filter @ctms/web test -- src/features/trekking-routes src/core/api/httpClient.test.ts` -> 172 passed.
- E2E (Playwright, real backend/Postgres/Chrome and a **real** call to the live Open-Meteo API, no mocking): `apps/web/tests/e2e/ctms-25-t02-route-weather.spec.ts` -> 3 passed -- real happy path (Host clicks refresh on an active Route, sees real weather rendered, confirmed against the real `weather_snapshots` row via `db-helper.ts`'s new `get-weather-snapshots` action), a draft (non-active) Route's refresh button disabled in the UI with zero snapshot rows created even via a direct forced API call (BR-243), and a Camper's direct API call returning 403 with zero snapshot rows created.
- `pnpm --filter @ctms/web lint` -> passed (1 pre-existing warning, unrelated). `pnpm --filter @ctms/web build` -> passed.

## References
- Story ID: `CTMS-25`
- Epic: `EPIC 4. Weather Risk`
- Sprint: `Sprint 2`
- Dependencies: `CTMS-19`
- Linked items: `Blocked by: CTMS-19

Blocks: CTMS-26, CTMS-30`
- Spec Reference: `/file/spec/ctms-25-fetch-weather-data-for-trekking-area.md`
- Business Rules workbook: `C:/Users/admin/Downloads/CTMS_Global_Business_Rules_Sprint_1-3.xlsx`
- Story-level BRs: `BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-228, BR-229, BR-064, BR-065`
