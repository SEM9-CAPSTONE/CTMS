# CTMS-100 — Trip Weather Forecast Before Approval

## 1. Overview

Story: CTMS-100 ([CTMS-19-T01], parent CTMS-62); extends CTMS-019 weather advice to the Trip forecast

Epic: EPIC 3. Weather Risk Assessment (touches EPIC 4 Trip Management: CTMS-023 submit/approve)

Use Case: Forecast the weather of the trekking days when a Host submits a Trip, and show it to the Admin

Priority: Must Have (requested by the team leader and the product owner on 2026-10-18)

Goal: When the Host reaches step 2 "Lịch trình chuyến đi", the system automatically forecasts the weather over the Trip's own schedule (not today's weather), scores it with the active weather rules and explains it with AI. Green submits normally, Yellow submits with a note for the Admin, Red submits only after the Host acknowledges the risk. The Admin sees the forecast attached to every submission, whatever its colour.

Acceptance Criteria:

| Source | Criterion |
| --- | --- |
| Leader | The three weather panels (data, risk score, advice) are merged into one card. (On `develop` the Route-page panels were removed by the CTMS-53 refactor; the merged card is used for the Trip forecast.) |
| PO AC-1 | Step 2 of Trip creation forecasts the weather automatically, for the Trip start–end window. |
| PO AC-2 | Green: submit normally. Yellow: submit allowed, Admin reviews carefully. Red: submit only after the Host acknowledges the risk. |
| PO AC-3 | The Admin review shows the forecast attached at submission for Green, Yellow and Red. |
| PO AC-4 | AI advice is generated for the forecast without blocking the Host. |
| PO AC-5 | The UI reuses the team's shared components; missing ones are created. |

## 2. Scope

### In Scope

- Hourly forecast for the Trip window from Open-Meteo, worst hour per criterion, scored with the active `weather_rules`.
- Out-of-range handling when the Trip starts beyond the forecast horizon.
- Attaching the forecast and the Host acknowledgement to the Trip submission; audit.
- Admin pending-review list badge and detail card.
- One merged weather card (`WeatherRiskCard`) in Trip step 2 and the Admin review.

### Out of Scope

- Climatological estimate for Trips beyond the horizon (Pending Decision PD-1).
- Re-checking published Trips when they enter the horizon and notifying Host/Admin (PD-2).
- Changing the registration block (CTMS-018), which keeps using the current Route assessment.

## 3. Actors & Authorization

- Host: owning Host of the Trip forecasts, reads and submits.
- Admin: reads the forecast (latest or submitted) of any Trip; may also re-run it.

## 4. Preconditions & Dependencies

- CTMS-015/016/019: weather provider, deterministic scoring, advice provider.
- CTMS-021/022/023: Trip draft with Route, schedule and waypoints; submit and Admin review.

## 5. Business Rules

- BR-1: The forecast window is the Trip's `starts_at`–`ends_at`, clamped to now and to the horizon end (23:00 UTC of the 15th day after today, Open-Meteo's limit).
- BR-2: Each criterion takes its worst hour in the window (max rain, max wind, min visibility, any thunderstorm, temperature with the highest score); the composite score and level use the active rule (BR-041).
- BR-3: A Trip that starts after the horizon gets an `out_of_range` result; no provider call is made.
- BR-4: A repeated request within 10 minutes for the same schedule and rule reuses the stored forecast.
- BR-5: On submit, the latest forecast is attached. Red requires `acknowledgeWeatherRisk: true` (422 otherwise). A forecast made for an older schedule must be refreshed (422). Without any forecast (provider unavailable) the Trip is still submitted and the Admin sees that no forecast was available.
- BR-6: The audit entry of `trip.submitted_for_approval` records the forecast id, status, level and acknowledgement.
- BR-7: Provider or advice failures never store a fabricated result (BR-229); advice is generated once per forecast.

## 6. State & Lifecycle

Forecast rows are immutable apart from the one-time advice fields. A Trip keeps a pointer `submitted_weather_forecast_id` to the forecast used at its latest submission.

## 7. Business Flow

