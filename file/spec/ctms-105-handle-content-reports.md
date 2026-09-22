# CTMS-105 - Handle Content Reports

**Spec Reference**  
/file/spec/ctms-105-handle-content-reports.md

**Source Authority**  
- Product Backlog V3.1 is the scope authority for this story.
- Business Rules are the invariant/policy source. This spec rewrites relevant rules as executable behavior so Dev and QA do not need to infer behavior from rule IDs.
- Jira is used for execution tracking, status, and task ownership. Jira content must not replace the behavior contract below.
- Authority order for conflicts: Business Rules V3, Data Dictionary or Domain Model V3, approved Jira requirement or decision, this file/spec, code, then tests.

---

## 1. Purpose

Implement `Handle Content Reports` so the CTMS workflow is safe, consistent, auditable, and aligned with PB V3.1.

Business purpose from PB V3.1:

- English use case: `Handle Content Reports`
- Story: As a System, I want to handle content reports so that CTMS supports the workflow safely and consistently.

Implementation details belong in the sections below, not in this purpose summary.

---

## 2. Scope

### In Scope
- The behavior needed for `Handle Content Reports` within `EPIC 18. Administration and Audit`.
- Backend validation, authorization, persistence, state handling, idempotency, and audit behavior needed for this story.
- UI/API behavior that makes success, pending, validation failure, authorization failure, conflict, and retry states observable.
- Tests proving the PB V3.1 acceptance criteria and mapped Business Rules are enforced.

### Out of Scope
- Behavior owned by dependency stories unless explicitly referenced as a precondition or integration point.
- Replacing source-of-truth entities owned by another module.
- Changing unrelated workflow, enum, database, API, or UI contracts outside this story.
- Treating Jira task wording as a substitute for this implementation contract.
- Inventing behavior that is not approved in PB V3.1, Business Rules, domain model, Jira, or a recorded product decision.

---

## 3. Actors

- Admin: primary actor for this workflow.
- Backend API: validates authorization, state, input, persistence, idempotency, and audit requirements.
- UI Client: presents allowed actions, validates obvious input, shows loading/success/error states, and never replaces backend enforcement.
- Related CTMS modules: provide referenced Trip, Route, Booking, Payment, Offline Package, AI, Notification, or Administration data when this story depends on them.

---

## 4. Preconditions

- Actor is authenticated when the workflow requires identity.
- Actor has the role, ownership, consent, assignment, or operational relationship required by the story.
- Referenced records exist and are in states that allow this workflow.
- Dependencies are satisfied: CTMS-006, CTMS-094.
- PB V3.1 acceptance criteria and the Business Rules listed in this spec are available to implementation and QA.

If a precondition is not satisfied, the system must reject the action or show a blocked/degraded state without unintended side effects.

---

## 5. Business Behavior

### 5.1 Primary Behavior

The system implements `Handle Content Reports` exactly within the PB V3.1 scope:

- Implement the PB V3.1 acceptance behavior for `Handle Content Reports` exactly as approved in the source backlog.
- Convert each source acceptance condition into explicit validation, state, persistence, UI, and test behavior during implementation.
- Do not copy non-English backlog text into this English spec; keep the workbook as the source citation.

### 5.2 Validation Rules

- Required fields, enum values, date/time ranges, identifiers, ownership boundaries, and cross-entity references are validated before persistence.
- Backend is authoritative for permission, state, price, capacity, inventory, safety, payment, and operational outcomes.
- UI validation may improve the experience, but backend validation is mandatory and final.
- Invalid input returns a clear error and does not partially create, update, or synchronize records.

### 5.3 State and Transaction Rules

- State transitions must start from an allowed source state and end in an allowed target state.
- Multi-record side effects must run in a transaction or equivalent atomic unit.
- Concurrent requests, duplicate submissions, stale reads, and provider retries must not create duplicate records or inconsistent state.
- If the operation cannot complete safely, the system preserves the previous authoritative state and returns an actionable failure.

### 5.4 Business Rules Materialized

The following rules are materialized as behavior for this story:

