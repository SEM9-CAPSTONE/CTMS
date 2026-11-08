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
