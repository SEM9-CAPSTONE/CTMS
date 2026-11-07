# CTMS-092 — Review Trip and Host after Trip

User-approved amendment, 2026-11-04 (CTMS-388): create within 72 hours after `booking.completed_at`; edit each review within 24 hours after its initial `created_at`. Editing never renews the deadline, and can remain available after creation expires. Both deadlines are exclusive. Up to five JPEG/PNG/WebP images (5 MB each) may be attached per review. Only reviewer-owned uploads are accepted; revisions retain prior image lists. Porter remains a separate story.

## 1. Overview

Story: CTMS-092

Epic: EPIC 16. Reviews and Feedback

Use Case: Review Trip and Host after Trip

Priority: Should Have

Goal: Allow a Camper who actually completed a Trip to review that Trip and its actual Host within the approved review window.

Backlog story: As a Camper, I want to review the Trip and actual Host after completing the Trip so I can share my experience.

Acceptance Criteria:

| Source  | Criterion                                                                                                               |
| ------- | ----------------------------------------------------------------------------------------------------------------------- |
| PB AC-1 | Only a Camper with an actually completed Booking/participation may create the review.                                   |
| PB AC-2 | Review may be created only within 72 hours after `booking.completed_at`.                                                |
| PB AC-3 | Review is associated with `trip_id`.                                                                                    |
| PB AC-4 | Backend derives `host_id` from the Trip; client cannot select an unrelated Host.                                        |
| PB AC-5 | One reviewer may create at most one review for the same target within the same participation.                           |
| PB AC-6 | Rating must be an integer from 1 to 5.                                                                                  |
| PB AC-7 | Rating/comment must pass validation.                                                                                    |
| PB AC-8 | Camper may edit each own review within 24 hours after its initial created_at.                                                        |
| PB AC-9 | After 24 hours from initial submission, Camper cannot edit the review; moderation remains separate. |

## 2. Scope

### In Scope

- Completed-participation eligibility.
- Trip review.
- Actual Host relationship.
- 72-hour review window.
- Rating 1–5.
- Comment validation.
- Duplicate prevention.
- Owner edit within review window.

### Out of Scope

- Porter review — CTMS-093.
- Moderation handling — CTMS-105 (Admin moderation workflow remains separate; Host moderation extension added under CTMS-387).
- AI review analysis — CTMS-107 (Whole-trip AI batch analysis remains separate; review-level intelligence and moderation pipeline added under CTMS-387).
- Host selection by client.

## 3. Actors & Authorization

Primary actors:

- Camper: creates and edits own review within approved windows.
- Host: views review moderation queue and performs review moderation actions on reviews of owned trips:
  - `keep` (Giữ lại) và `hide` (Ẩn): Chỉ áp dụng khi review có ít nhất một cờ kiểm duyệt AI đang active trên revision hiện hành.
  - `restore` (Khôi phục) và `keep_hidden` (Duy trì ẩn): Chỉ áp dụng khi review đang ở trạng thái ẩn (`moderation_status = 'hidden'`).

Camper must have completed Booking/participation for the Trip.
Host must be the organizer of the Trip associated with the review.

Backend verifies reviewer identity and participation for Camper, and trip ownership plus active AI flags (for keep/hide) or hidden state (for restore/keep_hidden) for Host.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-038.

Booking/participation is completed.

Current time must be within:

`booking.completed_at + 72 hours`

