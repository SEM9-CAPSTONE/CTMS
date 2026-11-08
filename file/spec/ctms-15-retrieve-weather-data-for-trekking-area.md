# CTMS-015 — Retrieve Weather Data for Trekking Area

## 1. Overview

Story: CTMS-015

Epic: EPIC 3. Weather Risk Assessment

Use Case: Retrieve Weather Data for Trekking Area

Priority: Must Have

Goal: Retrieve and persist traceable weather observations used by the deterministic Weather Risk workflow.

Backlog story:
As the System, I want to retrieve weather data for a trekking area so risk can be assessed using current weather inputs.

Acceptance Criteria:

| Source  | Criterion                                                                        |
| ------- | -------------------------------------------------------------------------------- |
| PB AC-1 | System retrieves weather data for the applicable trekking area.                  |
| PB AC-2 | Weather input is stored with source/location/time context needed for assessment. |
| PB AC-3 | Provider timeout/incomplete data is not treated as verified success.             |
| PB AC-4 | Retry behavior is bounded and does not create duplicate snapshots.               |

## 2. Scope

### In Scope

- Retrieve external weather data.
- Create weather snapshot.
- Preserve source and location context.
- Store supported weather factors.
- Handle provider timeout/incomplete data.
- Bounded retry/backoff.

### Out of Scope

- Calculating risk score; CTMS-016.
- LLM advice; CTMS-019.
- Configuring weather rules; CTMS-020.

## 3. Actors & Authorization

Primary actor: System.

External weather provider supplies input but is not authoritative for CTMS business risk decisions.

## 4. Preconditions & Dependencies

Dependency: CTMS-010.

A valid trekking-area/Route location must be resolvable.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                        |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-039 | weather_snapshots must store the provider values actually received for source, location, rainfall, wind_speed, temperature, humidity, visibility, uv_index, storm_alert, fetched_at, and forecast_at. Missing values must not be fabricated or auto-filled. |
| BR-040 | If the weather provider times out, fails, or omits a critical field, the system must log the failure and mark the data as insufficient or stale according to policy. It must not generate an assessment as though the data were complete.                   |
| BR-188 | Absolute timestamps must be stored as timestamptz. Pure calendar dates use date, and time-of-day values use time where defined by schema. APIs must transmit timezone/offset explicitly, and the UI must display values using the configured timezone.      |
| BR-197 | When an external service times out or returns incomplete data, the system must record the failure, must not assume success, and must not fabricate unverifiable data.                                                                                       |
| BR-198 | Retries to external services must be bounded and use backoff. Retrying must not create duplicate records or transactions.                                                                                                                                   |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                       |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                |

## 6. State & Lifecycle

Weather retrieval requested
→ provider success
→ authoritative Weather Snapshot stored.

Provider failure/incomplete response
→ failed/degraded retrieval
→ no fabricated successful snapshot.

## 7. Business Flow

1. System resolves trekking-area location.
2. System requests weather data.
3. Provider responds.
4. Backend validates response completeness and source/time context.
5. Valid data is stored as Weather Snapshot.
6. Failed/timeout response is recorded.
7. Retry occurs only under bounded retry policy.
8. Valid snapshot becomes input to CTMS-016.

## 8. Data & Invariants

Source-supported weather factors:

- rainfall
- wind speed
- temperature
- humidity
- visibility
- UV index
- storm alert
- source
- location

Provider data and CTMS risk outcome remain separate concepts.

## 9. API / Integration Contract

TBD — Technical Design.

Weather provider is not selected by this Business Spec.

## 10. Error & Edge Cases

| Case                        | Expected Behavior                                                                 |
| --------------------------- | --------------------------------------------------------------------------------- |
| Provider timeout            | Record failure; do not assume success.                                            |
| Incomplete response         | Do not create unverifiable authoritative snapshot.                                |
| Provider retry              | Apply bounded retry/backoff.                                                      |
| Duplicate provider response | Do not duplicate authoritative snapshot.                                          |
| Stale weather data          | Handle according to approved stale-data policy; do not silently treat as current. |

