# CTMS-107 — Analyze Trip Reviews with AI

## 1. Overview

Story: CTMS-107

Epic: EPIC 16. Reviews and Feedback

Use Case: Analyze Trip Reviews with AI

Priority: Should Have

Goal: Generate derived AI insights from reviews without altering the authoritative user review or numeric reputation input.

Backlog story: As the System, I want to analyze reviews with AI so useful sentiment/topics can be derived while preserving original review evidence.

Acceptance Criteria:

| Source  | Criterion                                                                |
| ------- | ------------------------------------------------------------------------ |
| PB AC-1 | AI analysis creates only derived fields.                                 |
| PB AC-2 | AI must not modify rating, original comment, reviewer, or Trip relation. |
| PB AC-3 | AI sentiment/topic does not replace numeric Camper rating in reputation. |
| PB AC-4 | Re-analysis is allowed when model changes.                               |
| PB AC-5 | Raw review and analysis model/version metadata remain traceable.         |
| PB AC-6 | Reported reviews continue through moderation policy.                     |

## 2. Scope

### In Scope

Derived fields such as:

- sentiment;
- topics;
- summary;
- confidence;
- model version.

### Out of Scope

- Modifying original reviews.
- Replacing rating with AI sentiment.
- Moderation decisions.

## 3. Actors & Authorization

Primary actor:

- System/AI analysis process.

## 4. Preconditions & Dependencies

Review exists.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                  |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-303 | AI review analysis may create only derived fields such as sentiment, topics, summary, confidence, and model_version. AI must not modify the rating, original comment, reviewer, or Trip relationship. |
| BR-304 | AI-derived sentiment or topics must not replace the Camper's numeric rating when calculating reputation. Aggregate rating and AI insight are separate outputs.                                        |
| BR-305 | When the analysis model changes, the system may re-analyze existing reviews. The raw review, metadata, and model version for each analysis result must be preserved for traceability.                 |
| BR-306 | A reported review must be handled through the moderation policy. Review history and audit records must not be hard-deleted during content handling.                                                   |
| BR-471 | Automated AI pipeline scans review text and attached images across four independent channels (text, image, aspects, and incidents) for every review revision satisfying `MODERATION_SCAN_ELIGIBLE`. Each channel status is recorded independently. AI only flags potential issues and extracts structured signals; it does NOT make conclusive judgments or certifications. Review revisions with empty text and no images have applicable channels set to `not_applicable`. |
| BR-472 | When a Camper edits a review within the 24-hour edit window, all active moderation flags on older revisions are automatically updated to `superseded` in the same database transaction, and an enqueue event for the new revision is generated if `MODERATION_SCAN_ELIGIBLE` is satisfied. |
| BR-473 | A Host may hide a review if and only if three conditions are simultaneously met: (1) Host is the verified organizer of the Trip associated with the review; (2) the review currently has at least one active AI moderation flag; and (3) the decision targets the current review revision. The hiding reason must belong to the approved taxonomy and match an active flag type. Host must view the evidence before deciding. Legitimate criticism or negative feedback is NOT a valid reason to hide. Hiding transitions the review to `moderation_status = 'hidden'`, initiates local file quarantine for attached images, and creates an immutable audit record. Requests violating any condition must be rejected (403, 422, or 409). Concurrent moderation decisions on the same review must be locked and serialized. |
| BR-474 | A Host may decide to Keep (`keep`) a review with active AI flags if the Host organized the associated Trip and the decision targets the current revision. Keeping resolves all active flags on that revision (`lifecycle_status = 'resolved'`) and locks the revision from generating new active flags upon re-scan. The Keep action is an internal moderation resolution and must NOT be displayed publicly as a certification or seal of safety/quality. |
| BR-475 | A Host may restore a previously hidden review or maintain its hidden state (`keep_hidden`) targeting the current revision. Restoring transitions the review to `moderation_status = 'visible'`, marks image storage for restoration (`restore_pending`), and resolves active flags. If the review has an associated report with status `actioned` (handled by Admin), the Host restore decision is recorded but `moderation_status` remains `hidden` (`adminActionedOverride = true`) to preserve Admin authority. Decisions with mismatched `expectedRevision` must be rejected with 409 Conflict. Restoring a review that is not hidden is rejected. |
| BR-476 | Hidden reviews (`moderation_status = 'hidden'`) are excluded from public review listings, public average ratings, and public review count calculations in future public review endpoints; the count of hidden reviews is exposed transparently (`hiddenReviewsCount`). A Camper's own private review count is never decremented when their review is hidden. Hiding a review on a Trip does not hide the Host review from the same Booking, and vice versa. Layer 3 dashboards include only `target = 'trip'` reviews with `moderation_status = 'visible'`. Safety aggregates enforce `COUNT(DISTINCT review_id)` with sample size thresholds (5 for Trips, 10 for Route safety). |