| ID | Content |
| --- | --- |
| `BR-167` | Required behavior for `Handle Content Reports` must validate and enforce Content, report, reporter, target_type, target_id, reason, status, target, policy as part of the story-specific business contract. Backend checks must run before persistence, violations must be rejected without partial side effects, UI must show blocked or conflict states where relevant, and tests must cover both allowed and violation paths. |
| `BR-168` | Required behavior for `Handle Content Reports` must validate and enforce Admin, transition, content_report, state, machine, pending, reviewing, actioned, rejected, spec as part of the story-specific business contract. Backend checks must run before persistence, violations must be rejected without partial side effects, UI must show blocked or conflict states where relevant, and tests must cover both allowed and violation paths. |
| `BR-287` | Admin moderation must show reporter, target type/ID, reason, and status. Only valid Pending/Reviewing/Actioned/Rejected transitions are allowed, and every moderation decision must be audited. |
| `BR-172` | Backend access control must be checked from role, ownership, and business scope before the workflow proceeds; UI visibility is not a substitute for backend authorization. |
| `BR-173` | Personally identifiable, health, payment, location, and safety data must be minimized and returned only to actors with a valid business need. |
| `BR-182` | Derived values must be calculated by backend logic from authoritative records, not trusted from client-provided totals or status flags. |
| `BR-191` | Critical actions must write an audit record containing actor, action, target, timestamp, before/after values or reason, and affected business identifiers. |
| `BR-192` | Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, unnecessary health data, or private payloads beyond the audit need. |
| `BR-201` | UI behavior must reflect backend state accurately and must show clear loading, success, empty, validation, permission, conflict, and retry states where applicable. |
| `BR-212` | Any Business Rule, enum, state transition, or API contract change must update the spec, tests, and data documentation before the story is Done. |
| `BR-213` | Every mapped Business Rule must have at least one valid-path test and one violation-path test; concurrency, idempotency, and transaction rules require integration or E2E coverage. |
| `BR-306` | Reported reviews must follow the moderation policy, and processing reported content must not hard-delete history or audit evidence. |

### 5.5 Source Confidence

- PB V3.1 row `CTMS-105` is the direct scope and acceptance source.
- Rule IDs above come from the `Primary BR IDs` column in PB V3.1 and are materialized here as implementation behavior.
- If a rule ID conflicts with PB V3.1 behavior, do not silently choose one. Record a Pending Decision and update PB/rules/spec together.
- This file may elaborate approved behavior into execution flow, but it must not invent, change, or override business behavior.
- Undefined, ambiguous, or conflicting behavior must be captured in Section 19 as a Pending Decision.

---

## 6. State Model

The story state model is:

- `NOT_STARTED`: actor has not initiated the workflow.
- `IN_PROGRESS`: request, calculation, sync, AI operation, or review is being processed.
- `SUCCEEDED`: authoritative result is persisted or returned.
- `FAILED_VALIDATION`: input or referenced data is invalid.
- `FAILED_AUTHORIZATION`: actor lacks required permission or relationship.
- `CONFLICT`: current server state no longer allows the requested action.
- `PENDING_RETRY` or `SYNC_PENDING`: used only when the story includes offline, external provider, async, or retry behavior.

Every implementation must replace these generic labels with existing enum values when the owning module already defines a state machine.

---

## 7. Main Flow

### Scenario: Handle Content Reports

1. Actor opens or triggers the `Handle Content Reports` workflow.
2. UI loads the minimum data needed for the workflow and shows unavailable states when dependencies are missing.
3. Actor submits the action or the system starts the scheduled/automatic processing.
4. Backend authenticates the caller or system job.
5. Backend validates authorization, ownership/business relationship, input shape, referenced records, and current state.
6. Backend applies the PB V3.1 behavior and mapped Business Rules in one safe transaction or equivalent atomic unit.
7. Backend persists the authoritative result, audit data, and integration/sync metadata where required.
8. UI/API returns the observable outcome: success, pending, blocked, conflict, retryable failure, or validation failure.

---

## 8. Edge Cases

### Missing or Unauthorized Actor

Reject with authentication or authorization error. No business side effect is allowed.

### Missing Dependency

If dependency data from `CTMS-006, CTMS-100` is missing or not in an allowed state, block the workflow with a clear reason.