1. Host fills step 1 and saves the draft Trip.
2. Step 2 opens; the forecast runs automatically and the card shows level, score, criteria with their worst hour, and AI advice when ready. Changing the dates re-runs it.
3. Host submits: Green directly; Yellow with a note; Red after ticking "Tôi đã biết chuyến đi đang có rủi ro thời tiết cao".
4. Admin opens "Duyệt trip": the list shows a weather badge; the detail shows the submitted forecast card and whether the Host acknowledged a Red risk.

## 8. Data & Invariants

- `trip_weather_forecasts`: `trip_id`, `route_id`, `status` (`available` / `out_of_range`), `trip_starts_at`, `trip_ends_at`, `forecast_from`, `forecast_to`, `worst_reading`, `rule_version_id`, `risk_level`, `composite_score`, `criteria_scores`, `provider_response`, `advice_text`, `advice_actions`, `advice_generated_at`, `created_by`, `created_at`. Checks: available rows carry the full assessment; out-of-range rows carry none; advice text and time are set together.
- `trips.submitted_weather_forecast_id` (FK, ON DELETE SET NULL), `trips.weather_risk_acknowledged_at`.

## 9. API / Integration Contract

| Method | Path | Role | Result |
| --- | --- | --- | --- |
| POST | `/api/trips/:tripId/weather-forecast` | Host (owner) / Admin | Forecast for the Trip schedule. |
| GET | `/api/trips/:tripId/weather-forecast/latest` | Host (owner) / Admin | Latest forecast or null. |
| GET | `/api/trips/:tripId/weather-forecast/submitted` | Host (owner) / Admin | Forecast attached at submission or null. |
| POST | `/api/trips/:tripId/weather-forecast/advice` | Host (owner) / Admin | Latest forecast with AI advice. |
| POST | `/api/trips/:tripId/submit` | Host | Body `{ acknowledgeWeatherRisk?: boolean }`. |
| GET | `/api/trips/admin-reviews`, `/api/trips/pending-review` | Admin | Each Trip has `submittedWeatherForecast { id, status, riskLevel, riskAcknowledged }`. |

## 10. Error & Edge Cases

- Trip not draft/pending/published or already ended → 409; no Route or schedule → 422; not owner → 403.
- Provider down → 503, nothing stored; the Host can still submit.
- Trip partly beyond the horizon → forecast covers the in-range part, `coversWholeTrip = false`, the card says so.
- Advice service down → card shows the score and an advice error; submission is not blocked.

## 11. Acceptance & Test Matrix

| AC | Evidence |
| --- | --- |
| Leader | `WeatherRiskCard` (data + risk + advice in one card) used by `TripWeatherForecastCard` in step 2 and the Admin review. |
| AC-1 | Integration "forecasts the Trip day (not today)…"; `ConfigureTripWaypointsPanel` test calls `forecastWeather`. |
| AC-2 | Integration Red/Green/Yellow/no-forecast/stale cases; panel test Red gating. |
| AC-3 | Integration pending-review summary and `/submitted`; `TripWeatherBadge` test. |
| AC-4 | Integration advice once per forecast; hook generates advice after the forecast. |
| AC-5 | Shared `Card`, `Button`, `StatusBadge`; new `WeatherRiskCard`. |

## 12. Pending Decisions

- PD-1: Trips starting beyond 15 days currently get "out of range" and can be submitted (decision A, 2026-10-18). Option B — a climatological estimate from Open-Meteo Historical for the same dates in past years — is left for a later story.
- PD-2: Automatic re-forecast of published Trips when they enter the horizon, with a warning on Red, is left for a later story.

## 13. Implementation Record