## 6. State & Lifecycle

Raw review
→ AI moderation scan (text, image, aspects, incidents)
   ├─ Không có cờ hiện hành: hiển thị bình thường, dữ liệu aspect/incident tham gia dashboards
   ├─ Có cờ vi phạm: hiển thị trong hàng đợi kiểm duyệt của Host
   │    ├─ Host Giữ lại (Keep): cờ được giải quyết (`resolved`), review duy trì hiển thị
   │    ├─ Host Ẩn (Hide): review chuyển thành `hidden`, ảnh cách ly vào `uploads/quarantine/`
   │    │    ├─ Camper sửa bài: cấp revision mới, quét lại độc lập, cờ cũ thành `superseded`
   │    │    ├─ Host Khôi phục (Restore): review hiển thị lại (trừ khi Admin đã actioned)
   │    │    └─ Host Duy trì ẩn (Keep Hidden): duy trì trạng thái ẩn
→ AI trip review batch analysis (CTMS-411 base)
→ derived analysis version
→ optional later re-analysis
→ new derived version/context.

Raw review remains authoritative.

## 7. Business Flow

1. Load eligible review.
2. Preserve raw review unchanged.
3. Run AI analysis.
4. Produce derived fields.
5. Store model/version metadata.
6. Display/use derived insight separately from numeric rating.
7. Re-analyze if model/version changes when required.

## 8. Data & Invariants

Authoritative:

- rating;
- original comment;
- reviewer;
- Trip relation.

Derived:

- sentiment;
- topics;
- summary;
- confidence;
- model_version.

Derived data must not overwrite authoritative fields.

## 9. API / Integration Contract

See section 13 and `docs/features/ctms-411-trip-review-ai-analysis.md` for the approved API and execution contract.

## 10. Error & Edge Cases

| Case                     | Expected Behavior              |
| ------------------------ | ------------------------------ |
| AI disagrees with rating | Preserve rating                |
| Model changes            | Re-analysis allowed            |
| Re-analysis              | Previous traceability retained |
| Reported review          | Moderation still applies       |
| AI fails                 | Raw review remains valid       |

## 11. Acceptance & Test Matrix

| Source | Scenario                      | Expected Result        | Test Type     |
| ------ | ----------------------------- | ---------------------- | ------------- |
| BR-303 | Analyze review                | Derived fields created | Integration   |
| BR-303 | AI output                     | Raw review unchanged   | Integrity     |
| BR-304 | Sentiment differs from rating | Rating unchanged       | Business Rule |
| BR-305 | Model update                  | Re-analysis traceable  | Audit         |
| BR-471 | Multimodal scan across 4 channels | Runs, items, flags, sentiments, signals created | Unit / Integration |
| BR-471 | Revision with blank text and no images | Applicable channels marked not_applicable | Boundary |
| BR-472 | Review edit in 24h window     | Old active flags marked superseded, new revision queued | Concurrency |
| BR-473 | Host hides review with active flag & ownership | Review hidden, images quarantined, audit logged | Integration |
| BR-473 | Host hides without active AI flag | 422 Unprocessable Entity rejected | Validation |
| BR-473 | Host hides review on another Host's trip | 403 Forbidden rejected | Security |
| BR-473 | Concurrent decisions on same review | Row locked with FOR UPDATE, stale revision 409 Conflict | Concurrency |
| BR-474 | Host keeps review with active flag | Flags resolved, review remains visible, no certification | Functional |
| BR-475 | Host restores hidden review   | Review restored, images restore_pending | Functional |
| BR-475 | Host restores review with actioned Admin report | Review remains hidden, adminActionedOverride = true | Authorization |
| BR-476 | Trip analytics overview       | Aggregates aspect sentiments with sample threshold 5 | Analytics |
| BR-476 | Route safety overview         | Aggregates incident signals with threshold 10, distinct count | Analytics |