### Invalid Input or Reference

Reject invalid fields, invalid enum values, missing required references, out-of-range dates, invalid coordinates, invalid amounts, or stale IDs before writing data.

### Duplicate Submission or Retry

Use idempotency keys, stable client identifiers, provider references, or transaction constraints so retries do not create duplicate authoritative records.

### Concurrent Update

Detect stale state with locking, version checks, unique constraints, or conflict validation. Return a conflict result and preserve the user's recoverable input where a UI exists.

### External Provider, AI, Offline, or Sync Failure

If this story calls an external provider, AI service, offline queue, or sync process, the system must expose pending/failed/retry states and must not present unconfirmed output as authoritative.

---

## 9. Data Requirements

The implementation must persist or return only data required for `Handle Content Reports`:

- actor/user context and role/relationship used for authorization;
- referenced domain identifiers such as Trip, Route, Booking, Payment, Member, Package, Review, Alert, or Report ids when applicable;
- source timestamps and server timestamps as separate values when client/offline/provider events are involved;
- status/state fields needed to distinguish pending, succeeded, failed, rejected, stale, or synced data;
- audit fields for actor, action, target, before/after values, timestamp, and reason when applicable;
- idempotency keys, provider references, sync metadata, model/config/rule version, or package/version context when the behavior depends on them.

Do not duplicate an entire data dictionary in this spec. Reference existing entities and add only story-specific requirements.

---

## 10. Backend / API Responsibilities

Backend is responsible for:

- authentication and authorization;
- input DTO validation;
- ownership and business relationship checks;
- state transition validation;
- transaction boundaries and rollback;
- idempotency and duplicate prevention;
- persistence of authoritative state;
- audit logging when the action is operational, financial, safety-related, administrative, or security-sensitive;
- returning consistent error semantics: `401`, `403`, `404`, `409`, and `422` where applicable.

If endpoint paths or DTOs are not finalized, implementation must define a typed contract before UI integration and record unresolved endpoint details as Pending Decisions.

---

## 11. Mobile / UI Responsibilities

UI is responsible for:

- displaying only actions allowed by known role/state while treating backend as final authority;
- collecting required inputs with clear validation messages;
- showing loading, success, pending, failed, retry, conflict, and permission-denied states;
- preserving user-entered data after recoverable failure or conflict where practical;
- distinguishing local/pending/offline/AI-suggested data from server-confirmed authoritative state;
- using existing CTMS design, i18n, accessibility, and state-management patterns.

If this story has no user-facing UI, UI responsibilities are limited to any admin, monitoring, notification, or client state needed to observe the backend result.

---

## 12. Offline & Sync Behavior

Online:

- Execute against backend-authoritative validation and persistence.

Offline:

- If this story is not offline-capable, block the write action and show the unavailable state.
- If this story is offline-capable, persist a local pending record with stable identifiers and enough context to sync later.

Reconnect:

- Sync pending records idempotently.
- Preserve original client event time separately from server received time.
- Do not present unsynced data as authoritative server state.

Pending Decision:

- If this story requires offline or sync semantics beyond the owning sync specification, record the unresolved behavior in Section 19 before implementation.

---

## 13. Error Handling

| Condition | Observable behavior |
| --- | --- |
| Authentication missing/expired | Return `401`; UI prompts sign-in or session refresh. |
| Actor lacks permission | Return `403`; no side effect. |
| Referenced record missing | Return `404` when the actor may know it exists; otherwise preserve privacy-safe response. |
| Invalid input | Return `422` with field-level reason where possible. |
| Business conflict | Return `409` with recoverable explanation. |
| External provider or async failure | Keep state pending/failed with retry metadata and no duplicate authoritative result. |
| Unexpected server error | Roll back partial work and return a generic error without leaking secrets or stack trace. |

---

## 14. Security & Authorization

- Authorization must check role, ownership, consent, assignment, Trip/Route/Booking relationship, or administrative scope as applicable.
- Sensitive data must not be exposed beyond the actor's business need.
- Payment credentials, tokens, OTPs, secrets, health data, exact location, and AI/private prompt data must not appear in logs or audit records unless explicitly required and approved.
- Backend remains the source of truth for permission and state even when UI hides unavailable actions.
- Audit is required for important operational, safety, financial, administrative, and security-sensitive changes.