## 11. Acceptance & Test Matrix

| Source | Scenario                   | Expected Result                  | Test Type   |
| ------ | -------------------------- | -------------------------------- | ----------- |
| BR-039 | Complete provider response | Snapshot stored.                 | Integration |
| BR-197 | Timeout                    | No false success.                | Integration |
| BR-197 | Incomplete data            | Rejected/degraded.               | Boundary    |
| BR-198 | Provider repeatedly fails  | Retry stops at configured limit. | Integration |
| BR-198 | Duplicate retry response   | No duplicate snapshot.           | Idempotency |

## 12. Open Decisions

Exact provider, freshness duration and provider-specific response mapping are not defined by these rules and remain Technical Design/configuration decisions unless PB/BR defines them elsewhere.

## 13. Implementation Record — CTMS-015-T01 (Jira CTMS-93): weather for the Trip's own dates

**Problem.** Travellers were judged by the Route's *current* weather (`fetchCurrent`, e.g. today 7/11) when they booked a Trip for another date (e.g. 10/11). Booking blocks, the packing list and the list/detail badges used that value. The forecast over the Trip schedule (CTMS-100) was only available to Host/Admin.

**Change.** Forecast retrieval now targets the Trip's own window (`forecast_at` = the Trip hours, BR-039). It reuses `fetchHourlyForecast(start_hour…end_hour)` from Open-Meteo.

- **Traveller API:** `GET /api/trips/:tripId/weather-forecast/trip-dates`.
  - Roles: Camper, Porter, Host, Admin.
  - Only published or ongoing Trips; other Trips return 404.
  - An ongoing Trip is forecast from the current hour.
  - A Trip beyond the 15-day horizon returns `out_of_range`; today's weather is never substituted.
  - A stored forecast for the same schedule and rule is reused for 10 minutes.
- **Best effort:** `TripWeatherForecastService.tryEnsureTripForecast` never throws. On a provider failure it returns null and stores nothing (BR-040/197). Retries stay bounded at 3 attempts with backoff (BR-198).
- **Booking gate:** `assertBookingWeatherAllowed(routeId, manager, trip?)`. The forecast is refreshed before the transaction, so no network call happens under the lock.

| Situation | Result |
| --- | --- |
| Red trip-date forecast, departure ≤ 3 days away | Blocked (409) |
| Red trip-date forecast, departure further away | Allowed (low reliability; the Host decides later) |
| `out_of_range` | Allowed |
| No usable forecast (none, older than 6 h, other schedule) | Previous Route-assessment rule |

  Callers that pass no Trip keep the old behaviour.
- **Packing list:** uses the trip-date forecast. The context gains `weatherSource` (`trip_forecast` | `route_assessment` | null), and `generated_from` gains `weatherForecast`. With no trip-date forecast it shows no weather rather than today's.
- **Search list:** `GET /api/trips` sets `weatherRiskLevel` from the trip-date forecast and adds `weatherForecastStatus` (`available` | `out_of_range` | `unavailable`).
- **Web:**
  - Trip detail: the "Dự báo thời tiết ngày đi" card (shared `TripWeatherForecastCard`, new `traveller` variant, AI advice hidden unless present) and the hero badge both use the trip-date forecast. The Route current-weather panel was removed.
  - The same card appears on Booking detail.
  - Trip card badge: "Ngày đi: …" or "Chưa có dự báo ngày đi (còn xa)".
  - Packing list chip: "Thời tiết ngày đi".
  - Signed-out visitors see no weather.
- **Out of scope** (separate tasks, see `docs/features/weather-trip-date-decision-policy.md`): monitoring job and change notifications, history only on change, Host/Admin T-24h decision flow, penalties, and mobile.

## 14. Test Evidence — CTMS-93

