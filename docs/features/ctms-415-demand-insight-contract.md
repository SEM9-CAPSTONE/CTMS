# CTMS-415 — Booking demand insights: contract and decisions

## Approval and boundaries

Story CTMS-297 / spec CTMS-109, logic subtask CTMS-415; UI belongs to CTMS-416. Based on develop ab60ccd2. The requesting project contributor approved Booking-first data and initial configurable defaults of ten distinct bookers and three distinct Hosts in this chat on 2026-11-06 (Asia/Ho_Chi_Minh). This records contributor approval, not an independently verified product-owner sign-off; product-owner confirmation remains recommended. A configurable 75% maximum Host contribution is the implementation proposal for the approved dominance control. These settings are release policy, never client parameters.

No search/view collection, location inference, medical/SOS/GPS/private questions, payment credentials, review text, or Trip/Route mutations. No invented geographic categories. AI only selects advisory candidates supported by released taxonomy cells, never prices, actions, free-form numeric claims or forecasts.

## Source and privacy release

- One calendar month of Booking.created_at, using Asia/Ho_Chi_Minh boundaries, only closed months within the previous twelve months. All Hosts see the same report. No Host filter, arbitrary date range, totals, complementary counts, overlapping windows, or per-user drill-down.
- Include confirmed/completed Bookings with no cancelled_at, on published/ongoing/completed Trips, for existing non-deleted bookers and Hosts. Exclude Bookings with a pending or succeeded refund Payment; failed refunds do not remove otherwise eligible demand. No payment fields enter the provider payload. Account status is eligibility, never a reporting dimension.
- Count distinct bookers, not Bookings or party size. Host contribution is distinct bookers per Host divided by total distinct bookers in that cell; reject a cell if any ratio exceeds the maximum. A booker participating with multiple Hosts does not increase the cohort denominator.
- First try disjoint Trip-type × difficulty cells. If none pass all gates, use disjoint Trip-type cells for the entire report. Never publish parent totals with children. Omit unsafe cells; do not expose hidden counts, small-cell labels or an exact denominator. No 'other' bucket is necessary. Each released cell exposes only a ten-wide booker interval, not an exact count or Host count.
- Freeze the released cells and chosen granularity in one immutable report per month. No regeneration/replacement for another source/config version after publication, even if stale. This avoids repeated snapshots enabling subtraction; threshold suppression and banding are not claimed as formal differential privacy. Different months contain disjoint Booking cohorts, though people may recur.
- No releasable cells: persist insufficient_data without a provider call. Do not return threshold-distance counts. Later source/policy changes mark the report stale but cannot reveal newly released cells in the same month. A future product decision is required for any revised publication policy.

## AI, persistence and lifecycle

SQL/policy code establishes eligibility, cohort gates, rounded intervals and candidate labels before any provider request. Provider receives only month, approved taxonomy and released intervals, no IDs/names/free text. Output is a strict, bounded list selecting existing candidates with fixed reason enums. Quantities and Vietnamese explanation labels come from code; there is no generated prose containing unverifiable numbers. Suggestions mean observed booking demand, not search preference or guaranteed prediction.

One shared report row per month is also the durable job. Unique month enforces a single release. Source hash, policy/config/provider/model/prompt version, source window, generated time and released payload are stored separately from operational lease fields. The hash is private, based on relevant eligible source tuples including identities; no source rows/identities are persisted or exposed. Public version is an opaque report identifier. Reads recompute current source/policy identity to mark stale, including late corrections/refunds/deletions after month close. Published cells remain frozen; deleted source accounts trigger withholding of the stored report rather than republication if the current privacy gates no longer pass.

POST returns 202 while the shared job is pending/running, otherwise 200. Workers claim using FOR UPDATE SKIP LOCKED, a single global active lease, sixty-second lease, twenty-second heartbeat and token/expiry fencing on completion. At most three provider attempts per month with persisted retry delays and a sixty-second creation cooldown; no client force/retry/model/policy override. Transient transport/5xx retry; invalid output, quota/billing and provider 4xx are terminal. SDK retries disabled, twelve-second AI timeout, fifteen-second API transport timeout. Frozen insufficient_data reports consume no attempts. Worker recovery is autonomous after process death. No exactly-once provider billing guarantee is claimed.

## HTTP contract (JWT, current active Host role)

- POST /api/host/demand-insights/:month with {} → `{version,month,status,reused}`. HTTP 202 for pending/running; HTTP 200 for succeeded/failed/insufficient_data, including exhausted attempts and repeated terminal POST. Reuse never resets attempts or charges again. A synchronous insufficient_data decision returns 200 immediately. POST contains no cells and reports persisted job status; use GET for current release visibility. month is YYYY-MM; open/future/out-of-range months return 422.
- GET /api/host/demand-insights/:month → report status (pending/running/succeeded/failed/insufficient_data/withheld), month/window, version, generatedAt, stale, granularity and released cells/suggestions. `withheld` means a previously successful release no longer passes current privacy gates; `insufficient_data` means no release was generated initially; `failed` means generation failed. Pending/running/failed/insufficient_data/withheld expose empty cells/suggestions and null granularity. Failed reports expose `errorCode=analysis_unavailable`, other statuses expose null. Missing report → 404.
- No provider keys, private source hash, Host/Trip/Booking/booker IDs, names, exact counts or raw exception bodies in public responses. Polling is client-owned in CTMS-416 and stops on terminal status.

