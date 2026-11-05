# CTMS-412 — Analyze Trip Reviews with AI: UI

## Scope and read contract

Host and Admin web pages consume the CTMS-411 API; the browser does not compute its own aggregate or call the provider. Existing ownership checks apply to every read. No schema or Trip/Route business rules change.

- `GET /api/review-analysis/trips?page=1&limit=10` lists owned Trips for Host and all Trips for Admin. The selector loads subsequent pages on demand.
- Insights accept optional `sentiment=positive|neutral|negative|mixed`, applied before pagination. Coverage, sentiment counts and topics remain global for the selected Trip.
- Insights include `latestBatch`, `retryAfterSeconds` and safe `freshness` counts for review/configuration changes and restricted sources.
- `GET /api/trips/:tripId/review-analyses/:reviewId/source/:revision` returns the authorized source revision, rating, comment and current revision. It excludes reviewer identity and report details; moderation restrictions are checked again on read.

## Interaction

Vietnamese controls support desktop and narrow screens. Six compact results are shown per page; details and original reviews open on demand. React renders source and generated summaries as plain text. Sentiment labels accompany colors and are explicitly separate from star ratings and reputation.

Submission has a synchronous guard as well as a disabled button. Active batches restore from server state after reload. Polling pauses while hidden, stops on terminal status/unmount, and backs off on transient failures. A completed batch refreshes insights once; polling does not reload the full result list. Partial failures retain successful results. HTTP 409 refreshes server state; 429 displays the server cooldown.

Pagination retains the previous result region while loading and reserves its height to avoid jumping to the top. Changing Trips does not reuse another Trip's displayed results.

## Local data and verification

Synthetic Vietnamese reviews live only in `services/api/src/seeds/main.seed.ts`. Additive scenario flags are `--review-analysis-only`, `--review-analysis-vietnamese-only`, and `--review-analysis-video-only`; do not use destructive seed defaults for these scenarios. Generated provider results are persisted by the real application, never seeded as fabricated AI output.

Component/hook tests cover filtering, paging, plain text, source loading, permissions, empty/partial states, duplicate submission, cooldown, polling visibility, completion and backoff. PostgreSQL integration covers authorized reads and source revisions, moderation, batch recovery, global aggregates and freshness. Dedicated Playwright tests distinguish mocked HTTP cases from a read-only local API/database case; the latter requires the seeded Host and completed video scenario. Neither category establishes provider accuracy.

Run focused checks from the corresponding workspace:

```powershell
# apps/web
pnpm exec vitest run src/features/review-analysis --pool=threads --maxWorkers=1 --no-cache
pnpm exec playwright test --config playwright.review-analysis.config.ts

# services/api (guarded ctms_test database)
pnpm exec jest --config ./test/jest-integration.json --runInBand review-analysis.integration-spec.ts
```

Test evidence stays outside Git. Existing `artifacts/` is not part of this feature.

## Verification — 2026-11-06

- API unit regression: 160 suites / 1,899 tests passed.
- PostgreSQL analysis integration: 29 tests passed, including six CTMS-412 read-contract cases.
- Focused web component/hook checks: 15 tests passed.
- Dedicated Playwright: six tests passed (five mocked HTTP scenarios and one local API/database read/reload scenario). Synthetic sessions also isolate Socket.IO authentication from the running real API.
- Full web regression with threads, one worker and no cache completed: 239 files passed / one failed; 1,567 tests passed / one failed. The failure was `AppRoutes.porter-assignments.test.tsx` → `opens the real assignment route when the sidebar item is clicked`. An immediate isolated no-cache rerun passed all nine tests in that file. This is an intermittent navigation-test failure; the original full run is not reported as green.
- `pnpm run build:all` and `pnpm run lint:all` passed. Lint reports 12 existing warnings. Final web TypeScript and targeted Biome checks passed.
- No remote CI result or new paid-provider request is claimed by these checks. Previously persisted Gemini results were read in the live browser test.