- **Unit (new):**
  - `trip-date-weather.spec.ts` (20): trip window vs today, ongoing Trip, out of range, hidden statuses, best effort never throws, and the booking gate (Green allows despite a Red Route; Red blocks within 3 days; Red more than 3 days away allows; out of range; fallbacks; no-Trip legacy).
  - `bookings.packing-list.trip-weather.spec.ts` (3), `trips.search-weather.spec.ts` (2).
  - Web: `TripDatesWeatherCard.test.tsx` (4), `TripCard.trip-dates-weather.test.tsx` (5).
- **Updated tests** (behaviour intentionally changed):
  - `TripDetailView.test.tsx`: Route panel replaced by trip-date weather.
  - E2E `ctms-26-t02`: no current-weather panel for visitors.
  - `trips.di.spec.ts` and `trips.controller.spec.ts`: new dependency and viewer argument.
  - Integration `bookings.create` and `bookings.packing-list`: deterministic provider stub; Red forecast blocks, Green forecast allows despite a Red Route, far Trip not blocked, fallback to the Route rule.
- **Results:**
  - API unit: weather, bookings and trips 848/848.
  - Web: 1649/1649.
  - Booking integration 25/25. Trip-search integration suites 56/56.
- **Live check:** `trip-dates` for the 11/11 Trip returned the real Open-Meteo 11/11 07:00–16:00 window. Screenshots: trip-dates card and trip list badges.
- **Full regression:**
  - API integration (8 shards): 28 failures, all in the files that already fail on `develop` (sync-evaluation, overbooking-evaluation, trekking-route-checkpoints, incidents.report, trip-reviews, review-analysis). None in bookings, trips or weather.
  - Default Playwright run: 54 passed / 38 failed / 32 did not run.
  - The run exposed one regression from this task. Traveller-triggered forecasts were stored with the Camper as `created_by` (FK RESTRICT), so E2E user cleanup could not delete that Camper. **Fixed:** traveller-triggered forecasts are now recorded under the Trip's Host, with a unit test.
  - Rerun of the booking and auth specs after the fix: no FK errors. The 10 remaining failures (ctms-29/30/32/34/35/40/42, login, logout, audit-logs) also fail on the pre-task baseline, from the shared seed (`UQ_trip_waypoints_trip_sequence`, missing H-09 fixture).
  - `lint:all`: 0 errors. `build:all`: passed. API unit (weather, bookings, trips): 848/848.

### Definition of Done — CTMS-93
- [x] Trip-date forecast for travellers (API + web), never today's weather.
- [x] Booking gate, packing list and list/detail badges follow the trip-date forecast.
- [x] Route current-weather block removed from Trip detail.
- [x] Tests added or updated; regression compared with the baseline.
- [x] Policy for later tasks documented in `docs/features/weather-trip-date-decision-policy.md`.
- [ ] Mobile Camper weather (separate task).

## 15. Implementation Record — CTMS-93 follow-up: forecast reliability and far-Red warning

Web only; no API change. Implements policy §2 and §3 of `docs/features/weather-trip-date-decision-policy.md`. Only the newest forecast is used.

- **Logic:** `apps/web/src/features/trips/utils/trip-forecast-reliability.ts`.
  - `tripForecastReliability(tripStartsAt)` maps the time left before departure to a reliability level:

    | Time left | Level | Label |
    | --- | --- | --- |
    | More than 7 days | low | "Dự báo xa, có thể thay đổi" |
    | 4–7 days | medium | "Cảnh báo sớm" |
    | 3 days or less, or the Trip has started | high | "Độ tin cậy cao" |

  - `isFarRedForecast` is true for an available Red forecast while departure is more than 3 days away. It uses the same window as the API booking gate (`TRIP_FORECAST_BLOCKING_WINDOW_MS`): in that case booking is allowed, not blocked.
