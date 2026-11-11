# CTMS-387 — Review Intelligence, Host Moderation & Analytics Extension Contract

Approved in chat on 2026-11-07. Backend-only on branch `feat/CTMS-387-review-intelligence-moderation-logic`.
No UI, no Admin moderation, no appeal workflow, no hard delete, and no automatic Trip/Route business modifications.

---

## 1. Architecture & Layered Delivery

The implementation is partitioned into three sequential layers:
- **Layer 1 (Pipeline & Intelligence)**: Database schema for analysis runs, image items, moderation flags, aspect sentiments, incident signals, and transactional outbox; Python AI multimodal/text service; NestJS background worker. *(Approved for implementation)*.
- **Layer 2 (Host Moderation & Lifecycle)**: Columns `moderation_status`, `image_storage_state`, `hidden_*` on `trip_reviews`; `trip_review_moderation_decisions` table; `trip_review_moderation_notifications` outbox table; Host moderation queue, actions (`keep`, `hide`, `restore`, `keep_hidden`); local disk image quarantine/restoration; in-app notifications; audit logging; camper-owned image streaming endpoint; reconciliation worker for pending/failed file operations. *(Deferred to Layer 2; schema columns and notification/decision tables postponed to Layer 2)*.
- **Layer 3 (Analytics Dashboards)**: Trip positive feedback overview and Route safety incident signals overview with strict access boundaries, minimum sample thresholds, and deterministic tie-breaking. *(Deferred to Layer 3)*.

**Core Boundary Invariants**:
- **Trip vs Host Independence**: Ẩn review về Trip không tự động ẩn review về Host của cùng một Booking và ngược lại. Hai mục tiêu đánh giá (`target = 'trip'` và `target = 'host'`) có cờ kiểm duyệt, trạng thái hiển thị và quyết định xử lý hoàn toàn độc lập.
- **Dashboard Exclusion for Host Reviews**: Đánh giá có `target = 'host'` được quét đầy đủ qua pipeline kiểm duyệt AI (bảo vệ Host và tuân thủ an toàn), nhưng hoàn toàn KHÔNG tham gia vào hai dashboard phân tích (Dashboard phản hồi tích cực theo Trip và Dashboard tín hiệu an toàn theo Route chỉ tổng hợp đánh giá có `target = 'trip'`).
- **Safety Signal vs Hotspot Boundary**: Tín hiệu an toàn từ review không phải Potential Safety Hotspot (CTMS-116/117), không tạo ứng viên hotspot và không dùng nhãn "hotspot".
- **Certification Disallowance**: Quyết định "Giữ lại" (Keep) của Host không hiển thị như một chứng nhận hay tem bảo chứng chất lượng hoặc an toàn.
- **Admin Report Precedence (Layer 2 Invariant)**: Khôi phục của Host không được ghi đè quyết định của Admin trên nội dung bị report. Nếu review có `content_reports.status = 'actioned'`, review bắt buộc phải ẩn công khai dù Host có bấm khôi phục.

---

## 2. Infrastructure Comparison: CTMS-387 vs CTMS-411

