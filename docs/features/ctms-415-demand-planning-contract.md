# CTMS-415 — Grounded demand planning extension

Approved in chat on 2026-11-07. BE only on the requested CTMS-415 branch, fast-forwarded to develop a1863f5d. No automatic Trip/Route business operations, no UI changes, no performance/causality claims.

## Evidence and privacy

A separate `booking_demand_snapshots` row is captured by an AFTER INSERT Booking trigger, observing the existing transaction without changing Booking price/status/capacity calculations. Only new Booking inserts whose created_at is within five minutes of capture qualify; legacy rows and backdated bulk imports receive no inferred history. Snapshot fields are type, difficulty, price-band, capacity-band, duration-band, optional confirmed catalog area and capture version/time. No raw coordinate, text or exact commercial amount is copied. Snapshots are immutable on normal updates; deleting the Booking deletes its analytic row. Snapshot type/difficulty must still match the report cohort to enrich it.

Price bands in VND per person: free; positive below 500,000; 500,000 through below 1,000,000; 1,000,000 or above. Capacity bands: 1–10, 11–20, 21–40, 41+; null/invalid capacities stay unknown. Capacity means the offered Trip maximum observed at Booking creation, never the number of people in one Booking or an optimal/recommended limit. Duration: day / one night / two or more nights, from the authoritative Trip duration field. No exact recommended price/capacity is generated.

`demand_areas` is a trusted catalog, provisioned by migrations/approved seed or controlled operator import; no Host write API for labels. `trip_demand_contexts` records an owner's explicit selection of an active area. This is analytic metadata only and does not change Trip/Route geometry, publication, pricing or validation. No geography is guessed. Host confirmation is labeled as such, not independently verified geographic truth. Until a catalog entry/context exists, area evidence is unavailable. This does not claim to resolve the separate BR-054 province/city snapshot gap.

Planning context is frozen in the same transaction as the first monthly report. Only whole existing released cohorts can be enriched. Every row must have a matching snapshot and a uniform known dimension before that dimension is released; otherwise omit it for the entire cohort. No independently counted child groups, parent/child count sets, hidden-cell labels, marginal joins or alternative source snapshots. Each enriched candidate uses the same ten-wide interval and 10 distinct bookers / 3 Hosts / 75% dominance policy as its released parent. At most eight candidates. Unknown fields are null, not zero/free.

No planning backfill for already-published reports. Non-succeeded base reports cannot start planning. Changed/stale sources/config cannot start new planning. Current source/privacy gates are rechecked on every read and immediately before/after provider work. Withdrawn context returns no recommendations. Any source/config mismatch withholds planning output; revoked areas or no-longer-eligible cohorts are never exposed.

## API

All endpoints require an active Host and Cache-Control: no-store.

- GET `/api/host/demand-insights/areas`: active catalog codes/labels and provenance (no private source identities).
- PUT `/api/host/demand-insights/trip-context`: `{tripId, areaCode}`. Own Trip required (404 otherwise), active known catalog code required. Only affects future Booking snapshots; no historical snapshot changes.
- POST `/api/host/demand-insights/:month/planning-suggestions`: empty object. Base report must exist and succeed, frozen context must exist and remain usable. 202 pending/running; 200 terminal/reused. 422 planning_unavailable/report_not_ready/context_stale where creation is not supported. Global persisted planning cooldown 60 seconds, 429 with Retry-After. No force/regenerate flag.
- GET same planning path: `{status,reportVersion,dataPeriod,generatedAt,stale,recommendations,errorCode}`. No job is represented as `not_requested`; legacy context as `unavailable`; privacy withdrawal as `withheld`; queued/running/succeeded/failed are separate. Empty/restricted output never contains residual recommendations.

