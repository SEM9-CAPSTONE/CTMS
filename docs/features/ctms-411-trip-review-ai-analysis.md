# CTMS-411 — Analyze Trip Reviews with AI: Preparation + Logic

## Approved scope

Story CTMS-295 / specification CTMS-107. Backend logic only; CTMS-412 owns UI. Based on develop `38d4458e`, which includes CTMS-388. Sources read: Jira CTMS-295/411, CTMS-107/105/092 specs, project prompt, repository instructions, architecture, review/revision and content-report implementation, existing Nest-to-FastAPI weather provider. The generic E-Hub skill instructions do not match CTMS TypeORM; no Prisma, i18n framework or queue dependency was introduced.

One item analyzes one eligible Trip review revision. Original comments, ratings, identities, Trip relations, images and numeric reputation are never rewritten. Host/Porter reviews and image interpretation are excluded. Whole-Trip generated narrative is excluded; Trip summaries are deterministic counts from current per-review derived results.

## Persistence and concurrency

Migration `1793900000000-CreateTripReviewAnalyses` adds seven analysis-only tables. It changes no source review table. The unique source/config key deduplicates results; the partial unique Trip index independently limits active batches. A locked Trip control row and DB clock enforce the 60-second cooldown across instances. Repeated requests for an active batch return that batch.

Batch size is 20. Caller starts subsequent batches after completion/cooldown; `remainingCount` and `hasMore` describe remaining selectable items, not running items. Succeeded or terminally failed source/config keys are not charged again. Skipped eligible items can resume below the three-attempt cap. Batch membership freezes terminal status and attempt ranges, so resuming an item cannot rewrite a prior batch's progress/history.

Two DB slot rows enforce at most two valid worker leases across instances. Claims use `FOR UPDATE SKIP LOCKED`; leases last 60 seconds and heartbeat every 20 seconds. PostgreSQL timestamps are copied inside the database to preserve microsecond precision. Completion verifies token, attempt and unexpired item/slot leases, locks participation before source revision, and conditionally writes in that same transaction. A five-second lock timeout bounds worker lock waits. Late or replaced workers cannot commit a result.

Provider timeout is 15 seconds; SDK timeout is 12 seconds with SDK retries disabled. Worker permits at most three attempts, with 5s/30s delays. Transport, transient rate-limit 429 and 5xx errors retry; invalid output, refusal, provider 4xx and missing configuration are terminal. Fixing a terminal configuration problem requires a new server config version to re-analyze that source; there is no client force/bypass flag. Lease expiry is recorded and retried within the same cap. No exactly-once external billing guarantee is claimed.

## Eligibility, currentness and privacy

Selection and reads share one eligibility predicate: Trip target, matching Booking/Member/Trip linkage, completed actual participation, nonblank comment, no privacy suppression and no non-Rejected `trip_review`/legacy `review` report. Analysis is not limited by the review creation/edit deadline.

Every read checks revision, server provider/model/config/prompt and eligibility. Pending/Reviewing/Actioned reports exclude insights; Rejected does not. Reports do not hide/delete raw reviews. Coverage and aggregation run in one REPEATABLE READ snapshot. Eligible count equals analyzed + pending + failed + stale + unprocessed; excluded is outside the denominator. Topic denominator is analyzed count. No-results responses contain zero counts and empty collections, not errors.

Only redacted comment and server run settings reach the AI service. No review/Trip/Booking/reviewer identifiers, stars, pictures or report reasons reach the provider. Common emails/phone spans are masked on input and output; this is best effort, not complete personal-data detection. Review text remains untrusted data and the provider has no tools. Strict JSON Schema plus independent Python/Nest validation enforce fixed sentiment/topic categories, bounds and no extra keys. Source: [official Structured Outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat).

Admin `redact` scrubs derived fields, hashes and provider request metadata, suppresses later processing and fences in-flight workers. Operational metadata/audit may remain; raw review erasure is owned by the existing source workflow. Source revision deletion cascades derived items when deletion is otherwise permitted. No new raw-review deletion workflow was added.

## API for CTMS-412

All routes require JWT and current active DB authorization. Host accesses owned Trips; Admin accesses all. Another Host's Trip returns 403; unknown Trip/batch returns 404.

| Method/path | Result |
| --- | --- |
| POST `/api/trips/:tripId/review-analysis-batches` with `{}` | 202: batch metadata, reused, remainingCount, hasMore; 429 includes retryAfterSeconds |
| GET `/api/trips/:tripId/review-analysis-batches/:batchId` | Batch, per-state progress, up to 20 items, per-item attempts/history/current/analysis and remaining selection count |
| GET `/api/trips/:tripId/review-analyses?page=1&limit=20` | Configuration, snapshot coverage, sentiment counts, topic frequencies, current items and pagination; max limit 50 |
| POST `/api/trip-review-analyses/:reviewId/redact` with `{}` | Admin-only derived privacy erasure/suppression |

Sentiments: positive, neutral, negative, mixed. Topics: organization, guide_support, safety, itinerary, scenery, facilities, value, communication. Maximum five unique topics; summary maximum 500 code points; finite confidence 0–1. Confidence is derived model output, not a numeric reputation score.

## Configuration and running