for Camper creation. Owner editing remains available until the initial review `created_at + 24 hours`.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-297     | A Trip review may be created only by a Camper with an actual completed Booking/participation and only within 72 hours after booking.completed_at. The review must reference trip_id and a reviewer identity verified by the backend.                                                                                                                                                |
| BR-298     | A Host may be reviewed only through a Trip the Host actually organized. The backend must derive host_id from trip_id and must not allow the client to select an unrelated Host.                                                                                                                                                                                                     |
| BR-300     | A reviewer may create at most one review for the same target within the same Trip participation. Duplicate submissions must be rejected or handled idempotently. A Camper may edit their own review within 24 hours after its initial created_at; after that window, the Camper may no longer edit it, although moderation may still be performed according to policy. |
| BR-301     | rating must be an integer from 1 to 5. Both rating and comment must pass validation, and the original user review must be preserved unchanged as the authoritative input.                                                                                                                                                                                                           |
| BR-188     | Absolute timestamps must be stored as timestamptz. Pure calendar dates use date, and time-of-day values use time where defined by schema. APIs must transmit timezone/offset explicitly, and the UI must display values using the configured timezone.                                                                                                                              |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                                                                               |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                                                                                        |
| BR-471     | Automated AI pipeline scans review text and attached images across four independent channels (text, image, aspects, and incidents) for every review revision satisfying `MODERATION_SCAN_ELIGIBLE`. Each channel status is recorded independently. AI only flags potential issues and extracts structured signals; it does NOT make conclusive judgments or certifications. Review revisions with empty text and no images have applicable channels set to `not_applicable`. |
| BR-472     | When a Camper edits a review within the 24-hour edit window, all active moderation flags on older revisions are automatically updated to `superseded` in the same database transaction, and an enqueue event for the new revision is generated if `MODERATION_SCAN_ELIGIBLE` is satisfied. |
| BR-473     | A Host may hide a review if and only if three conditions are simultaneously met: (1) Host is the verified organizer of the Trip associated with the review; (2) the review currently has at least one active AI moderation flag; and (3) the decision targets the current review revision. The hiding reason must belong to the approved taxonomy and match an active flag type. Host must view the evidence before deciding. Legitimate criticism or negative feedback is NOT a valid reason to hide. Hiding transitions the review to `moderation_status = 'hidden'`, initiates local file quarantine for attached images, and creates an immutable audit record. Requests violating any condition must be rejected (403, 422, or 409). Concurrent moderation decisions on the same review must be locked and serialized. |
| BR-474     | A Host may decide to Keep (`keep`) a review with active AI flags if the Host organized the associated Trip and the decision targets the current revision. Keeping resolves all active flags on that revision (`lifecycle_status = 'resolved'`) and locks the revision from generating new active flags upon re-scan. The Keep action is an internal moderation resolution and must NOT be displayed publicly as a certification or seal of safety/quality. |
| BR-475     | A Host may restore a previously hidden review or maintain its hidden state (`keep_hidden`) targeting the current revision. Restoring transitions the review to `moderation_status = 'visible'`, marks image storage for restoration (`restore_pending`), and resolves active flags. If the review has an associated report with status `actioned` (handled by Admin), the Host restore decision is recorded but `moderation_status` remains `hidden` (`adminActionedOverride = true`) to preserve Admin authority. Decisions with mismatched `expectedRevision` must be rejected with 409 Conflict. Restoring a review that is not hidden is rejected. |
| BR-476     | Hidden reviews (`moderation_status = 'hidden'`) are excluded from public review listings, public average ratings, and public review count calculations in future public review endpoints; the count of hidden reviews is exposed transparently (`hiddenReviewsCount`). A Camper's own private review count is never decremented when their review is hidden. Hiding a review on a Trip does not hide the Host review from the same Booking, and vice versa. |

## 6. State & Lifecycle