| HTTP | Meaning / client action |
| --- | --- |
| 401 | Missing, expired or invalid JWT, or inactive/deleted authenticated account under existing auth policy; reauthenticate. |
| 403 | Active authenticated account lacks Host role; do not retry automatically. |
| 404 | Valid month has no report yet; offer generation. |
| 422 | Invalid/open/out-of-range month or unsupported body fields; correct request. |
| 429 | Another non-empty report was created within the persisted sixty-second cooldown. JSON includes retryAfterSeconds; Retry-After header contains the same integer seconds. |
| 500 | Unexpected API/configuration/DB failure; no provider body is exposed by this feature. |

POST and GET set Cache-Control: no-store. CTMS-416 should poll no faster than once per five seconds while pending/running, pause in hidden tabs, stop on terminal status and refresh terminal reports only on explicit navigation/refresh. GET currently re-evaluates eligibility and hashes on every call to avoid stale cached privacy decisions; no cache or server read throttle is claimed. Additive partial indexes cover eligible Booking.created_at/id and non-failed refund Payment.booking_id; existing relation/primary indexes support joins. This bounds normal UI polling but does not protect against abusive clients: gateway rate limits and production query/load measurement remain deployment work. A cached future implementation needs an explicit privacy-withdrawal latency budget.

## Accepted limitations and release follow-ups

- Stale/withheld transitions themselves reveal that some source or policy condition changed. A Host may know its own contribution and narrow the remaining interval. Fixed windows, suppression and ten-wide intervals reduce these channels; they are not differential privacy and do not eliminate inference with auxiliary data.
- The first eligible POST freezes the shared publication only after DEMAND_MIN_DAYS_AFTER_CLOSE full 24-hour days have elapsed from the Vietnam month-close boundary. The initial engineering default is three days (valid configuration: integer 1–31); this default still requires product-owner confirmation before production release. Earlier creation returns 422 with code=period_not_settled and availableAt, creates no row and makes no provider call. Existing reports can still be read/reused after policy changes. There is no scheduled release. Late corrections beyond this delay can still mark stale or withdraw the release and cannot amend it; product ownership must accept the remaining immutable-publication tradeoff and confirm the 10/3/75% defaults.
- The private source fingerprint currently uses SHA-256 over relevant eligible tuples including UUIDs. It is never returned to Hosts/provider. A database compromise plus auxiliary source knowledge could permit candidate testing; keyed HMAC with separately managed/rotatable server secrets is recommended hardening and is not claimed implemented.
- Public version is an opaque report UUID, not a Host/Trip/Booking/booker identifier. CTMS-416 may use any active real Host account because reports are shared; synthetic seed identities have no usable login password. Render bookerBand as an interval and describe observed booking demand, never an exact count, search preference or guaranteed forecast.

## Verification requirements

Unit tests: 9/10 bookers, 2/3 Hosts, repeated booker, dominance, coarsening, no parent totals, banding, month boundaries, strict provider selection and no invented numbers/actions. Real PostgreSQL integration: eligibility/refunds/deletion, Host access, concurrent creation/claim, lease takeover/late writes, retries, shared report and immutable publication/stale. Python: strict input/output, taxonomy, no identities, refusal and provider errors. Run appropriate type/lint/build gates and regressions; evidence outside Git, seeds only main.seed.ts. Remote CI and live provider availability must be reported separately.

## Configuration and local commands

`DEMAND_MIN_DAYS_AFTER_CLOSE=3`, `DEMAND_MIN_BOOKERS=10`, `DEMAND_MIN_HOSTS=3`, `DEMAND_MAX_HOST_SHARE=0.75`, `DEMAND_CONFIG_VERSION=v1`, `DEMAND_WORKER_ENABLED=true`. The implementation fails closed below the approved privacy floors (10/3), above a Host share of 0.8, or for non-finite/invalid values. Increase the minimums or tighten dominance as needed; changing release policy/config marks existing reports stale and does not permit republication. Prompt is code-controlled `demand-v1`. The API/AI use existing `REVIEW_ANALYSIS_PROVIDER`, `REVIEW_ANALYSIS_MODEL`, `AI_SERVICE_URL`, and `AI_REVIEW_SERVICE_TOKEN`; provider credentials remain in the AI process only. Docker Compose forwards demand policy settings to the API.

From the repository root:

```powershell
pnpm --filter @ctms/api exec jest demand-insights --runInBand
pnpm --filter @ctms/api exec jest --config ./test/jest-integration.json --runInBand demand-insights.integration-spec.ts
pnpm --filter @ctms/api exec ts-node src/seeds/main.seed.ts --demand-insights-only
pnpm run lint:all
pnpm run build:all
```