---

## 15. Acceptance Criteria

### AC-01

Given:

- The preconditions in this spec are satisfied.

When:

- The approved PB V3.1 acceptance behavior for `Handle Content Reports` is implemented as explicit system behavior..

Then:

- The system behavior matches the rule above.
- Backend validation and UI state are consistent with the observable result.
- Tests cover the success path and at least one failure or boundary case.
### AC-02

Given:

- The preconditions in this spec are satisfied.

When:

- The source acceptance conditions are covered by backend or client tests without copying non-English backlog text into the spec..

Then:

- The system behavior matches the rule above.
- Backend validation and UI state are consistent with the observable result.
- Tests cover the success path and at least one failure or boundary case.

### AC-03 - Authorization and Invalid State Protection

Given:

- The actor is missing permission, the target record is missing, or the current state does not allow the workflow.

When:

- The actor or system attempts `Handle Content Reports`.

Then:

- The backend rejects the action with the correct error category.
- No unintended side effect is persisted.
- UI/API exposes the failure clearly.

### AC-04 - Duplicate and Retry Safety

Given:

- The same request, sync item, provider callback, or user action is submitted more than once.

When:

- The backend processes the duplicate.

Then:

- At most one authoritative result is created.
- Duplicate handling returns a compatible success, already-processed, or conflict response.

---

## 16. Backend Preparation, Logic and Tests

### CTMS-105-T01 — Approved Minimum Implementation Contract

The following records the explicit product/schema decisions approved for T01 in the
implementation request. It resolves the generic API/state placeholders for this subtask
only; it does not define the future complete moderation lifecycle or a target taxonomy.

#### Persistence

- New migration: `1787070000000-CreateContentReportsTable.ts`; no previous migration changed.
- `content_reports`: generated UUID `id` (primary key), required UUID `reporter_id`
  referencing `users.id`, required `target_type varchar(100)`, required opaque UUID
  `target_id`, required `reason varchar(1000)`, required status enum defaulting to
  `pending`, and required `created_at` / `updated_at` timestamptz with `now()` defaults.
- Status values: `pending`, `reviewing`, `actioned`, `rejected`.
- ORM writes trim `target_type` and `reason`; database CHECK constraints reject blank
  values and leading/trailing whitespace. Varchar limits enforce the maximum lengths.
  Direct SQL producers must provide normalized strings. TypeORM maintains `updated_at`.
- No closed target-type list was found in the current report specs. `target_type` is
  deliberately an opaque string owned by the reporting workflow, not a DB enum.
- No target foreign key or target entity lookup. Target existence/reportability validation
  belongs to the owning report-creation workflow (CTMS-094), not status handling.
- The reporter FK has no cascading delete. Only the primary-key index is added: both T01
  queries address a report by ID. Status/reporter/target indexes await concrete query needs.
- No version, resolution, notes, soft-delete, target metadata or separate history table.

#### API and authorization

- `GET /api/content-reports/:reportId`: return authoritative report details.
- `PATCH /api/content-reports/:reportId/status`: transition a report.
- Both endpoints use existing `JwtAuthGuard`, `RolesGuard`, `@Roles(UserRole.ADMIN)`;
  service authorization also checks the current active user and granted roles from DB.
- PATCH body is exactly `{ expectedStatus, status }`, both approved lowercase statuses.
  The existing global whitelist validation rejects extra fields, including reporter,
  target, reason, actor or caller-supplied authoritative state. Actor comes from JWT context.
- Both return the same DTO using existing camelCase API conventions:
  `{ id, reporter: { id, fullName }, targetType, targetId, reason, status, createdAt, updatedAt }`.
  `fullName` may be null; only reporter ID and name are selected. No email, phone,
  password hash or other private profile data is exposed. Dates serialize as ISO strings.
- Errors: 401 unauthenticated/inactive actor; 403 non-Admin; 404 missing report;
  409 stale or invalid lifecycle transition; 422 invalid UUID, status or extra request fields.