Successful recommendation: candidate's server-owned type/difficulty, bookerBand, nullable priceBand/capacityBand/durationBand/area evidence, `evidenceBasis=observed_bookings`, `capacityMeaning=offered_at_booking`, approved focus codes and server-authored general-advice labels. No claim of highest demand, conversion uplift, optimum capacity or price, forecast or causal effect. Numeric facts are resolved from context, never model text.

AI receives only public candidate ordinals, approved taxonomy bands/codes and the data period. It returns `{recommendations:[{candidateId,focusCodes}]}`; no free text. Focus codes are allowlisted per candidate (overnight preparation only for overnight Trips, price transparency only with price evidence, group organization only with capacity evidence). Unknown/duplicate IDs, unsupported codes, extra fields, numbers and unsupported combinations are rejected in Python and Nest independently. Prompt `planning-v1`; output is persisted and reused for all Hosts.

## Persistence and execution

`demand_planning_contexts`: one immutable context per report, captured only at first report insertion. `demand_planning_jobs`: one shared job per report, frozen provider/config/model/prompt, attempts 0..3, lease token/until, next_attempt_at, output, safe error code and generated_at. A global control row serializes creation/claims and stores cooldown. FOR UPDATE SKIP LOCKED claims one active planning job; 60-second leases, renewal every 20 seconds, token/expiry checks before writes. Retry only transient failures, maximum three attempts, backoff 5/30 seconds; no implicit provider SDK retry. No manual retry/reset endpoint in this first extension. Same provider timeout 40 seconds / Nest timeout 45 seconds as demand generation.

GET does not call AI. Requests/reloads share the persisted job. Failed calls never manufacture advisory output. Invalid schema/refusal/auth/quota are terminal. Monthly publication is unchanged by planning completion.

## Verification

Test price/capacity/duration boundaries, unknown vs zero, legacy/backdated insert exclusion, immutable snapshots, same-cohort uniformity, sparse/mixed dimensions, no marginal combinations, active-Host/Trip ownership, frozen context vs legacy reports, stale/withdrawn eligibility, duplicate requests, persisted cooldown, lease takeover/late writes, retry exhaustion, unsupported model output and no source identities. PostgreSQL integration uses ctms_test and fake provider; a real provider smoke test must be reported separately. Seed source rows only in main.seed.ts; never seed AI results. Run relevant Booking/demand regressions, Python strict-boundary tests, TypeScript/lint/build. No tests are claimed before execution.

### Synthetic demonstration sources

Use main.seed.ts with `--demand-insights-only --demand-planning --demand-month=2026-07` only for a fresh local scenario month without an existing report. It adds explicitly synthetic snapshots and demo area labels, not AI results or inferred historical facts. The transaction refuses existing scenario Trips/reports. Normal seed execution does not invoke this scenario.

### Executed verification (2026-11-07)