The dedicated seed flag is additive and development-only. It supplies the previous closed month with two taxonomy cells, twelve synthetic distinct bookers and three synthetic Hosts per cell, never generated AI results. Repeating it does not rewrite existing rows. Do not use the destructive default seed command. Read-only endpoints require an active existing Host session; seed users have random unknown passwords and are not login accounts. The report month for the 2026-11-06 seed is `2026-10`.

POST /api/host/demand-insights/2026-10 → 202 if queued or 200 if already terminal; poll GET on the same path until terminal. Insufficient_data consumes no provider call. No UI or auto-Create-Trip navigation is included in CTMS-415.

## Completed verification — 2026-11-06

- API unit regression: 163 suites / 1,941 tests passed, including 39 demand policy/provider cases.
- Real PostgreSQL integration: 3 suites / 75 tests passed (20 demand, 29 review analysis, 26 Trip review cases). Provider edge is fake in these tests. Deliberate audit-failure rollback logs in Trip review tests are expected inputs.
- Python AI regression: 56 tests passed, one Starlette/AnyIO dependency deprecation warning.
- `lint:all` and `build:all` passed; lint reports 12 warnings in unchanged web files. Targeted Biome and whitespace checks passed.
- API TypeScript was explicitly checked with `node node_modules/typescript/bin/tsc --noEmit`; Docker Compose interpolation/schema was explicitly checked with `docker compose config --quiet` (exit 0). Neither command starts containers or establishes deployed health.
- One live internal AI-route request with synthetic aggregate cells returned HTTP 200 and two validated Gemini suggestions. This verifies the real provider boundary, not the full live Nest→DB→AI worker chain or demand predictive accuracy.
- Additive seed ran twice on the local development database without resetting data. Test cleanup/migration used guarded ctms_test; development migration was additive.
- No frontend files changed; full web/test:all wrapper was not rerun for this backend task and is not claimed green. Remote CI has not run. Existing artifacts/ is untouched and must not be committed.

### Follow-up verification after HTTP contract clarification

The twenty demand PostgreSQL cases were rerun successfully with terminal POST 200, pending POST 202, withheld visibility, persisted reuse and matching Retry-After header assertions. On 2026-11-06 a separate local Nest server (3015), real development PostgreSQL and a separate AI server (8015) exercised the full real chain using an existing active Host and additive synthetic Booking sources for 2026-10. HTTP POST returned 202, polling observed pending/running (including autonomous transient retry), then succeeded with two released cells and two validated Gemini suggestions. Repeated terminal POST returned 200 with the same version and no new job. No report was reset or fabricated. The report remains in the development DB; this smoke is live workflow evidence, not production privacy/load validation or proof of forecasting accuracy. Test scripts/evidence remain outside Git.

### Final affected-test rerun and commit status — 2026-11-06

After adding stabilization and clarifying HTTP/withheld behavior, demand and review-analysis unit suites were rerun together: 4 suites / 73 tests passed (45 demand and 28 review analysis). These are incremental results, not a fresh full 1,941-test regression. The earlier lint:all/build:all results above predate these final edits; current validation is reported separately. No claim of a newly green full web/test:all or remote CI is made. Git status and git diff --cached --stat were checked: nothing is staged, including artifacts/ or external evidence. The dedicated demand seed is called only by the explicit --demand-insights-only early-return path; the default seed path does not invoke it. No commit/push is authorized by this review message or performed.

Outstanding before production release: product-owner confirmation of stabilization duration and privacy defaults and acceptance of the immutable-publication/residual inference limits. Keyed HMAC remains unimplemented security hardening; scheduled generation, server GET rate limits/load validation and a source-correction republication policy remain unimplemented. These follow-ups are recorded here rather than only in chat.

Final incremental checks after stabilization: 2 PostgreSQL suites / 50 tests passed (21 demand, 29 review analysis); API tsc --noEmit, demand ESLint and docker compose config --quiet all exited 0. The successful live end-to-end smoke above preceded the stabilization change; the new creation gate was subsequently verified with unit boundary and real PostgreSQL HTTP tests, without another paid provider call. Full lint/build were not rerun after the gate addition.

### Full regression request — 2026-11-06

The literal `pnpm run test:all` was started. Its API phase completed successfully: 163 suites / 1,947 tests passed. Its default web `vitest run` emitted only its startup line and made no reported test progress for several minutes; the wrapper was interrupted and is **not** marked passing. A separate full web run with `pnpm exec vitest run --pool=threads --maxWorkers=2 --no-cache` completed successfully: 240 files / 1,568 tests passed in 311.29 seconds. The earlier intermittent Porter navigation failure did not recur in this run. Thus the latest API and separate full web regressions pass, while the default wrapper's stall remains unexplained. This is local evidence, not remote CI. The web log is stored outside Git.

Diagnostic follow-up: a single geometry test passed under both forks and threads. A subsequent full standalone web run using its default pool/cache (only verbose reporting added) completed with exit 0 without code/configuration changes. Thus a deterministic forks defect was not demonstrated. The earlier wrapper ran API Jest and web concurrently; startup resource contention is a hypothesis only, not a confirmed root cause. No test runner configuration was changed as a workaround. Standalone success does not retroactively make the interrupted wrapper pass.