## 12. Open Decisions

Resolved in section 13: server-configured model, versioned prompt/config and fixed v1 taxonomy. Live provider configuration is operational and must not be committed.


## 13. Approved implementation contract — CTMS-411 (2026-11-04)

### Scope and current results

One analysis item processes one Trip-target review revision with a nonblank comment (up to 2,000 Unicode code points). Participation must remain completed/joined/checked-in, without early departure; the 72h creation and 24h edit windows do not limit analysis of historical reviews. Host/Porter reviews, pictures, numeric reputation and generated whole-Trip narrative are excluded. Host accesses only owned Trips; active Admin accesses all Trips. Unknown Trips return 404; another Host's Trip returns 403.

A successful item is current only when its source revision matches the latest review, provider/model/config/prompt versions match active server configuration, participation is eligible, and no non-Rejected content report targets that review. Supported canonical report target is `trip_review` (legacy `review` is also recognized). Pending/Reviewing/Actioned reports defer analysis; this does not hide or delete raw reviews. Rejected reports do not block it. Currentness is evaluated on every read, including batch items. Aggregates never use stored flags as authority.

Trip aggregation and coverage are computed in one REPEATABLE READ snapshot using the same eligibility predicate. Return eligible, analyzed, pending, failed, stale, unprocessed and excluded counts; eligible = analyzed + pending + failed + stale + unprocessed. Stale is eligible but only has an old revision/config result. Excluded reviews do not enter the denominator. Sentiment counts and topic frequencies use current successful items only; topic denominator is analyzed count. No average AI rating is computed. Empty data returns 200 with zero counts, empty items and zero coverage.

### Durable batches and items (locked before migration)

- `trip_review_analysis_batches`: Trip, requester, DB timestamps, provider/model/config/prompt snapshot and status `pending/running/succeeded/partial/failed`.
- A partial unique index on Trip enforces one batch where status is pending/running, independently of item uniqueness.
- `trip_review_analysis_controls`: one row per Trip; lock it transactionally for batch creation. Its DB-clock last_batch_at enforces one NEW batch per 60 seconds per Trip across instances. Polling/returning an existing active batch does not consume another request. Cooldown returns 429 and retryAfterSeconds.
- `trip_review_analysis_items`: review + source revision, provider/model/config/prompt snapshot, state `pending/running/succeeded/failed/skipped/suppressed`, sanitized derived fields and actual provider model metadata. Unique `(review_id, source_revision, provider, model, config_version, prompt_version)`. FK to existing immutable review revision; no schema/write changes to original reviews.
- `trip_review_analysis_batch_items`: associates items with a batch and freezes terminal status/attempt range when the batch ends. Eligible skipped items may resume under the same source key below the three-attempt cap; succeeded/failed items are not rerun. Frozen membership preserves earlier batch progress/history. `trip_review_analysis_attempts` stores numbered attempts, timing, outcome, sanitized error code, provider request ID and optional token usage; no raw prompt/output/error text.
- Up to 20 not-yet-attempted eligible current revisions per batch, deterministic oldest-created review first. Previously succeeded or terminally failed items for the same source/config are not charged again. At most 3 attempts per item; changing config/prompt/model enables a new analysis item. Client explicitly POSTs subsequent batches after the active batch ends and cooldown permits it. No automatic whole-Trip chaining or force bypass. Responses include remainingCount and hasMore.
- Zero candidates creates a terminal succeeded empty batch; no provider call. A batch succeeds when all items succeed, is partial when some succeed, and fails when none succeed and some fail/skip/suppress. GET returns per-item state and aggregate progress.