- No list/create/delete endpoint or Web/Mobile UI is implemented in T01.

#### State, concurrency and history

- Original CTMS-38/T01 allow-list: `pending -> reviewing`, `pending -> actioned`,
  `pending -> rejected`. The approved CTMS-39 workflow follow-up adds
  `reviewing -> actioned` and `reviewing -> rejected`. Reviewing is intermediate;
  actioned/rejected are terminal. Every other pair, including same-state transitions,
  returns 409. No reopening or transition back to pending is allowed.
- Within one TypeORM transaction: authorize actor, lock/reload the report with
  `pessimistic_write`, compare its persisted status to `expectedStatus`, check the
  allow-list, save the new status and write exactly one shared `AuditLog`.
- Audit: `action = content_report.status_changed`, `targetType = content_report`,
  `targetId = report.id`, authenticated actor ID, before/after containing status only,
  `reason = null`; normal audit persistence supplies the timestamp.
- Failed/stale/invalid transitions create no successful status-change audit.
  An audit failure propagates out of the transaction and rolls back the report write.
- The current state lives in `content_reports`; shared `audit_logs` preserve transition
  history. No history deletion is exposed. No downstream moderation action is invoked.
- `actioned` means only that the report reaches that state; it makes no claim that a
  target has been deleted, hidden, suspended or otherwise changed.

#### Verification evidence

- Focused tests: `src/modules/content-reports/content-reports.service.spec.ts`,
  `content-reports.repository.spec.ts`, and `dto/transition-content-report.dto.spec.ts`.
- Real DB suite: `test/content-reports.integration-spec.ts`, using the existing guarded
  integration setup. Includes real concurrent HTTP transitions and a scoped PostgreSQL
  trigger rejecting the audit INSERT to verify actual rollback of status/timestamp.
- Unit tests model the transaction boundary; they are not evidence of PostgreSQL rollback.
- Latest checks: focused unit 46/46 PASS; TypeScript `--noEmit` PASS.
- PostgreSQL verification completed on 2026-09-22 using the normal repository configuration.
  `npm run migration:run` applied the existing pending `AllowNullableTripCapacityMax1787060000000`
  migration followed by `CreateContentReportsTable1787070000000` on `ctms` successfully.
  Real columns/defaults, enum values, reporter FK (no cascade), CHECK constraints and PK
  index match the T01 schema contract. No target FK or additional index was introduced.
- Focused real PostgreSQL integration: 42/42 PASS. Concurrent Admin decisions yield one
  success and one 409; forced audit INSERT failure rolls back report status and timestamp.
  No test trigger/function remains after cleanup. Migration recorded exactly once in both
  `ctms` and `ctms_test`.
- Full backend unit regression: 40 suites / 467 tests PASS (`jest --runInBand`).
- API TypeScript: PASS (`tsc --noEmit -p tsconfig.json`); Nest build: PASS (`npm run build`).
- Biome on the changed backend files: PASS. Full PostgreSQL integration regression:
  15 suites / 133 tests PASS (`jest --config ./test/jest-integration.json --runInBand`).
- No remaining technical blocker was found for the approved minimum contract. Story
  numbering/traceability requires separate human review; this verification does not resolve it.

### Responsibilities

- Implement or update the owning module's service, controller, repository, DTO, entity, migration, queue, provider, or sync handler as needed.
- Enforce PB V3.1 behavior and mapped Business Rules in backend logic.
- Keep transactions, idempotency, state validation, and audit behavior close to the domain operation.
- Reuse existing CTMS helpers for auth, validation, i18n, API errors, transactions, and tests.
- Keep this as the HOW-SYSTEM responsibility contract for `CTMS-105-T01`; do not duplicate the complete end-to-end flow in Jira.

### Required Tests

- Unit tests for validation, state transitions, mapped Business Rules, and failure paths.
- Integration/API tests for success, invalid input, unauthorized access, missing resource, conflict, idempotency, and rollback.
- Provider/sync/AI tests when this story depends on external service, offline queue, model output, or background processing.
- Regression tests proving no mapped Business Rule is silently bypassed.

### Logic Subtask DoD