Completed participation
→ review window opens
→ review created (visibility: visible)
→ optionally edited by Camper within 24h
→ automated AI scan on revision
  ├─ Không có cờ hiện hành (hoàn tất mọi kênh áp dụng): review tiếp tục hiển thị bình thường
  ├─ Kiểm tra chưa hoàn tất (có kênh lỗi hoặc unsupported): hiển thị thông báo chưa hoàn tất kiểm tra kênh tương ứng
  └─ Có cờ hiện hành: xuất hiện trong hàng đợi kiểm duyệt của Host
      ├─ Host Giữ lại (Keep): cờ active được giải quyết, review tiếp tục hiển thị (không hiển thị như chứng nhận)
      ├─ Host Ẩn (Hide): review chuyển sang ẩn, ảnh bị quarantine vật lý
      │    ├─ Camper sửa trong 24h: sinh revision mới, quét lại AI độc lập
      │    ├─ Host Khôi phục (Restore): review hiển thị lại, ảnh restore_pending
      │    └─ Host Duy trì ẩn (Keep Hidden): review tiếp tục ở trạng thái ẩn
→ creation closes after 72 hours from completion
→ editing closes 24 hours from initial submission.

Review moderation lifecycle is extended by CTMS-387 as detailed in Section 14.

## 7. Business Flow

1. Camper opens completed Booking/Trip.
2. Backend verifies completed participation.
3. Verify current time is within 72 hours of `booking.completed_at`.
4. Resolve Trip.
5. Backend resolves actual Host from Trip.
6. Check duplicate review.
7. Camper enters integer rating 1–5 and optional/required comment according to validation.
8. Validate input.
9. Create review.
10. Camper may edit own review while its independent 24-hour edit window remains open.
11. After window expiry, reject Camper edit.

## 8. Data & Invariants

Review preserves:

- reviewer identity;
- participation/Booking context;
- trip_id;
- backend-derived host_id;
- rating;
- original/raw comment;
- creation/update time.

Invariants:

- `1 ≤ rating ≤ 5`;
- rating is integer;
- Host must derive from Trip;
- maximum one review per reviewer/target/participation;
- Camper creation window = 72 hours after `booking.completed_at`; editing window = 24 hours after initial review `created_at`.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                           | Expected Behavior                   |
| ------------------------------ | ----------------------------------- |
| Booking not completed          | Reject                              |
| Completed but >72h             | Reject create                       |
| Client supplies unrelated Host | Ignore/reject; backend derives Host |
| Rating 0 or 6                  | Reject                              |
| Non-integer rating             | Reject                              |
| Duplicate submit               | No duplicate review                 |
| Edit own review within 24h of submission     | Allowed                             |
| Edit after 24h of submission                 | Reject                              |
| Edit another Camper's review   | Reject                              |

## 11. Acceptance & Test Matrix