- API: `AI_SERVICE_URL`, `AI_REVIEW_SERVICE_TOKEN`, `REVIEW_ANALYSIS_MODEL` (existing gpt-4o-mini default), `REVIEW_ANALYSIS_CONFIG_VERSION` (v1), `REVIEW_ANALYSIS_WORKER_ENABLED` (true outside tests). Prompt version v1 is code-controlled.
- AI service: same strong `AI_REVIEW_SERVICE_TOKEN` plus `OPENAI_API_KEY` in the AI process/container. `/review-analysis` requires `X-CTMS-AI-Token`; no provider key is sent to Nest. Missing configuration fails explicitly, never fabricates insights. Docker Compose and `.env.example` declare names only.
- Local AI process: activate its environment and run `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`; export the required secrets to that process first. Start Nest normally after applying the additive migration. Deploy API/AI together when bumping prompt/config versions.
- Existing CTMS-388 additive review scenarios in `main.seed.ts` can supply source comments. No new seed file, destructive seed or generated AI result seed was added. No development database reset was performed.

## Verification — 2026-11-05

- API full unit regression: 157 suites / 1,826 tests passed, including 28 policy/provider unit tests.
- PostgreSQL regression: 3 suites / 102 tests passed (review-analysis, trip-reviews, content-reports); 23 analysis integration cases. Uses guarded `ctms_test`. Rollback test exceptions in other suites are intentional test inputs.
- Python AI service regression: 42 tests passed, one dependency deprecation warning. Existing weather endpoints/tests remain passing.
- `pnpm run lint:all` and `pnpm run build:all`: passed; 12 existing warnings in unchanged web files. Targeted Biome, API TypeScript check and whitespace check passed.
- Integration retains real HTTP authorization, PostgreSQL transactions/constraints/locks and queue logic; the provider edge is fake. Python tests exercise the real route/service with a fake SDK edge. They do not establish live-model accuracy or availability.
- Tests cover concurrent batch creation, two slots, over-20 reviews, persisted cooldown, expired-lease takeover, heartbeat precision, lease expiry during source lock wait, source/config/prompt invalidation, report transitions/Rejected reactivation, immutable old batch progress, erasure fencing, strict output and source integrity.
- Full web regression: 235 files / 1,533 tests passed using `pnpm exec vitest run --pool=threads --maxWorkers=1 --no-cache`. The default `test:all` run encountered a web timeout/stall and was interrupted; it is not claimed as passing. No UI, Android runtime or remote CI result is claimed.
- Pre-existing `artifacts/` stays untouched and must not be staged.

Live-check amendment (2026-11-05): exhausted credits and organization/project spend/usage limits are terminal even when HTTP status is 429; no retry until credits/limits are addressed. The actual live attempt returned `credit_balance_exhausted` / `insufficient_quota`; OpenAI credentials are configured locally but OpenAI live analysis remains blocked by credits. Gemini live validation is documented below. Secrets were moved from the tracked example file into ignored root `.env`; example values were restored to empty.


### Gemini provider support (2026-11-05)

Review analysis supports `REVIEW_ANALYSIS_PROVIDER=openai|gemini` (default `openai`).
For Gemini, set `GEMINI_API_KEY`, `REVIEW_ANALYSIS_PROVIDER=gemini`,
`REVIEW_ANALYSIS_MODEL=gemini-3.1-flash-lite`, and
`REVIEW_ANALYSIS_CONFIG_VERSION=gemini-v1`. Keep API and AI service configuration aligned.
The API reads these values from its process environment; local runs must load the root `.env`
or configure the same non-secret review settings in `services/api/.env`.
Gemini uses Google's fixed OpenAI-compatible endpoint through the existing SDK;
no additional dependency, schema migration, source review changes or UI are required.
The internal shared token, strict output validation, PII redaction, timeouts, batch/lease
fencing and history rules remain in effect. Provider/model/config are part of result
identity, so switching provider does not reuse old provider results as current.
Weather advisory continues to use its existing OpenAI configuration.
Official compatibility guide: https://aistudio.google.com/docs/openai

A live synthetic-comment smoke test succeeded with `gemini-3.1-flash-lite`,
returning valid mixed sentiment, taxonomy topics, summary and token usage.
This verifies the provider edge, not the complete API/DB batch workflow or UI.

## CTMS-411 Backend Update — 2026-11-07 (Review Intelligence, Moderation & Analytics)

### Scope of Update
Expands the AI review analysis capabilities with:
1. Multimodal review moderation scan pipeline (`POST /review-moderation-scan`) across 4 channels (text flags, visual checks, aspect sentiments, incident signals) with transactional outbox (`trip_review_moderation_outbox`).
2. Host review moderation queue and decision workflow (`POST /api/host/trip-reviews/:reviewId/decisions`) supporting `keep`, `hide`, `restore`, `keep_hidden` with pessimistic locking, revision fencing, and physical image quarantine (`uploads/quarantine/`).
3. Host Review Intelligence & Safety Analytics Dashboards:
   - `GET /api/host/review-analytics/trips-overview`: Aspect sentiments (safety, guide support, equipment, value) with minimum sample threshold 5.
   - `GET /api/host/review-analytics/routes-safety-overview`: Incident signals (`fall_slip`, `injury`, `lost_path`, `weather_hazard`, `other`) with minimum sample threshold 10 and invariant `COUNT(DISTINCT review_id)`.

### Verified Local Results (2026-11-07)
- 55 unit tests passed across moderation, outbox worker, PII masker, storage service, host service, and analytics.
- 54 integration tests passed across all 4 PostgreSQL test suites (`trip-reviews`, `trip-review-moderation`, `trip-review-moderation-host`, `trip-review-analytics-host`).
- Regression `review-analysis.integration-spec.ts`: 29/29 tests passed.
- Strict Type Safety: Zero `any` usage.
- Clean build: `pnpm --filter @ctms/api build` passed (Exit code 0).