- **Traveller forecast card** (`TripWeatherForecastCard`, `traveller` variant; Trip detail and Booking detail):
  - shows the reliability badge with a one-line explanation;
  - for a far Red forecast, adds the warning "Dự báo xấu, có thể thay đổi. Host sẽ quyết định trước ngày đi."
  - Host/Admin variants and `out_of_range` forecasts are unchanged.
- **Trip detail booking column:** the same warning appears next to the booking panel for a far Red forecast. It is not shown to the managing Host, and not within 3 days, where booking is blocked by the API.

## 16. Test Evidence — CTMS-93 follow-up

- **Unit:**
  - `trip-forecast-reliability.test.ts`: tier boundaries at 15/8/7/4/3/0.5/−0.1 days; just over 3 days counts as medium; far-Red only for an available Red forecast more than 3 days out.
  - `TripWeatherForecastCard.test.tsx`: traveller labels per tier; far-Red warning shown at 6 days, hidden at 2 days; nothing for Host/Admin or `out_of_range`.
  - `TripDetailView.test.tsx`: booking warning at 5 days, not at 2 days, not for the managing Host.
- **Gates:** `lint:all` 0 errors (12 existing warnings); `build:all` passed; web Vitest 1685/1685 (252 files, on develop with CTMS-362).
- **Screenshots:** none; the user chose to skip them for this follow-up. Evidence is the test results.

## 17. Implementation Record — CTMS-93 Task 2: monitoring the Trip-date forecast (Logic)

API only; the UI belongs to CTMS-97. Implements §4 of `docs/features/weather-trip-date-decision-policy.md`.

**Migration `1794600000000-AddTripWeatherMonitoring`**

- `trip_weather_forecasts.checked_at` (NOT NULL, default now; backfilled from `created_at`).
- New table `trip_weather_change_notices`:
  - columns: recipient, Trip, forecast row, Trip title and start, previous and new `weather_risk_level`, `read_at`;
  - `UNIQUE (forecast_id, recipient_id)`; FKs cascade with the user, the Trip and the forecast;
  - inbox index `(recipient_id, created_at DESC)`.

**History only on change** (`TripWeatherForecastService.computeForecast`)

- **Same result, only `checked_at` moves.** A re-check with the same schedule, rule, risk level and worst-hour values (rain, wind, temperature, visibility, thunderstorm) updates `checked_at` and adds no row. The same applies to a still out-of-range result.
- **Any difference stores a new row.**
- **Reuse window:** the 10-minute window is measured from `checked_at`.
- **Raw provider data:** `provider_response` is kept only while the Trip is `draft`/`pending_approval`, i.e. for the forecast the Host can attach to the approval request. Monitoring and traveller checks store `null`.

**Level-change notices** (`TripWeatherChangeNotifier`)

- **Trigger:** called after every new forecast row, whatever triggered it (job, traveller page, Host). It acts only when the new level differs from the level of the newest earlier forecast that had one. The first level ever, or a change of numbers within a level, notifies nobody.
- **Recipients:**
  - the Host;
  - the booker, on `confirmed`/`pending_payment` bookings;
  - members with an active linked account in `registered`/`joined`, on those bookings.
  - Admins are not notified here; that belongs to Task 3.
- **Dedupe:** inserts use `ON CONFLICT DO NOTHING`. Socket `trip.weather.changed` goes only to the user rooms of notices actually created, with `eventId` = forecast id. A retried run notifies nobody twice.
- **Wording:**
  - worse: "Cảnh báo sớm: dự báo ngày dd/MM xấu đi (Xanh → Đỏ), đang theo dõi.";
  - better: "Dự báo ngày dd/MM đã cải thiện (Đỏ → Xanh)."
- **Failure isolation:** a notification failure is logged and never breaks the forecast.

**Monitoring job** (`TripWeatherMonitorService` + `TripWeatherMonitorWorker`)