| Source | Scenario                           | Expected Result    | Test Type   |
| ------ | ---------------------------------- | ------------------ | ----------- |
| BR-297 | Completed participation within 72h | Review allowed     | E2E         |
| BR-297 | >72h                               | Rejected           | Boundary    |
| BR-298 | Client chooses unrelated Host      | Not accepted       | Security    |
| BR-300 | Duplicate submit                   | One review maximum | Idempotency |
| BR-301 | Rating 1–5 integer                 | Accepted           | Validation  |
| BR-301 | Rating outside range               | Rejected           | Negative    |
| BR-300 | Edit within window                 | Allowed            | Functional  |
| BR-300 | Edit after window                  | Rejected           | Boundary    |
| BR-471 | Valid revision with text and images scanned | Runs created with independent channel statuses | Unit / Integration |
| BR-471 | Revision with blank text and no images | Scan statuses marked not_applicable, no AI execution | Boundary / Validation |
| BR-471 | Provider error or unsupported image | Marked failed/unsupported, not treated as passed | Error Handling |
| BR-471 | Provider returns malformed schema output | Scan marked failed, invalid output rejected | Negative / Schema |
| BR-471 | Quote does not match masked source text | Quote validation fails, run marked failed | Integrity / Validation |
| BR-472 | Camper edits review with active flag | Old flag marked superseded, new revision scanned | Concurrency |
| BR-472 | Concurrent edit with stale expectedRevision | 409 Conflict rejected | Concurrency |
| BR-472 | Worker completes scan on obsolete revision | Flags saved with superseded status (no active flag on old rev) | Concurrency / Fencing |
| BR-473 | Host hides review with active AI flag, ownership, and matching revision | Review hidden, images quarantined, audit logged | Integration |
| BR-473 | Host attempts to hide review without active AI flag | 422 Unprocessable Entity rejected | Validation |
| BR-473 | Host selects reason not matching active flag type | 422 Unprocessable Entity rejected | Validation |
| BR-473 | Host attempts to hide review using stale revision | 409 Conflict rejected | Concurrency |
| BR-473 | Host attempts to hide review on another Host's trip | 403 Forbidden rejected | Security |
| BR-473 | Concurrent moderation decisions on same review | Row locked, second request rejected with 409 Conflict | Concurrency |
| BR-474 | Host keeps review with active flag | Active flags resolved, review remains visible, no certification displayed | Functional |
| BR-474 | Re-scanning revision already resolved (Kept) | Does not generate new active flags | Idempotency |
| BR-475 | Host restores review with matching expectedRevision | Review restored, image state restore_pending | Functional |
| BR-475 | Host attempts to restore review that is not hidden | 409 Conflict / rejected | Negative |
| BR-475 | Host restores review with mismatched expectedRevision | 409 Conflict rejected | Concurrency |
| BR-476 | Review hidden excluded from public queries (future) | Future public listings exclude hidden reviews; hiddenReviewsCount reported | Directional / Schema |
| BR-476 | Camper retrieves own review summary (current) | Private review count unaffected | Functional |
| BR-476 | Dashboard analytics query (current) | Hidden reviews excluded from dashboard calculations | Functional |
| BR-476 | Trip review hidden | Host review from same Booking remains visible | Functional |

## 12. Open Decisions

Technical design approved for CTMS-387: comment is optional, with a maximum of 2,000 Unicode characters after trimming outer whitespace. Blank input becomes null. Rating remains required and must be an integer from 1 to 5.

## 13. Implementation — CTMS-387 (Preparation + Logic)

- Separate `trip` and `host` targets each have their own rating/comment. The backend derives both target IDs from the Booking's Trip. One review is allowed per reviewer/Booking Member/target; the unique constraint protects concurrent submissions.
- Only a linked `booking_members.user_id` may act for that participation. Booking ownership alone is insufficient. A completed Booking, non-future `completed_at`, member status `joined`, check-in at or before completion and no `left_at` are required. Anonymous members, no-shows, removed/registered members and early leavers cannot review.
- Creation uses `[completed_at, completed_at + 72 hours)`; editing uses `[review.created_at, review.created_at + 24 hours)`. Each closes at its exact deadline. Database `clock_timestamp()` is read after participation locks so a request waiting across the deadline cannot use transaction-start time.
- Reads expose only the caller's reviews for that Booking. Unknown or unlinked Bookings return 403 without exposing another participant's information. No public review listing, reputation calculation or Host/Admin review editing is introduced in the base Camper review scope (extended for Host review moderation by CTMS-387; see Section 14).
- `trip_reviews` stores the current version, authoritative reviewer/member/Booking/Trip/Host and target context. `trip_review_revisions` retains every content version including the initial submission. Parent foreign keys use RESTRICT to preserve evidence. No delete endpoint is provided.
- Create/edit, revision persistence and `trip_review.created`/`trip_review.updated` audit are atomic. Audit records contain revision/target identities, not review comments. Edits require `expectedRevision`; concurrent stale edits return 409.
- API (JWT + Camper role):
  - `GET /api/bookings/:bookingId/reviews/context`: creation eligibility/reason, per-review `canEdit`/`editExpiresAt`/`images`, `completedAt`, `expiresAt`, `serverTime`, Trip/Host IDs and own current reviews.
  - `POST /api/bookings/:bookingId/reviews`: `{ target: "trip" | "host", rating, comment?, images? }` → 201 current review.
  - `PATCH /api/trip-reviews/:reviewId`: `{ rating, comment?, expectedRevision, images? }` → 200 updated review. This is a complete content replacement: omitted comment clears it.
  - 401 unauthenticated, 403 wrong role/ownership/participation link, 404 missing review, 409 ineligible/expired/duplicate/stale, 422 malformed or extra fields. Errors follow the existing CTMS API exception format.