- [x] Logic implementation completed for the approved T01 minimum contract above.
- [x] Applicable T01 business rules and invariants implemented and verified on real PostgreSQL.
- [x] Task-specific unit tests added or updated.
- [x] Task-specific unit tests passed (46/46).
- [x] Applicable backend or integration tests passed (focused 42/42; regression 133/133).

---

## 17. UI and Tests

### CTMS-39 — Approved UI and minimal queue support

Execution task: CTMS-39. Functional reference remains CTMS-105. This addition
extends the merged CTMS-38/T01 implementation above. Its schema, request contract,
locking, audit, rollback, and target-workflow contracts remain unchanged; the
approved workflow follow-up adds the two reviewing resolution transitions above.

#### Queue contract

- `GET /api/content-reports` uses the existing module, `JwtAuthGuard`, `RolesGuard`,
  `@Roles(UserRole.ADMIN)`, and current active Admin database check. Unauthenticated
  requests return 401; authenticated non-Admin requests return 403.
- Query: `page` (integer, minimum 1, default 1), `limit` (integer, 1–100, default 20).
  These match Admin Users. No search, filters, or user-selectable sorting is added.
  Invalid/unsupported query parameters follow the existing 422 validation behavior.
- Response: `{ items, pagination: { page, limit, total, totalPages } }`.
  Empty results have `items: []`, `total: 0`, `totalPages: 0`.
- Items reuse the detail response and shared mapping: `id`,
  `reporter: { id, fullName }`, `targetType`, `targetId`, `reason`, `status`,
  `createdAt`, `updatedAt`. Reporter name may be null; dates serialize to ISO strings.
- Ordering: `createdAt DESC, id DESC`. Reporter ID/name are joined in the list
  query; no per-item reporter fetch, target lookup, state write, or audit insert.
- No entity, migration, table, dependency, or PATCH contract change.

#### Client behavior

- `/admin/content-reports` uses the existing Admin layout/role guard. The existing
  “Báo cáo nội dung” sidebar entry now navigates to the page and is enabled.
- Typed `httpClient` / `API_ENDPOINTS` services load real queue/detail data.
  Hooks use the existing React state/effect/ref pattern; no new state library.
- Queue shows reporter name/ID, target type/ID, reason, status, creation time,
  backend pagination, loading, empty state, error, and retry.
- Selecting a row fetches `GET /api/content-reports/:reportId` into a detail panel
  with all authoritative fields, including updated time. Request sequencing ignores
  late responses from previously selected reports.
- Pending reports expose reviewing/actioned/rejected actions; reviewing reports
  expose only actioned/rejected. Actioned/rejected expose no transition actions. PATCH sends
  `{ expectedStatus: currentAuthoritativeStatus, status: requestedStatus }`.
  A synchronous ref lock blocks duplicate submission; relevant controls disable
  until completion. No optimistic status update is used.
- Success displays feedback and reloads queue/detail. HTTP 409 displays conflict
  feedback and reloads both reads, with no automatic PATCH retry.
- 401 follows shared session refresh/logout behavior; 403/404 remove stale action
  controls; 422 and generic errors show readable feedback. Failed reads allow retry.
- Actions update report status only. No content deletion/hiding, user suspension,
  booking cancellation, or target-domain edit is implemented or implied by Actioned.

#### CTMS-39 verification evidence before workflow follow-up

- Focused backend: 57 unit tests and 48 PostgreSQL integration tests passed.
- Focused Web: 21 component tests passed, including loading/empty/error/retry,
  pagination, details, all three transitions, duplicate protection, authoritative
  refresh, 409, 401/403/404/422/server errors, and late-response protection.
- Real-backend Playwright: 3 tests passed for Admin navigation/queue/detail/action,
  a concurrent real PATCH causing 409, and non-Admin UI/API rejection. Test-only
  fixtures create unique E2E users/reports and clean them up transactionally.
  No network mocking is used in this suite.
- Backend regression: 478 unit tests and 139 PostgreSQL integration tests passed.
- Web feature/routes regression: 35 passed, 2 failed in pre-existing trekking
  navigation assertions. Full Web run: 420/427 passed; the later required
  `test:all` run had 425/427 passed (only the two trekking assertions failed).