- Migration `1787260000000-CreateTripWeatherForecasts`.
- Weather module: `scoreWeatherReading` extracted to `weather-risk-scoring.ts` and reused by `WeatherRiskService` (behaviour unchanged); `WeatherProvider.fetchHourlyForecast` (Open-Meteo `hourly` with `start_hour`/`end_hour`, GMT); `WEATHER_FORECAST_HORIZON_DAYS = 15`; `TripWeatherForecastService`, repository, controller and DTO.
- Trips module: `SubmitTripDto`; `TripsService.submitForApproval` attaches the forecast, enforces the Red acknowledgement and stale-schedule rule, and audits it; `findAdminReviews` and `findPendingReview` add `submittedWeatherForecast` through one shared helper.
- Web: `features/weather` (`WeatherRiskCard`, `weather-risk` utils) built on the shared `Card`, `Button`, `StatusBadge`; Trip step 2 gets `TripWeatherForecastCard` + `WeatherSubmissionNotice` through `useTripWeatherForecast` (auto-run, re-run on schedule change, advice afterwards); `useConfigureTripWaypoints.submit` passes the acknowledgement; Admin review (`admin-reviews`) gets `TripWeatherBadge` and the submitted forecast card (read-only, retry on error).
- Synced with `develop` on 2026-10-23 (PRs #775/#776): the Route-page weather panels no longer exist there, so no Route-page card is added; the Admin review uses the new `listAdminReviews` endpoint.
- Pre-existing issue seen during the work: `porter-requests.responses.service.spec.ts` failed 6 tests on `develop` after commit `ed81d8e`; it passes on the `develop` this branch is now based on.

## 14. Test Evidence

- API build and ESLint clean; Biome clean on changed files.
- API unit (`pnpm test`): 120 suites, 1411 tests passed (includes `trip-weather-forecast.service.spec.ts`; `WeatherRiskService` tests unchanged and passing after the scoring extraction).
- API integration (real Postgres, `--shard=i/8 --forceExit`): 40+ suites, 422 tests passed, including `trips.weather-forecast.integration-spec.ts` (Trip-day window not today, worst-hour Red, reuse window, out-of-range without provider call, Red needs acknowledgement, Green/Yellow/no-forecast submit, stale schedule 422, Admin summary and `/submitted`, audit, advice once, ownership).
- Web build and ESLint clean (4 pre-existing warnings in files not touched).
- Web vitest (full run): 203 files, 1314 tests passed. New: `WeatherRiskCard.test.tsx`, `TripWeatherForecastCard.test.tsx` (card, submission notice, Admin badge), Red-acknowledgement case in `ConfigureTripWaypointsPanel.test.tsx` and `useConfigureTripWaypoints.test.ts`; existing tests updated for the extra `submitForApproval` argument and the forecast mocks.
- Manual run on the local app with Playwright (temporary script, not committed): step 2 real forecast 3 days ahead (Green), Red forecast locks "Gửi duyệt" until acknowledged and submits, Trip 30 days ahead shows out of range and submits, Admin list badges (Green / Red + acknowledged / out of range) and detail cards.

## 15. Definition of Done

- [x] Forecast over the Trip schedule with worst-hour scoring and out-of-range handling.
- [x] Submission rule Green/Yellow/Red with acknowledgement and audit.
- [x] Admin list badge and detail card.
- [x] Merged weather card reused on the Route page, Trip step 2 and Admin review.
- [x] Gates and screenshots recorded.
- [x] Jira key confirmed (CTMS-100).

## 16. Hybrid Risk Review (leader decision C, 2026-11-13)

No Jira key (leader-requested adjustment). Branch `chore/weather-hybrid-ai-review`.

### Decision

- The Admin thresholds (CTMS-20) keep deciding the official Green/Yellow/Red level. Booking blocks, Host decisions (policy §5) and Host penalties (policy §6) still use only that level, so every penalty keeps a clear, rule-based reason.
- An AI gives an independent opinion on the same raw worst-hour readings. It never receives the thresholds or the rule-based level, so it cannot simply echo them.
- When the two disagree, the Trip is listed for the Admin under Quản lý thời tiết › "Cần xem lại ngưỡng", so thresholds that look too strict or too loose can be reviewed. The Admin can mark each disagreement as seen.
- Out of scope: auto-cancelling Trips on Red (policy §5.4 still says the system never auto-cancels; waiting on the leader).

### Rules

| Rule | Behaviour |
| --- | --- |
| HR-1 | `riskLevel` is never changed by the AI. The AI fields are informational only. |
| HR-2 | Only the newest forecast of each `pending_approval`, `published` or `ongoing` Trip that has not ended is reviewed. A forecast is reviewed at most once. |
| HR-3 | A failed review never breaks forecasting. Each forecast gets at most 3 attempts; a permanent failure (4xx other than 429) stops further attempts. |
| HR-4 | Without `AI_REVIEW_SERVICE_TOKEN` the review is skipped entirely and Trips show no AI opinion. |
| HR-5 | Host and Admin forecast responses carry `aiReview`; Camper/Porter responses (`trip-dates`, traveller history) never do. |
| HR-6 | The disagreement list shows the newest forecast only, widest gap first (Green vs Red before one-step gaps), then soonest departure. |

### API

- `POST {AI_SERVICE_URL}/weather-risk-review` (services/ai, `X-CTMS-AI-Token`): input `rainfall_mm`, `wind_kph`, `temperature_c`, `visibility_m`, `thunderstorm`, `hours_covered` (extra fields rejected); output `level`, `reason` (Vietnamese, ≤ 2 sentences), `confidence` 0–1, `model`, `prompt_version`.
- `GET /api/admin/weather/ai-mismatches` (Admin): `TripWeatherAiMismatchDto[]`.
- `POST /api/admin/weather/ai-mismatches/:forecastId/acknowledge` (Admin): idempotent; 404 unknown forecast, 409 when the AI agrees with the thresholds.
- `TripWeatherForecastResponseDto.aiReview`: `{ level, reason, confidence, reviewedAt, matchesRule, acknowledgedAt } | null`.

### Implementation Record

- Migration `1795200000000-AddTripWeatherAiReview`: `trip_weather_forecasts` gains `ai_risk_level`, `ai_reason`, `ai_confidence`, `ai_model`, `ai_reviewed_at`, `ai_review_attempts`, `ai_review_acknowledged_at`, `ai_review_acknowledged_by`, with CHECKs (all-or-nothing AI fields, confidence 0–1, acknowledgement needs a review) and a partial index for open disagreements.
- services/ai: `weather_risk_review_service.py` (prompt v1, temperature 0, JSON output validated by Pydantic) and the endpoint in `main.py`, reusing `build_analysis_client()` (OpenAI or Gemini) and the internal token.
- API: `HttpWeatherRiskReviewProvider`, `TripWeatherAiReviewService` (review queue, mismatch list, acknowledge), `WeatherAiReviewController`, repository queries, and `toTripWeatherForecastResponse(..., { includeAiReview })`. The review runs inside the existing `TripWeatherMonitorWorker` tick after `checkDueTrips`, so no new worker or env flag is needed.
- Web: `features/weather-ai-review` (service, hooks, `WeatherAiMismatchPanel`, `AiRiskOpinionNote`); third tab "Cần xem lại ngưỡng" (`/admin/weather?tab=ai-review`, with a count) on `AdminWeatherManagementPage`; `TripWeatherForecastCard` shows the AI opinion for Host/Admin only.
- Seed (`main.seed.ts`, step 6): Hải Vân (thresholds Red, AI Red), Lang Biang (thresholds Green, AI Red) and Mỹ Sơn (thresholds Yellow, AI Green).

### Test Evidence

- AI service pytest: 89 passed, including 9 new tests in `test_weather_risk_review_service.py`. The `test_knowledge_*` suites need `docling` and were not run on this machine.
- API unit: `trip-weather-ai-review.service.spec.ts` (17) and `weather-risk-review.provider.spec.ts`; weather module total 190 passed.
- API integration: `trip-weather-ai-review.integration-spec.ts` (4) together with the other weather suites (monitoring, Trip forecast, decisions, penalties): 5 suites, 24 tests passed.
- Web vitest: `WeatherAiReview.test.tsx`, the third-tab case in `AdminWeatherManagementPage.test.tsx` and the AI-opinion case in `TripWeatherForecastCard.test.tsx`.
- Seed: full `--fresh` run on a throwaway database; the 3 AI demo forecasts were stored as designed.

### Gates

- `pnpm lint:all`: 0 errors (12 existing warnings in files this change does not touch).
- `pnpm build:all`: API and web pass.
- API jest: 203 suites, 2453 tests passed.
- Web vitest: the affected areas (weather-ai-review, admin-weather, admin-weather-rules, TripWeather cards) pass, 5 files and 37 tests. The full parallel run is slow on this machine; one timing failure in `WeatherDecisionComponents.test.tsx`, which this change does not touch, passes when run alone (13/13).
- Default Playwright E2E: 62 passed, 39 failed, 32 did not run. The develop baseline is 61/39/32 and the failures are the same existing suites.
- Screenshots (mocked API, real UI): the "Cần xem lại ngưỡng" tab, the "Người tạo" column, and the bounds error in the rule dialog.