- Original review content is never replaced by AI. AI analysis, target-specific moderation actions, visibility policy and reputation remain separate tasks in the base story, and are implemented under the CTMS-387 extension in Section 14. Report status alone does not imply a review was hidden.
- No development seed or data reset is required for this backend task. Integration fixtures exist only in the test suite; future seed scenarios must be added to `main.seed.ts`.

- `POST /api/trip-reviews/images`: Camper-owned JPEG/PNG/WebP upload (5 MB), returns URL; create/update accepts at most five owned upload URLs. `GET /api/trip-reviews/summary` returns caller-scoped review counts and creation eligibility.

## 14. Extension — CTMS-387: Review Intelligence, Host Moderation & Analytics

Approved contract: `docs/features/ctms-387-review-intelligence-moderation-contract.md`.
- Automated AI pipeline scans review text and up to five images across four independent channels: `text` (moderation flags), `image` (visual moderation), `aspects` (safety, guide_support, equipment, value sentiments), and `incidents` (fall_slip, injury, lost_path, weather_hazard, other signals).
- AI only flags potential issues and extracts structured data; it does NOT make conclusive judgments.
- Moderation scanning applies to all reviews with text or images (`MODERATION_SCAN_ELIGIBLE`), including reported reviews.
- Host moderation queue surfaces active flags for owned Trips. Each review (Trip target vs Host target) is moderated independently; hiding a Trip review does not hide the Host review of the same Booking.
- Hiding requires an active AI flag, ownership, and revision match; sets `moderation_status = 'hidden'` and initiates file quarantine.
- Host may restore review with matching `expectedRevision`, setting `moderation_status = 'visible'` and `image_storage_state = 'restore_pending'`.
- Host Keep action resolves active flags and prevents re-flagging, but is not displayed publicly as a quality certification.
- Option B1 adopted as a directional query rule for future public rating implementations (CTMS-108): hidden reviews excluded from public star rating calculations, with `hiddenReviewsCount` displayed; Camper's own review summary count (`GET /api/trip-reviews/summary`) is unaffected.
- Known limitations: After the 24-hour edit window expires, Camper cannot edit; thus an erroneously hidden review cannot be self-repaired by the Camper. No appeal workflow is provided in this scope. Conflict of interest risk: Host has an incentive to hide low-star reviews with active AI flags to improve average ratings; this risk is acknowledged and mitigated by audit trails and requiring active AI flags, but is not fully eliminated.
- Dashboards use conservative operational sample size thresholds (5 for Trips, 10 for Route safety). Incident signals differentiate occurred events (`yes`) from warnings (`warning`) and ambiguous mentions (`unknown`). All safety metrics aggregate via `COUNT(DISTINCT review_id)`.
- Safety signals from reviews do NOT constitute Potential Safety Hotspots (CTMS-116/117), do NOT create hotspot candidates, and do NOT use the "hotspot" terminology.
- Layer 2 Image Quarantine: When a Camper edits a review that is currently `hidden`, newly uploaded images go straight to quarantine (`image_storage_state = 'quarantine_pending'` -> `'quarantined'`). Images of prior revisions are preserved in storage/quarantine for audit. A reconciliation background worker handles stuck/failed quarantine states. Action `keep_hidden` (Duy trì ẩn) is available for already hidden reviews.
- Target Isolation: Reviews with `target = 'host'` are scanned by AI moderation, but are strictly excluded from both analytical dashboards (only `target = 'trip'` participates).

## 15. Implementation & API Endpoints — CTMS-387 Layers 1, 2 & 3