- **Configuration:**
  - enabled by `TRIP_WEATHER_MONITOR_WORKER_ENABLED=true`, `false` in integration tests;
  - interval `TRIP_WEATHER_MONITOR_INTERVAL_MS`, default 15 min;
  - batch size `TRIP_WEATHER_MONITOR_BATCH_SIZE`, default 50.
- **Due Trips:** `published`/`ongoing`, with a Route, not ended, starting within the 15-day horizon, and whose newest forecast was confirmed more than 24 h ago. The threshold is 6 h when departure is 3 days away or less, or the Trip is running. Never-forecast Trips come first.
- **Processing:** Trips are re-forecast one at a time through `tryEnsureTripForecast`, so a provider failure skips that Trip only.
- **Retention:** once a day, Trips that ended more than 30 days ago lose their forecast history, except the forecast attached at submission (`trips.submitted_weather_forecast_id`). The decision-point forecasts are kept by Task 3.

**New endpoints**

- `GET /api/trips/:tripId/weather-forecast/history`: one row per change, newest first, with `checkedAt`; at most 50 rows.
  - Admin: any Trip. Host: own Trips. Camper/Porter: `published`/`ongoing` Trips. Otherwise 404.
- `GET /api/me/weather-notices`: `{ items, unreadCount }`. Each item includes `worsened` and a ready `message`.
- `PATCH /api/me/weather-notices/:id/read`: idempotent; 404 when the notice is not the caller's.
- `TripWeatherForecastResponseDto` gains `checkedAt`.

## 18. Test Evidence — CTMS-93 Task 2

- **Unit** (`trip-weather-monitoring.spec.ts`, 27 tests):
  - an unchanged re-check only touches `checked_at`;
  - 10-minute reuse measured from `checked_at`;
  - changed numbers at the same level store a row;
  - a level change passes the previous level to the notifier, and the first level passes `null`;
  - an out-of-range result is confirmed, not duplicated;
  - raw data is dropped for published Trips and kept for draft/pending ones;
  - history access for admin, Host, Camper and Porter, and 404 for others;
  - notifier: no-op without a change, recipients, push only for created notices, no push on retry, never throws;
  - wording for both directions;
  - monitor cadence constants, sequential processing and failure count, 30-day trim cutoff;
  - worker: idle unless enabled, daily trim, survives a failed tick.
- **Integration** (`test/trip-weather-monitoring.integration-spec.ts`, real PostgreSQL, provider stub, 4 tests):
  - **job on a published Trip 5 days out:**
    - the first run stores a green row with no raw data;
    - one hour later nothing changes;
    - 25 h later still one row, with `checked_at` moved;
    - turning Red adds a row and creates notices plus a socket push for the Host, the confirmed Camper and the awaiting-payment Camper only (not the cancelled Camper, a stranger or the Admin);
    - a retried run adds no notice;
    - inbox and read flow, with 404 for another user;
    - history newest first;
  - a Trip 2 days out is not re-checked after 5 h but is after 6 h;
  - Campers get 404 on a draft Trip's history;
  - retention keeps only the submitted forecast of a Trip that ended 40 days ago.
- **Gates:**
  - `pnpm lint:all`: 0 errors (12 warnings, all pre-existing).
  - `pnpm build:all`: passed.
  - API unit: 2202/2204. The 2 failures are the known `package-readiness.spec.ts` ones.
  - Integration, 8 shards with `--runInBand`: only known failures remain.
    - The 28 baseline failures: sync-evaluation 4, overbooking-evaluation 4, trekking-route-checkpoints 2, incidents.report 1, trip-reviews 1, review-analysis 16.
    - `gps-tracking` 1: the response now includes `startsAt`/`endsAt` (CTMS-64 on develop), but the test was not updated. No GPS code changed on this branch.
    - An `e2e-%` user was left in `ctms_test` because `FK_audit_logs_actor_id` blocked its cleanup. It made the `auth.*` suites fail with 409. After removing it, `auth.login`, `auth.refresh` and `auth.resend-otp` passed 24/24 and shard 6 passed 98/98.
  - New tests: `trip-weather-monitoring` integration 4/4, monitoring unit 27/27.
  - Default E2E: 54 passed / 38 failed / 32 did not run, the same as the baseline.