- Baseline comparison used an untouched `git archive` of HEAD
  `d3aa4b80edd7785724b4d6bbf11395563d387bec`, outside the working tree. The same two
  trekking failures and five RegisterPage failures reproduced when running those
  suites together on baseline. Baseline full run also exhibited auth mock/order
  sensitivity (393/406 passed); do not treat the varying auth results as stable PASS.
- E2E regression: 37 passed, 1 failed, 2 not run. All three CTMS-39 E2Es passed.
  The failing Create Trip case cannot log in with its existing Host fixture;
  a read-only database/bcrypt check confirmed the active Host's password does not
  match that fixture. The serial suite skips its remaining two cases. No Host
  account, auth code, or Create Trip test was changed to bypass this baseline issue.
- TypeScript Web/API passed. Web build and root `build:all` (including Nest build)
  passed; Vite reports the existing large-bundle warning. Root `lint:all` passed
  without warnings. Biome for intended TypeScript files and `git diff --check` passed.
- Root `test:all` failed: API 478/478 passed, Web 425/427 passed as above. Regression
  quality gates remain open; no unrelated auth/trekking fix is included in CTMS-39.
- Playwright outputs/screenshots/logs were directed to temporary folders. The
  pre-existing `apps/web/test-results/.last-run.json` was not changed. Generated
  build-info changes were removed. All implementation files remain unstaged.

#### Approved CTMS-39 workflow follow-up

Manual testing identified that reviewing could not be completed. The approved
minimal extension permits exactly these transitions:

| Current state | Allowed next states |
| --- | --- |
| pending | reviewing, actioned, rejected |
| reviewing | actioned, rejected |
| actioned | none |
| rejected | none |

All other pairs return 409, including same-state requests and reopening. The API
retains the existing expectedStatus check under pessimistic_write, transaction,
RBAC, and report-only audit. Each accepted step creates one
content_report.status_changed event with its actual before/after status. Audit
failure rolls back both status and updated_at; stale decisions create no event.

The UI uses the same per-state action selection for rendering and submit guards.
Reviewing offers only Actioned/Rejected; both final states hide every transition
button. Duplicate protection, backend-authoritative responses, success/409 refetch
of queue and detail, and no automatic mutation retry apply to both source states.
Queue/read/DTO contracts, schema, and target isolation are unchanged.

Manual evidence flows: A pending -> reviewing -> actioned; B pending -> reviewing
-> rejected; C pending -> actioned (or rejected). E2E uses its own four temporary
reports; it does not transition the user's three manual evidence reports.

Focused follow-up evidence: 61 backend unit tests, 53 real PostgreSQL integration
tests, 25 Web component tests, and 5 real-backend E2Es passed. Coverage includes
all 5 allowed pairs, all 11 forbidden pairs, both reviewed resolutions, stale
reviewing decisions, concurrent decisions from either source state, and real
audit-failure rollback from pending and reviewing. E2E validates both two-step
flows and terminal buttons; exact audit content is verified in integration tests.

Final follow-up gates: the router-before-Content-Reports order produced 25/25
Content Reports tests after the router's two known trekking assertion failures.
Backend regression remained 482 unit and 144 PostgreSQL integration tests passed.
Full Web regression was 429/431 in `test:all`, with only the two known trekking
navigation assertions failing in that run. Full E2E was 39 passed, 1 failed, and
2 skipped; the only failure was the existing Create Trip Host password/fixture
mismatch, and its two dependent cases were skipped. TypeScript, Web/Nest builds,
`lint:all`, `build:all`, and `git diff --check` passed.

### Responsibilities

- Implement screen/component/client state only when this story has a user-facing workflow.
- Wire UI to typed API contracts.
- Show loading, empty, blocked, validation, conflict, retry, and success states.
- Keep local/client validation aligned with backend DTOs without treating client validation as enforcement.
- Keep this as the HOW-CLIENT responsibility contract for `CTMS-111-T02`; backend/server responses remain the source of truth for server-owned business state.

### Required Tests