### Worker, retry and fencing (locked before migration)

PostgreSQL queue; no new queue dependency. Two fixed DB worker slots bound concurrency across API instances. Claims lock an available slot and item using FOR UPDATE SKIP LOCKED. Item + slot have a random lease token and 60-second lease from DB clock; heartbeat every 20 seconds extends both only while the same token is unexpired. Worker polls every 2 seconds; production enabled by REVIEW_ANALYSIS_WORKER_ENABLED, test default disabled.

Provider hard timeout 15 seconds, no hidden SDK retries. Maximum 3 attempts total; delays 5s then 30s. Retry transport timeout/failure, transient provider 429 and 5xx, except explicit provider_not_configured (terminal). Provider 4xx, refusal and invalid schema are terminal immediately. Expired leases produce a lease_expired attempt and are retried only below the cap. DB slot recovery and item claim are atomic. Late workers must match item+slot token, attempt and unexpired lease; otherwise their write is discarded. This fences DB completion, not a claim of exactly-once external billing after process failure.

Before provider use and at completion validate source revision and eligibility. Completion locks review/member/booking source, rechecks revision, and writes derived data in the SAME transaction. A changed revision is skipped, never published as current. Report rows are re-evaluated on reads, so a concurrent report transition cannot leak an item into the current aggregate. History retains the analyzed revision even when no longer current.

### API for CTMS-412

JWT Host/Admin, authoritative active role and ownership checks on every call:

- POST `/api/trips/:tripId/review-analysis-batches`, empty body, 202: `{batch, reused, remainingCount, hasMore}`. Existing active batch returns 202/reused=true. No client-selected provider/model/config.
- GET `/api/trips/:tripId/review-analysis-batches/:batchId`, 200: batch metadata, `{total,pending,running,succeeded,failed,skipped,suppressed}` progress, max 20 items with attempt metadata and `current`, remainingCount/hasMore. Wrong Trip/batch pairing returns 404.
- GET `/api/trips/:tripId/review-analyses?page=1&limit=20`, limit max 50: current analyses, pagination and coverage/sentiment/topic aggregate from one snapshot. No private reviewer identifiers or raw comments in insight responses.
- POST `/api/trip-review-analyses/:reviewId/redact`, Admin only, empty body, 200: suppress future analysis, cancel queued/running work, null derived content/model request IDs and erase their content hashes. Preserve only non-content operational metadata plus audit reason `privacy_erasure`. No request body allows arbitrary text into audit.

### Data minimization, prompt and erasure

Provider receives only sanitized comment and server-controlled model/config/prompt settings, never reviewer identity, Trip/Booking/review IDs, stars, photos or report reasons. Mask common email/phone patterns before sending AND in summaries. This is best-effort free-text redaction, not a promise of complete personal-data detection. No duplicate raw source comments in analysis tables. No raw review text in logs/audit.

Fixed topics: organization, guide_support, safety, itinerary, scenery, facilities, value, communication. Sentiment enum: positive, neutral, negative, mixed. Max 5 unique topics, summary max 500 Unicode code points, finite confidence in [0,1]. Extra keys forbidden. Review text is untrusted JSON data, never instructions; provider has no tools or write access. Strict JSON Schema plus independent Pydantic and Nest runtime validation; reject rather than coerce invalid categories. Default model follows existing service configuration (gpt-4o-mini); model/config are server configurable, prompt v1 is fixed and validated by AI service.