### 15.1 API Endpoints Summary

| Layer | Method | Path | Auth / Roles | Purpose |
| --- | --- | --- | --- | --- |
| 1 | `POST` | `/review-moderation-scan` (Python AI Service) | Internal API / Service Key | Multimodal AI scan: moderation flags, visual checks, aspect sentiments, incident signals |
| 2 | `GET` | `/api/host/trip-reviews/moderation-queue` | JWT, Host role | Paginated queue of reviews with active flags or hidden status for owned trips |
| 2 | `POST` | `/api/host/trip-reviews/:reviewId/decisions` | JWT, Host role | Host moderation decisions: `keep`, `hide`, `restore`, `keep_hidden` with concurrency lock |
| 2 | `GET` | `/api/host/trip-reviews/:reviewId/quarantined-images/:imageIndex` | JWT, Host role | Stream quarantined evidence image for Host inspection with immutable audit log |
| 3 | `GET` | `/api/host/review-analytics/trips-overview` | JWT, Host role | Host trip experience intelligence & aspect sentiments (threshold: 5) |
| 3 | `GET` | `/api/host/review-analytics/routes-safety-overview` | JWT, Host role | Host route safety analytics & incident signals (threshold: 10, distinct count) |

### 15.2 Database Migrations & Schemas

- **Migration 1 (`1794500000000-CreateTripReviewModerationPipeline.ts`)**:
  - `trip_review_moderation_runs`: Scan execution runs, statuses, provider metadata, raw outputs.
  - `trip_review_moderation_image_items`: Per-image analysis status, mime types, hashes.
  - `trip_review_moderation_flags`: Granular moderation flags with lifecycle (`active`, `superseded`, `resolved`).
  - `trip_review_aspect_sentiments`: Sentiment extraction across safety, guide support, equipment, value.
  - `trip_review_incident_signals`: Incident occurrences (`fall_slip`, `injury`, `lost_path`, `weather_hazard`, `other`).
  - `trip_review_moderation_outbox`: Transactional outbox for guaranteed asynchronous scanning dispatch.
- **Migration 2 (`1794500000001-CreateTripReviewModerationDecisionsAndStatus.ts`)**:
  - Added `moderation_status` (`visible`, `hidden`) and `image_storage_state` (`active`, `quarantine_pending`, `quarantined`, `restore_pending`, `quarantine_failed`) to `trip_reviews`.
  - `trip_review_moderation_decisions`: Immutable audit trail of Host actions (`keep`, `hide`, `restore`, `keep_hidden`) with reasons, notes, and revision stamps.

### 15.3 Core Invariants & Safety Guarantees

1. **Transactional Outbox & Atomicity**: Review creation and updates atomically write to `trip_review_moderation_outbox` in the same DB transaction. Worker uses `FOR UPDATE SKIP LOCKED` with heartbeat leases.
2. **PII Masking**: Emails, Vietnamese phone numbers (+84/09x), URLs, and citizen IDs are masked with placeholders prior to invoking external LLM providers.
3. **Revision Fencing**: Edits supersede older flags atomically. Worker checks whether current DB revision still matches the outbox job revision; obsolete runs are saved with flags marked `superseded`.
4. **Concurrency Control**: Moderation decisions lock the target review with `SELECT ... FOR UPDATE OF r` and verify `expectedRevision`.
5. **Physical File Quarantine**: Hiding a review isolates image files to `uploads/quarantine/`, preventing direct public access while retaining inspection access for authorized Hosts.
6. **Admin Override Precedence**: If a review has an associated `content_reports` record with status `actioned`, a Host `restore` action logs the decision but preserves `moderation_status = 'hidden'` with `adminActionedOverride: true`.
7. **Strict Analytics Filtering**: Layer 3 dashboards include only `target = 'trip'` reviews with `moderation_status = 'visible'`. Safety aggregates enforce `COUNT(DISTINCT review_id)`.