- Component or mobile widget tests for rendered states and user actions.
- Hook/client-state tests for API success, validation failure, authorization failure, conflict, and retry where applicable.
- Offline/error-state tests when the story includes pending local data or synchronization.
- Accessibility and interaction checks for critical user-facing flows.

### UI or Final Implementation Subtask DoD

- [x] UI implementation completed when this story has a client-facing workflow.
- [x] Applicable client-side behavior implemented.
- [x] Task-specific unit or component tests passed.
- [x] Backend integration completed.
- [x] Task-specific E2E tests passed when an end-to-end user path exists.
- [ ] All Story Acceptance Criteria verified.
- [ ] Unit regression tests passed.
- [ ] E2E regression tests passed.
- [x] `lint:all` passed.
- [x] `build:all` passed.
- [ ] `test:all` passed.
- If UI is not the final implementation subtask, move these integrated quality gates to the actual final implementation subtask or an explicit Story-level verification step.

---

## 18. Related Specifications

Dependencies:

- CTMS-006
- CTMS-100

Potentially related specs must be referenced for context only. Do not duplicate their owned logic in this spec.

---

## 19. Pending Decisions

Use this section for undefined, ambiguous, or conflicting behavior. Do not guess business behavior during implementation.

### PD-01 - API and DTO Contract

Status: UNRESOLVED

Question:
What are the final endpoint paths, request DTOs, response DTOs, and error payloads for `Handle Content Reports` if they are not already implemented?

Affected:
- Jira Story: `CTMS-105`
- Logic Subtask: `CTMS-105-T01`
- UI Subtask: `CTMS-105-T02`

Implementation impact:
Backend and UI integration cannot be finalized safely without a typed contract.

Required action:
BA, PO, or domain owner confirms the API contract, or the implementation records the approved contract in this spec before coding.

### PD-02 - Story-Specific State and Failure Semantics

Status: UNRESOLVED

Question:
Are there story-specific state enum values, partial failure semantics, retry limits, conflict rules, audit event names, or before/after audit payloads beyond the generic model in this spec?

Affected:
- Business Rules listed in Section 5.4
- Related specifications in Section 18

Implementation impact:
Implementers must not silently choose state, retry, conflict, or audit behavior when the approved sources do not define it.

Required action:
Resolve through Business Rules, Data Dictionary or Domain Model, Jira decision, or an explicit spec update before implementation.

### PD-03 - Source Conflict Handling

Status: UNRESOLVED WHEN A CONFLICT IS FOUND

Question:
Do PB V3.1, Business Rules, Data Dictionary or Domain Model, Jira, or existing code/tests disagree for this story?

Affected:
- PB V3.1 row `CTMS-111`
- Business Rules listed in Section 5.4
- Existing implementation and tests if present

Implementation impact:
A lower-level artifact that conflicts with an approved higher-level source is stale until reconciled.

Required action:
Record the conflict, stop short of inventing behavior, and request BA/PO/domain owner clarification.

---

## References

- Story ID: `CTMS-105`
- Epic: `EPIC 18. Administration and Audit`
- Jira Story owns WHAT and WHY for this capability.
- Jira Logic Subtask `CTMS-111-T01` owns HOW-SYSTEM responsibilities.
- Jira UI Subtask `CTMS-111-T02` owns HOW-CLIENT responsibilities when a client workflow exists.
- This file/spec owns the detailed execution flow, edge cases, contracts, invariants, and technical processing.
- Product Backlog V3.1 use case: `Handle Content Reports`
- Priority: `Should Have`
- Story points: `5.0`
- Dependencies: `CTMS-006, CTMS-094`
- Status: `To Do`
- Sprint: `Sprint 1`
- Commitment: `Stretch`
- Planned window: `2026-07-26` to `2026-08-08`
- Product Backlog source: `PRODUCT BACKLOG.xlsx`, sheet `v3.1`
- Business Rules source: `CTMS- Business rules.xlsx`, sheet `Business Rules`
- Story-level business rules: BR-018, BR-222, BR-223, BR-224
- Jira execution tasks should reference:
  - `/file/spec/ctms-111-handle-content-reports.md#backend-preparation-logic-and-tests`
  - `/file/spec/ctms-111-handle-content-reports.md#ui-and-tests`