New AI endpoint is protected by shared `AI_REVIEW_SERVICE_TOKEN` (X-CTMS-AI-Token) and requires provider configuration; missing config returns a sanitized error, never fallback fabricated insights. Python SDK retries disabled; Nest worker owns retries.

History preservation has an explicit privacy exception: Admin derived-erasure endpoint scrubs all analysis content and prevents reprocessing, including results from workers still running. Deleted source revisions cascade removal of derived items where source deletion is otherwise permitted. Existing review deletion/retention policy remains owned by that workflow; CTMS-411 does not introduce raw-review deletion. Ordinary reports only affect currentness; they do not erase history.

### Required verification

Real PostgreSQL tests: concurrent batch creation, partial unique index, per-source unique, DB cooldown, >20 candidates and next batch, SKIP LOCKED claims, two global slots, expired lease takeover/late completion, persisted retries, atomic revision changes, report state changes after success/Rejected inclusion, config/prompt invalidation, snapshot coverage, ownership isolation and erasure fencing. Provider/Python tests: Vietnamese/English, short/blank input, fixed taxonomy/enum, malicious instructions, extra keys, PII redaction, refusal, malformed JSON, 4xx/429/5xx/timeouts and no raw mutation. Run appropriate regression, lint, build and type checks. Live provider verification requires configured credentials and must be distinguished from fakes.

Live-check amendment (2026-11-05): exhausted credits and organization/project spend/usage limits are terminal even when HTTP status is 429; no retry until credits/limits are addressed. The actual live attempt returned `credit_balance_exhausted` / `insufficient_quota`; credentials are now configured locally, but successful live insights remain unverified. Secrets were moved from the tracked example file into ignored root `.env`; example values were restored to empty.


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

## 14. Backend Update — CTMS-411 (2026-11-07): Review Intelligence, Moderation Pipeline & Analytics Dashboards

### 14.1 New Endpoints
- `POST /review-moderation-scan` (Python AI Service): Multimodal AI review moderation and signal extraction.
- `GET /api/host/trip-reviews/moderation-queue`: Host review moderation queue for owned trips.
- `POST /api/host/trip-reviews/:reviewId/decisions`: Host decisions (`keep`, `hide`, `restore`, `keep_hidden`) with concurrency locking (`FOR UPDATE OF r`) and revision fencing.
- `GET /api/host/trip-reviews/:reviewId/quarantined-images/:imageIndex`: Stream quarantined evidence with audit log.
- `GET /api/host/review-analytics/trips-overview`: Host trip experience analytics & aspect sentiments (threshold: 5).
- `GET /api/host/review-analytics/routes-safety-overview`: Host route safety analytics & incident signals (threshold: 10, distinct count).

### 14.2 Schema Additions
- Migrations `1794500000000` & `1794500000001`: `trip_review_moderation_runs`, `trip_review_moderation_image_items`, `trip_review_moderation_flags`, `trip_review_aspect_sentiments`, `trip_review_incident_signals`, `trip_review_moderation_outbox`, `trip_review_moderation_decisions`.
- Review state columns: `moderation_status` (`visible`, `hidden`), `image_storage_state` (`active`, `quarantine_pending`, `quarantined`, `restore_pending`, `quarantine_failed`).

### 14.3 Verified Local Test Results
- **Unit Tests**: 55 passed (`trip-review-` moderation, outbox, worker, pii-masker, host service, storage service, analytics service).
- **PostgreSQL Integration Tests**: 54 passed across 4 test suites:
  - `trip-reviews.integration-spec.ts`: 26 passed
  - `trip-review-moderation.integration-spec.ts`: 11 passed
  - `trip-review-moderation-host.integration-spec.ts`: 12 passed
  - `trip-review-analytics-host.integration-spec.ts`: 5 passed
- **Regression Tests**: `review-analysis.integration-spec.ts` 29/29 passed.
- **Build & Quality**: `pnpm --filter @ctms/api build` passed with Exit code 0, Biome lint clean (0 errors), strict Zero `any` adhered across all new code.