## 19. Implementation Record — CTMS-015-T02 (Jira CTMS-97): weather change notices and forecast history (UI)

- **Scope:** web only (`apps/web`). It uses the CTMS-93 Task 2 API with no backend change. Mobile is not in this task.
- **API wiring:**
  - `core/api/endpoints.ts`: `TRIPS.WEATHER_FORECAST_HISTORY`, `WEATHER.CHANGE_NOTICES`, `WEATHER.READ_CHANGE_NOTICE`.
  - `core/api/queryKeys.ts`: `trips.tripWeatherHistory(tripId)`, `weather.changeNotices(userId)`.
  - `TripWeatherForecast.checkedAt` (optional) and `tripsService.getTripWeatherHistory`.
- **Weather inbox** (`features/weather`):
  - `services/weather-change-notices.service.ts`: list and mark read.
  - `hooks/useWeatherChangeNotices.ts`:
    - polls every 60 s, only with a signed-in session;
    - on the `trip.weather.changed` socket event, reloads the inbox at once and refreshes that Trip's forecast and history queries;
    - the unread count comes from the server.
  - `components/WeatherChangeNotices.tsx`:
    - copies the look of the booking cancellation inbox (same button, badge and `<dialog>`), so the UI stays consistent;
    - each notice shows the Trip link, the server's message and the old → new level badges;
    - worsened notices use an amber background, improved ones green;
    - unread notices have "Đánh dấu đã đọc".
  - Placement:
    - Host: in `role-landing/Sidebar`, next to the cancellation bell;
    - Camper: in `camper-profile/CamperSidebar`, beside the logo;
    - Admin gets no weather notices (policy §4).
- **Forecast history** (`features/trips`):
  - `hooks/useTripWeatherHistory.ts` and `components/TripWeatherHistory.tsx`: a collapsible "Lịch sử thay đổi dự báo" that loads only when opened.
  - Each row shows the time, level badge (or "Chưa có dự báo" when out of range), composite score, and "Kiểm tra lần cuối" when the monitor re-confirmed the row later.
  - `TripDatesWeatherCard` renders it under the forecast on the Trip page and the Booking page.
  - `TripWeatherForecastCard` (traveller view) adds "Kiểm tra lần cuối: …" from `checkedAt`.

## 20. Test Evidence — CTMS-97

- **Vitest:**
  - `WeatherChangeNotices.test.tsx` (6): list with message, levels, link and worsened highlight; mark read with the server count; mark-read error; retry then empty state; `trip.weather.changed` reloads at once; idle without a session (no request, no socket).
  - `TripWeatherHistory.test.tsx` (3): loads only when opened, newest first, out-of-range row, last-checked hint; empty; retry.
  - `TripDatesWeatherCard.test.tsx` (+1): last-checked line and history section.
- **Playwright** (`tests/e2e/ctms-97-weather-change-notices.spec.ts`, mocked backend, 2 tests):
  - Host reads a level change from the inbox and marks it read (PATCH sent once, count 0).
  - Camper sees the inbox; the Trip page shows "Kiểm tra lần cuối", and the history loads only on open with 2 rows.
- **Gates:**
  - `pnpm lint:all`: 0 errors (12 warnings, all pre-existing).
  - `pnpm build:all`: passed.
  - Web Vitest: 254 files, 1695/1695 passed.
  - API unit (in `pnpm test:all`): 2202/2204. The 2 failures are the known `package-readiness.spec.ts` ones; the API was not changed.
  - Default E2E: 56 passed / 38 failed / 32 did not run. That is the baseline (54 / 38 / 32) plus the 2 new CTMS-97 tests; the failed set is unchanged.