| Dimension | CTMS-411 (Trip Batch Insights) | CTMS-387 (Review Intelligence & Moderation) |
| :--- | :--- | :--- |
| **Trigger Mechanism** | On-demand batch request via `POST /api/trips/:tripId/review-analysis-batches` with 60s Trip cooldown. | Event-driven, transactional enqueue upon Camper review creation/edit (`TripReviewsService.create`, `update`). |
| **Granularity** | Trip-level batch of up to 20 reviews. | Individual review revision (`review_id`, `source_revision`). |
| **Media Scope** | Redacted text comments only; images strictly excluded. | Multimodal: text comment + per-image inspection (up to 5 images). |
| **Output Taxonomy** | High-level sentiment (4 values), 5 general topics, short summary. | 3 distinct groups: Moderation Flags, 4 Aspect Sentiments, Incident Signals with verbatim quotes. |
| **Infrastructure Reused** | Reference implementation for queue/slot leasing. | **Reuses core algorithm patterns**: 60s worker leases, 20s heartbeat, 5s database lock timeout, exponential backoff (5s/30s delays, max 3 attempts), and strict row locking order (`FOR UPDATE` on review before writing results). Code logic is replicated and adapted within the new feature module to avoid cross-module coupling. Outbox claiming uses `FOR UPDATE SKIP LOCKED`. |
| **Reason for Separate Tables** | `trip_review_analysis_batches` tracks batch progress for entire Trips. | Coupling event-driven single-review moderation runs into the batch table would introduce lock contention, corrupt batch progress counters, and trigger Trip cooldowns unnecessarily. Runs are therefore stored in dedicated tables (`trip_review_moderation_runs`, etc.). |
| **Notifications** | N/A (no user-facing moderation alert). | Dedicated transactional outbox table `trip_review_moderation_notifications` created in **Layer 2** with `CONSTRAINT UQ_host_flag_notification UNIQUE (recipient_id, event_type, flag_id)` and `CONSTRAINT UQ_host_decision_notification UNIQUE (recipient_id, event_type, decision_id)` to deduplicate in-app notices across worker retries. Dedicated table is required because CTMS has no shared global notification entity (follows existing patterns in `porter_level_notifications` [`services/api/src/migrations/1793100000001-CreatePorterLevelRequests.ts:39-48`](services/api/src/migrations/1793100000001-CreatePorterLevelRequests.ts#L39-L48) and `trip_auto_cancel_outbox_events` [`services/api/src/migrations/1787190000000-AddTripAutoCancelInfrastructure.ts:25`](services/api/src/migrations/1787190000000-AddTripAutoCancelInfrastructure.ts#L25)). |

---

## 3. Eligibility Definitions

To prevent reported reviews from bypassing safety checks while ensuring aggregate metrics remain reliable, two distinct eligibility predicates are established:

### 3.1. Moderation Scan Eligibility (`MODERATION_SCAN_ELIGIBLE`)
Every review revision containing non-empty text or at least one image MUST be inspected by the AI pipeline:
```sql
-- Evaluated at enqueue time (from trip_reviews) and worker processing time (from trip_review_revisions):
((r.comment IS NOT NULL AND btrim(r.comment) <> '') OR (r.images IS NOT NULL AND jsonb_typeof(r.images) = 'array' AND jsonb_array_length(r.images) > 0))
```
- **Reported reviews are NOT excluded**: Reviews subject to pending, reviewing, or actioned `content_reports` are fully eligible for moderation scanning.
- Participation completion check is inherited from the review creation barrier; no additional participation restriction is applied to scanning.
- **BR-306 Compliance**: In alignment with BR-306 (reported reviews must be handled through moderation policy without hard-deleting historical records), all review revisions and AI moderation results are retained permanently (`ON DELETE RESTRICT`).

### 3.2. Dashboard Analytics Eligibility (`DASHBOARD_ELIGIBLE`)
Used exclusively for analytical dashboards (Trip feedback and Route safety signals):
$$\text{DASHBOARD\_ELIGIBLE} = \text{BASE\_ELIGIBLE} \land \neg\text{SUPPRESSED} \land \neg\text{BLOCKED} \land \neg\text{HIDDEN}$$
- `BASE_ELIGIBLE`: `r.target = 'trip' AND b.trip_id = r.trip_id AND m.booking_id = b.id AND b.status = 'completed' AND m.member_status = 'joined' AND m.user_id = r.reviewer_id AND m.left_at IS NULL AND m.checked_in_at IS NOT NULL AND m.checked_in_at <= b.completed_at AND b.completed_at <= clock_timestamp() AND r.comment IS NOT NULL AND btrim(r.comment) <> ''`. (Reviews with `target = 'host'` are strictly excluded).
- `SUPPRESSED`: `EXISTS(SELECT 1 FROM trip_review_analysis_suppressions s WHERE s.review_id = r.id)` ([`services/api/src/modules/review-analysis/review-analysis.queries.ts:8`](services/api/src/modules/review-analysis/review-analysis.queries.ts#L8)).
- `BLOCKED`: `EXISTS(SELECT 1 FROM content_reports cr WHERE cr.target_id = r.id AND cr.target_type IN ('trip_review', 'review') AND cr.status <> 'rejected')` ([`services/api/src/modules/review-analysis/review-analysis.queries.ts:10`](services/api/src/modules/review-analysis/review-analysis.queries.ts#L10)).
- `HIDDEN`: `r.moderation_status = 'hidden'`.

**Reporting Transparency on Dashboard**:
Excluding `BLOCKED` reviews from dashboards introduces the risk that a reported review containing valid safety warnings could be temporarily hidden from Host safety statistics. To mitigate silent suppression, the dashboard response MUST return:
- `reportedReviewsExcludedCount`: Count of reviews excluded from the period due to non-rejected content reports.
- `coverageRate`: Explicit ratio of analyzed reviews over total eligible reviews.

---

## 4. Taxonomy & Normalization

### 4.1. Group A: Moderation Flags & Hidden Reasons
Host hidden reasons (`hidden_reason`) are restricted to approved string codes and MUST match one of the active flag types detected on that review:

| Code (`flag_type` / `hidden_reason`) | Channel | Vietnamese User Label | Description |
| :--- | :--- | :--- | :--- |
| `profanity_or_insult` | text | Ngôn từ thô tục, xúc phạm danh dự | Profanity, personal abuse, hate speech |
| `personal_data_leak` | text | Tiết lộ thông tin cá nhân | Phone numbers, emails, national IDs (PII) |
| `spam_or_irrelevant` | text | Nội dung quảng cáo rác, không liên quan | Commercial links, irrelevant promotional spam |
| `harassment` | text | Quấy rối hoặc đe dọa | Threats, targeted intimidation |
| `inappropriate_image` | image | Hình ảnh bạo lực hoặc không phù hợp | Graphic violence, gore, nudity, offensive visuals |

**Strict Host Hiding Boundaries**:
- Negative feedback, complaints about tour quality, or low ratings do NOT constitute a valid reason for hiding a review.
- Host hiding is strictly disallowed unless an active AI moderation flag is present on the current revision.

### 4.2. Group B: Aspect Sentiments
Four approved categories:
1. `safety`: Trail safety, terrain difficulty, weather hazards.
2. `guide_support`: Tour guide and Porter attentiveness, attitude, and guidance.
3. `equipment`: Quality of tents, safety gear, rental equipment.
4. `value`: Perceived value relative to the booking price.

Sentiment values: `positive`, `neutral`, `negative`. Confidence: finite number in `[0, 1]`.

### 4.3. Group C: Incident Signals
Five approved categories:
1. `fall_slip`: Loss of balance due to terrain (slips, falls, loose rock, steep descents). Focuses on **terrain hazards**.
2. `injury`: Physical bodily injury (sprains, fractures, cuts) or acute health distress (bites, stings, heat exhaustion, hypothermia). Focuses on **medical impact**.
3. `lost_path`: Deviation from trail, missing checkpoint markers, temporary separation from group.
4. `weather_hazard`: Entrapment by flash floods, landslides, extreme storms.
5. `other`: Other physical safety incidents clearly described in the source.

**Distinction & Query Invariant**:
- A single review describing *"Tôi trượt ngã dốc làm gãy tay"* triggers two distinct signal rows: `fall_slip` and `injury`.
- Therefore, the sum of counts across incident categories MAY EXCEED the total count of distinct reviews with incidents. The UI and documentation must clearly state that category counts cannot be added together.
- All aggregate queries MUST use **`COUNT(DISTINCT review_id)`**:
  - `occurred = 'yes'`: Reviewer describes an incident that actually took place. *(Included in primary incident numerator)*.
  - `occurred = 'warning'`: Reviewer offers preventive advice or expresses caution without stating an event occurred. *(Excluded from incident numerator; reported in separate warning metric)*.
  - `occurred = 'unknown'`: Context is ambiguous. *(Excluded from incident numerator)*.
- `severity`: `minor`, `moderate`, `severe`, `unknown`.
- `quote`: Mandatory non-empty verbatim substring matching the masked source comment text (normalized NFC, length between 1 and 500 characters).

---

## 5. Schema Specification (Layer 1)

### 5.1. Foreign Key Integrity Rule
In compliance with CTMS-92 Section 13 evidence preservation rules, all foreign keys to parent entities use `ON DELETE RESTRICT`. No cascading deletion of historical evidence is permitted.

### 5.2. `trip_review_moderation_runs`
```sql
CREATE TABLE trip_review_moderation_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id uuid NOT NULL,
    source_revision integer NOT NULL,
    provider varchar(40) NOT NULL,
    model varchar(200) NOT NULL,
    config_version varchar(100) NOT NULL,
    prompt_version varchar(40) NOT NULL,
    
    text_scan_status varchar(16) NOT NULL DEFAULT 'pending' 
        CHECK (text_scan_status IN ('pending', 'running', 'completed', 'failed', 'not_applicable')),
    image_scan_status varchar(16) NOT NULL DEFAULT 'pending' 
        CHECK (image_scan_status IN ('pending', 'running', 'completed', 'failed', 'unsupported', 'not_applicable')),
    aspects_status varchar(16) NOT NULL DEFAULT 'pending' 
        CHECK (aspects_status IN ('pending', 'running', 'completed', 'failed', 'not_applicable')),
    incidents_status varchar(16) NOT NULL DEFAULT 'pending' 
        CHECK (incidents_status IN ('pending', 'running', 'completed', 'failed', 'not_applicable')),
        
    lease_token uuid,
    lease_until timestamptz,
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
    error_code varchar(60),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    completed_at timestamptz,
    
    FOREIGN KEY (review_id, source_revision) REFERENCES trip_review_revisions(review_id, revision) ON DELETE RESTRICT,
    CONSTRAINT UQ_moderation_run_source UNIQUE (review_id, source_revision, provider, model, config_version, prompt_version),
    CONSTRAINT UQ_moderation_run_identity UNIQUE (id, review_id, source_revision)
);

CREATE INDEX IDX_moderation_runs_queue ON trip_review_moderation_runs (created_at) 
    WHERE text_scan_status IN ('pending', 'running') OR image_scan_status IN ('pending', 'running')
       OR aspects_status IN ('pending', 'running') OR incidents_status IN ('pending', 'running');
```

**Channel Applicability Rules**:
- If `comment IS NULL` or trimmed comment is empty: `text_scan_status`, `aspects_status`, and `incidents_status` are set to `'not_applicable'` at insertion.
- If `images` is empty (`jsonb_array_length(images) = 0`): `image_scan_status` is set to `'not_applicable'` at insertion.
- **Definition of `completed_at`**: Set to `clock_timestamp()` when all applicable channels (every channel whose status is not `'not_applicable'`) reach a terminal state (`completed`, `failed`, or `unsupported`).

### 5.3. `trip_review_moderation_image_items`
Stores internal storage references (`storage_key`), never raw public URLs:
```sql
CREATE TABLE trip_review_moderation_image_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL,
    review_id uuid NOT NULL,
    source_revision integer NOT NULL,
    image_index integer NOT NULL CHECK (image_index >= 0 AND image_index < 5),
    storage_key varchar(255) NOT NULL,
    scan_status varchar(16) NOT NULL 
        CHECK (scan_status IN ('pending', 'running', 'completed', 'failed', 'unsupported')),
    has_violation boolean,
    flag_type varchar(50) CHECK (flag_type IS NULL OR flag_type = 'inappropriate_image'),
    confidence double precision CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    evidence text,
    error_code varchar(60),
    scanned_at timestamptz,
    
    FOREIGN KEY (run_id, review_id, source_revision) 
        REFERENCES trip_review_moderation_runs(id, review_id, source_revision) ON DELETE RESTRICT,
    CONSTRAINT UQ_moderation_image_item UNIQUE (run_id, image_index),
    CONSTRAINT CHK_image_item_scan_violation CHECK (
        (scan_status = 'completed' AND has_violation IS NOT NULL AND (
            (has_violation = true AND flag_type IS NOT NULL) OR
            (has_violation = false AND flag_type IS NULL)
        ))
        OR
        (scan_status <> 'completed' AND has_violation IS NULL AND flag_type IS NULL)
    )
);
```

### 5.4. `trip_review_moderation_flags`
```sql
CREATE TABLE trip_review_moderation_flags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL,
    review_id uuid NOT NULL,
    source_revision integer NOT NULL,
    channel varchar(16) NOT NULL CHECK (channel IN ('text', 'image')),
    target_image_index integer,
    flag_type varchar(50) NOT NULL 
        CHECK (flag_type IN ('profanity_or_insult', 'personal_data_leak', 'spam_or_irrelevant', 'harassment', 'inappropriate_image')),
    detection_source varchar(10) NOT NULL CHECK (detection_source IN ('model', 'rule')),
    confidence double precision CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    evidence text NOT NULL,
    quote text CHECK (quote IS NULL OR char_length(quote) BETWEEN 1 AND 500),
    lifecycle_status varchar(16) NOT NULL DEFAULT 'active' CHECK (lifecycle_status IN ('active', 'superseded', 'resolved')),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    resolved_at timestamptz,
    resolved_by uuid REFERENCES users(id) ON DELETE RESTRICT,
    
    FOREIGN KEY (run_id, review_id, source_revision) 
        REFERENCES trip_review_moderation_runs(id, review_id, source_revision) ON DELETE RESTRICT,
    CONSTRAINT CHK_flag_source_rules CHECK (
        (detection_source = 'model' AND confidence IS NOT NULL AND flag_type <> 'personal_data_leak') OR
        (detection_source = 'rule' AND confidence IS NULL AND flag_type = 'personal_data_leak')
    ),
    CONSTRAINT CHK_flag_channel_consistency CHECK (
        (channel = 'image' AND target_image_index IS NOT NULL AND target_image_index BETWEEN 0 AND 4 AND quote IS NULL AND flag_type = 'inappropriate_image') OR
        (channel = 'text' AND target_image_index IS NULL AND quote IS NOT NULL AND btrim(quote) <> '' AND flag_type IN ('profanity_or_insult', 'personal_data_leak', 'spam_or_irrelevant', 'harassment'))
    )
);

CREATE UNIQUE INDEX UQ_moderation_flag_run_item 
ON trip_review_moderation_flags (run_id, channel, flag_type, (COALESCE(target_image_index, -1)));

CREATE UNIQUE INDEX UQ_active_flag_per_review 
ON trip_review_moderation_flags (review_id, channel, flag_type, (COALESCE(target_image_index, -1)))
WHERE lifecycle_status = 'active';

CREATE INDEX IDX_moderation_flags_active ON trip_review_moderation_flags (review_id) 
WHERE lifecycle_status = 'active';
```

### 5.5. `trip_review_aspect_sentiments`
```sql
CREATE TABLE trip_review_aspect_sentiments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL,
    review_id uuid NOT NULL,
    source_revision integer NOT NULL,
    aspect varchar(30) NOT NULL CHECK (aspect IN ('safety', 'guide_support', 'equipment', 'value')),
    sentiment varchar(16) NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    confidence double precision NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    quote text CHECK (quote IS NULL OR char_length(quote) BETWEEN 1 AND 500),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    
    FOREIGN KEY (run_id, review_id, source_revision) 
        REFERENCES trip_review_moderation_runs(id, review_id, source_revision) ON DELETE RESTRICT,
    CONSTRAINT UQ_aspect_sentiment UNIQUE (run_id, aspect)
);
```

### 5.6. `trip_review_incident_signals`
```sql
CREATE TABLE trip_review_incident_signals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL,
    review_id uuid NOT NULL,
    source_revision integer NOT NULL,
    incident_type varchar(40) NOT NULL CHECK (incident_type IN ('fall_slip', 'injury', 'lost_path', 'weather_hazard', 'other')),
    occurred varchar(10) NOT NULL CHECK (occurred IN ('yes', 'warning', 'unknown')),
    severity varchar(16) NOT NULL CHECK (severity IN ('minor', 'moderate', 'severe', 'unknown')),
    quote text NOT NULL CHECK (char_length(quote) BETWEEN 1 AND 500),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    
    FOREIGN KEY (run_id, review_id, source_revision) 
        REFERENCES trip_review_moderation_runs(id, review_id, source_revision) ON DELETE RESTRICT
);

-- Expression unique index using md5(quote) to guard against btree 2704-byte limit on long Vietnamese text:
CREATE UNIQUE INDEX UQ_incident_signal_item 
ON trip_review_incident_signals (run_id, incident_type, md5(quote));
```

### 5.7. `trip_review_moderation_outbox`
Stores transactional enqueue events when reviews are created/updated:
```sql
CREATE TABLE trip_review_moderation_outbox (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id uuid NOT NULL REFERENCES trip_reviews(id) ON DELETE RESTRICT,
    source_revision integer NOT NULL,
    config_version varchar(100) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    processed_at timestamptz,
    CONSTRAINT UQ_moderation_outbox UNIQUE (review_id, source_revision, config_version)
);
```
- **Claim Semantics**: The background worker claims pending events using `SELECT ... FOR UPDATE SKIP LOCKED` to prevent duplicate processing by concurrent worker instances.
- **Semantics of `processed_at`**: Set when the background worker claims the outbox event and inserts the `trip_review_moderation_runs` record in state `'pending'` within a single transaction. A cron job retries events where `processed_at IS NULL` after 60 seconds.
- **Re-analysis on Configuration Change**: Including `config_version` allows subsequent server configuration bumps to enqueue re-analysis events without violating uniqueness.
- **Backfill Prerequisite for Layer 3**: Hiện tại chưa có job tự động phân tích lại các review cũ khi đổi `config_version`. Việc xây dựng batch re-analysis / backfill job là yêu cầu tiên quyết phải hoàn thành trước khi kích hoạt Layer 3.

### 5.8. Layer 2 Schema Outline (Preview for Host Decisions & Notifications)
Postponed to Layer 2 migration, documented here for structural clarity:
```sql
-- Outline: trip_review_moderation_decisions (Layer 2)
CREATE TABLE trip_review_moderation_decisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id uuid NOT NULL REFERENCES trip_reviews(id) ON DELETE RESTRICT,
    target_revision integer NOT NULL,
    host_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action varchar(20) NOT NULL CHECK (action IN ('keep', 'hide', 'restore', 'keep_hidden')),
    reason varchar(50) CHECK (
        (action IN ('hide', 'keep_hidden') AND reason IS NOT NULL) OR
        (action IN ('keep', 'restore') AND reason IS NULL)
    ),
    note text,
    image_quarantine_action varchar(30) CHECK (image_quarantine_action IN ('none', 'quarantined', 'restored')),
    idempotency_key uuid,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT UQ_moderation_decision_idempotency UNIQUE (review_id, target_revision, action)
);

-- Outline: trip_review_moderation_notifications (Layer 2)
CREATE TABLE trip_review_moderation_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    review_id uuid NOT NULL REFERENCES trip_reviews(id) ON DELETE RESTRICT,
    flag_id uuid REFERENCES trip_review_moderation_flags(id) ON DELETE RESTRICT,
    decision_id uuid REFERENCES trip_review_moderation_decisions(id) ON DELETE RESTRICT,
    event_type varchar(50) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    sent_at timestamptz,
    CONSTRAINT UQ_host_flag_notification UNIQUE (recipient_id, event_type, flag_id),
    CONSTRAINT UQ_host_decision_notification UNIQUE (recipient_id, event_type, decision_id)
);
```

---

## 6. Worker Execution & State Invariants

1. **Deterministic Active Run Selection for Dashboards**:
   To prevent duplicate counting across runs or configuration changes, dashboards MUST select exactly one authoritative run per review:
   - Filter `review.revision = run.source_revision` (authoritative revision).
   - Filter `provider = :currentProvider AND model = :currentModel AND config_version = :currentConfigVersion AND prompt_version = :currentPromptVersion`.
   - Filter `completed_at IS NOT NULL`.
   - Tie-breaker note: `UQ_moderation_run_source` already guarantees uniqueness per configuration; `ORDER BY completed_at DESC, id ASC LIMIT 1` is retained as harmless defense-in-depth.
   - **Independent Channel Denominators**:
     - Safety dashboard denominator only includes reviews whose selected run has `incidents_status = 'completed'`.
     - Feedback dashboard denominator only includes reviews whose selected run has `aspects_status = 'completed'`.
2. **Independent Channel Execution**:
   - `text_scan_status`, `image_scan_status`, `aspects_status`, and `incidents_status` execute independently.
   - A failure or unsupported status in image scanning does NOT block or cancel text scanning, aspect sentiment extraction, or incident signal extraction.
3. **Enqueue upon Create and Update**:
   - In `TripReviewsService.create`, if the newly created review satisfies `MODERATION_SCAN_ELIGIBLE`, an enqueue event is inserted into `trip_review_moderation_outbox`.
   - In `TripReviewsService.update`, within the same database transaction that increments `trip_reviews.revision` and inserts a new row into `trip_review_revisions`:
     1. Set all active flags of older revisions to `superseded`:
        ```sql
        UPDATE trip_review_moderation_flags
        SET lifecycle_status = 'superseded'
        WHERE review_id = :reviewId AND lifecycle_status = 'active';
        ```
     2. Check if the updated revision satisfies `MODERATION_SCAN_ELIGIBLE`:
        - If YES: Insert an enqueue event into `trip_review_moderation_outbox` for the new revision.
        - If NO: Do not enqueue. (The review revision contains no text or images, so no flags are active and no scan is needed).
4. **Late-Writing Worker Fencing (Conditional Write)**:
   Before persisting worker outputs to DB:
   - **Revision fence**: Worker acquires lock: `SELECT revision FROM trip_reviews WHERE id = $1 FOR UPDATE`.
     - If `current_revision > run.source_revision`: Worker records run output, but all generated flags are automatically saved with `lifecycle_status = 'superseded'`. No active flag is created on an obsolete revision.
   - **Lease fence**: Run completion must conditionally check `lease_token = $token AND lease_until >= clock_timestamp()`. If zero rows are affected, the worker aborts and rolls back immediately.
5. **Resolved Revision Immobility**:
   - Once a revision is resolved (`kept` by Host in Layer 2), re-running analysis on that same revision will NEVER create new `active` flags.
   - Re-analysis on an active revision supersedes existing active flags and generates fresh flags; existing flags are never modified in-place.
6. **Completion Messaging Rule**:
   - The notice *"Không phát hiện dấu hiệu vi phạm"* is ONLY permitted when ALL applicable scan channels (channels where status is not `'not_applicable'`) reach `'completed'`.
   - If image scanning failed or is unsupported, the system states: *"Chưa hoàn tất kiểm tra kênh ảnh"*. No absolute certification or guarantee of safety is ever claimed.

---

## 7. AI Safety & Data Boundaries

1. **Untrusted Data Isolation**:
   - Review text, metadata, and OCR/image contents are strictly untrusted data, never instructions.
   - System prompts enforce strict JSON schema output. No tools, shell commands, or external network access are permitted to the LLM agent.
2. **PII Masking & Rule Flag Creation in NestJS**:
   - **PII Detection in NestJS**: Detection of `personal_data_leak` (phone numbers, email addresses, national ID patterns) is executed entirely within the NestJS backend via deterministic regular expressions BEFORE calling the AI service.
     - When PII is matched, NestJS directly persists the `personal_data_leak` flag with `detection_source = 'rule'`, `confidence = NULL`, and server-generated masked evidence (e.g. `"Detected Vietnamese phone number pattern: 090***1234"`).
     - Raw PII is never passed to the AI service or third-party LLMs and never stored unmasked in moderation evidence. Python never receives raw PII and never logs raw comments.
   - **Model Receives Masked Comment**: The AI service strictly receives the masked comment text (where phone numbers and emails have been replaced by NestJS with tokens like `[phone]` and `[email]`).
   - **Verbatim Substring Validation on Masked Text**: For all other text moderation flags (`profanity_or_insult`, `spam_or_irrelevant`, `harassment`), aspect sentiment quotes, and incident signal quotes:
     - The quote returned by the model MUST be an exact substring of the masked comment text sent to the model.
     - **Unicode NFC Normalization**: Both the masked comment text and the quote MUST be normalized to Unicode **NFC** (`unicodedata.normalize('NFC', text)` in Python, `String.prototype.normalize('NFC')` in TypeScript) prior to checking containment, preventing substring mismatches caused by decomposed vs precomposed Vietnamese diacritics.
     - Quote length must be between 1 and 500 characters (`char_length(quote) BETWEEN 1 AND 500`). Paraphrased or altered quotes are rejected.
3. **Data Minimization & Privacy**:
   - Reviewer identity, User IDs, Booking IDs, and commercial/payment amounts are strictly excluded from the provider payload.
4. **URL Sandboxing**:
   - The AI provider is never passed arbitrary user-supplied URLs to fetch. Images are read from controlled server storage as base64 buffers or server-authenticated data streams.
5. **Strict Schema Validation**:
   - Provider responses are independently validated in Python (Pydantic) and NestJS (class-validator). Extra keys or unapproved categories result in terminal failure.

---

## 8. Open Decisions & Baseline Alignment

### Decision A: Camper Edits on Hidden Reviews (Approved)
- Camper may edit a hidden review within the initial 24-hour edit window (`review.created_at + 24 hours`) established in [`file/spec/ctms-92-review-trip-and-host-after-trip.md`](file/spec/ctms-92-review-trip-and-host-after-trip.md) (PB AC-8) and [`services/api/src/modules/trip-reviews/trip-reviews.types.ts:10`](services/api/src/modules/trip-reviews/trip-reviews.types.ts#L10).
- Editing increments revision (`revision + 1`); review remains `hidden`.
- Pipeline re-analyzes the new revision. Host reviews the new revision and decides whether to restore or keep hidden.
- **Trip vs Host Independence**: Ẩn review về Trip không tự động ẩn review về Host của cùng một Booking và ngược lại. Hai review hoàn toàn độc lập về cờ kiểm duyệt và hiển thị.
- **Documented Known Limitation**: After 24 hours, Camper can no longer edit. A review erroneously hidden after the 24-hour mark cannot be self-remedied by the Camper.

### Decision B: Star Rating & Review Count Aggregation (Option B1 Selected)
- **Admin Report Precedence (Layer 2)**: Quyết định khôi phục của Host không ghi đè quyết định xử lý vi phạm của Admin. Một review có `content_reports.status = 'actioned'` vẫn bị ẩn khỏi hiển thị công khai ngay cả khi Host chọn khôi phục.
- **Selected: Option B1**. Directional rule for future queries when public ratings are implemented:
  - Hidden reviews (`moderation_status = 'hidden'`) are excluded from numerator and denominator of public average rating and public review count.
  - To prevent misleading perception, the API returns `hiddenReviewsCount` alongside public count.
  - **Documented Conflict of Interest Risk**: Because reviews on a Trip organized by a Host can affect that Host's rating, hiding low-star reviews with active AI flags can increase the Host's average rating. This risk is acknowledged; audit logs and requiring active AI flags mitigate but do not fully eliminate this incentive. Spec notes that interpreting BR-302 ("excluded by moderation") as encompassing Host hiding is a product rule established in CTMS-387.
  - **Camper Integrity**: Camper's own private review count (`GET /api/trip-reviews/summary`) is NEVER decremented when a review is hidden.
  - **Locked Verbatim Camper Notification Text (when hidden)**:
    *"Chủ chuyến đã ẩn đánh giá này vì cho rằng nội dung vi phạm tiêu chuẩn cộng đồng. Lý do: [...]"*
  - **Locked Verbatim Public Placeholder Text**:
    *"Đánh giá này đã bị chủ chuyến ẩn."*
  - **Locked Verbatim Restore Notice Text**:
    *"Chủ chuyến đã khôi phục đánh giá của bạn."*

### Decision C: Dashboard Sample Thresholds (Approved as Configuration)
- `DASHBOARD_TRIP_MIN_SAMPLE_SIZE = 5` (Operational caution threshold for Trip positive feedback).
- `DASHBOARD_SAFETY_MIN_SAMPLE_SIZE = 10` (Operational caution threshold for Route safety signals).
- Below threshold: `hasSufficientSample = false`, no ranking, coverage rate displayed. Dashboard metrics remain unactivated until Layer 3.
- Only reviews with `target = 'trip'` are eligible; `target = 'host'` reviews are strictly excluded.

---

## 9. Layer 2 & Layer 3 Endpoint Roadmap (Informational Preview)

Detailed DTOs and contracts will be formally locked prior to Layer 2 implementation:
- `GET /api/host/review-moderation/queue`: Host moderation queue with active flags.
- `GET /api/host/review-moderation/history`: Moderation history including superseded flags.
- `GET /api/host/review-moderation/flags/:flagId`: Flag details and evidence.
- `POST /api/host/review-moderation/reviews/:reviewId/keep`: Resolve all active flags on revision as kept (`409 REVISION_MISMATCH`).
- `POST /api/host/review-moderation/reviews/:reviewId/hide`: Hide review and quarantine images (`409 REVISION_MISMATCH`, `409 OPERATION_IN_PROGRESS`).
- `POST /api/host/review-moderation/reviews/:reviewId/restore`: Restore review with expected revision (`409 REVISION_MISMATCH`, `409 OPERATION_IN_PROGRESS`).
- `POST /api/host/review-moderation/reviews/:reviewId/keep-hidden`: Maintain hidden state for already hidden review (`409 REVISION_MISMATCH`).
- `POST /api/host/review-moderation/flags/:flagId/reveal-image`: Reveal unblurred image, audited in `audit_logs`.
- `GET /api/bookings/:bookingId/reviews/images/:imageIndex`: Camper stream for owned review images.
- `GET /api/host/review-analytics/trips-overview`: Layer 3 Trip feedback overview (`target = 'trip'` only).
- `GET /api/host/review-analytics/routes-safety-overview`: Layer 3 Route safety overview (`target = 'trip'` only).

**Layer 2 Image Quarantine Requirements**:
- When a Camper edits a review that is currently `hidden`, newly uploaded images go straight to quarantine (`image_storage_state = 'quarantine_pending'` -> `'quarantined'`).
- Images of prior revisions are preserved in storage/quarantine for historical evidence.
- A background reconciliation worker periodically audits and recovers reviews stuck in `quarantine_pending`, `restore_pending`, or `failed` image storage states.