- Focused Nest/Booking regression: 6 suites, 123 tests passed.
- Real PostgreSQL demand/planning integration: 52 tests passed (provider fake). Includes price/capacity/duration boundaries, prospective snapshots, immutable history, owner authorization, duplicate POST, persisted cooldown across reports, lease takeover/expiry, retry exhaustion, config/source withdrawal and rejected invented output.
- Whole API unit regression: 172 suites / 2,063 tests passed; 1 suite / 2 tests failed in Offline Package optional-source freshness. Exported unchanged HEAD a1863f5d reproduces both failures. No Offline Package source was changed.
- Whole API PostgreSQL integration before the four additional focused cases: 60 suites / 696 tests passed; 4 suites / 11 tests failed in sync evaluation, overbooking evaluation, route checkpoints and incident reporting. The same 11 failures reproduce on unchanged HEAD with a separately created ctms_planning_baseline_test database, without the planning migration. These are not asserted to pass.
- Python weather/review/demand/planning/knowledge API tests: 82 passed, 1 opt-in pinned-model download test skipped. Knowledge chunking: 14 passed in a separate venv with pinned docling-core 2.106.0. Total 96 passed across the two dependency environments; this is not a single combined-environment run. Deprecation warnings remain. The initial complete collection failed because the review-service venv lacked ingestion dependencies; pypdf was installed there and docling-core was tested in isolation, without changing dependency manifests.
- TypeScript noEmit, Nest build, complete API ESLint and changed-TypeScript Biome passed. Web build passed with an existing bundle-size warning. Complete web regression passed: 242 files / 1,594 tests, 727.63 seconds. Complete web ESLint passed with 12 existing warnings.
- New migration applied successfully on ctms_test and local ctms; down migration was exercised inside a transaction on ctms_test and rolled back to restore the schema. No development report was deleted or reset.
- The additive July 2026 planning fixture executed successfully: 24 synthetic Booking snapshots, two whole cohorts, three Hosts per cohort. No AI output was seeded. Demo area labels are synthetic and are not claims about verified real geography.
- Live end-to-end smoke: authenticated Host POST monthly July report (202), worker -> real Gemini /demand-insight (200), GET succeeded with stale=false; separate POST planning (202), worker -> real Gemini /demand-planning (200), GET succeeded with two grounded recommendations and stale=false. Persisted planning job: attempts=1, one job, approximately 2.83 seconds from enqueue to completion. Repeated POST returned 200/reused=true; repeated reads used persisted output. This is one observation, not a latency guarantee. Outputs stayed within seeded price/capacity/duration/area evidence and contained no source user/Host/Trip/Booking identities.

UI has not been modified for the new planning API. Existing August–October reports are preserved and do not gain fabricated planning context. The July report is available for subsequent UI integration. Verification was completed before commit/push; remote CI has not been run.

### Subsequent UI integration (no additional backend feature required for this contract)

1. Read the existing monthly report. Only succeeded reports can expose the separate planning action.
2. GET :month/planning-suggestions. For not_requested, allow POST with an empty object. POST 202 starts/reuses active work; POST 200 reuses terminal work. GET never calls the provider.
3. Poll GET only while pending/running; stop on succeeded/failed/withheld/unavailable. Preserve the existing tab-visibility/unmount/backoff conventions. Respect 429 Retry-After, 401/403 and 422; no client force/regenerate or retry override.
4. Render only returned grounded fields; null evidence stays unavailable. Present generalAdvice separately from observed evidence and retain the advisory disclaimer. Do not infer locations, exact optimal prices, capacity, rankings or causal booking uplift.
5. For legacy reports, explain unavailable rather than offering a failing POST. For withheld, clear previous recommendations. Do not display raw provider errors or source identities.
6. If collecting area context in a later UI, list the approved catalog and submit an owned Trip plus areaCode to trip-context; this affects future Booking snapshots only. Never edit historical snapshots or infer area from Trip text.

Additional existing-screen regression: dedicated Playwright demand-insights suite passed 7/7 (six mocked HTTP cases and one real local API/database stored-report case). This does not claim the new planning button exists in UI. Complete web ESLint exited successfully with 12 existing warnings.

Playwright runner note: the original Windows-managed Vite teardown did not exit after all seven assertions completed. Re-running the same seven tests against the already-running dedicated port 5197, with only webServer lifecycle management omitted in a temporary config outside Git, exited 0 with 7 passed (20.8s). No test body, API mock or application code was changed for this rerun.

Inherited release limits remain: threshold approval is contributor approval, not independent product-owner approval; source fingerprints retain the original server-private hash rather than introducing HMAC in this extension. Uniform whole-cohort evidence may omit most price/area/capacity fields in heterogeneous real datasets. The feature does not estimate conversion or prove which offering will attract more participants.

Final readiness: all new backend-focused checks and the real Gemini planning chain passed; the subsequent branch can implement UI against the documented endpoints. Whole-repository green/merge readiness is not claimed because the reproduced baseline failures remain. Artifacts, video/evidence, environment files and temporary test configurations were not staged or committed.
