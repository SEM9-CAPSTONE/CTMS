# CTMS-066 - View Each Member's Last Synced Location

**Spec Reference**  
/file/spec/ctms-66-view-each-member-s-last-synced-location.md

**Source Authority**  
- Product Backlog V3.1 is the scope authority for this story.
- Business Rules are the invariant/policy source. This spec rewrites relevant rules as executable behavior so Dev and QA do not need to infer behavior from rule IDs.
- Jira is used for execution tracking, status, and task ownership. Jira content must not replace the behavior contract below.
- Authority order for conflicts: Business Rules V3, Data Dictionary or Domain Model V3, approved Jira requirement or decision, this file/spec, code, then tests.

---

## 1. Purpose

Implement `View Each Member's Last Synced Location` so the CTMS workflow is safe, consistent, auditable, and aligned with PB V3.1.

Business purpose from PB V3.1:

- English use case: `View Each Member's Last Synced Location`
- Story: As a System, I want to view each member's last synced location so that CTMS supports the workflow safely and consistently.

Implementation details belong in the sections below, not in this purpose summary.

---

## 2. Scope

### In Scope
- The behavior needed for `View Each Member's Last Synced Location` within `EPIC 10. Buffer and Synchronization`.
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

- System: primary actor for this workflow.
- Backend API: validates authorization, state, input, persistence, idempotency, and audit requirements.
- UI Client: presents allowed actions, validates obvious input, shows loading/success/error states, and never replaces backend enforcement.
- Related CTMS modules: provide referenced Trip, Route, Booking, Payment, Offline Package, AI, Notification, or Administration data when this story depends on them.

---

## 4. Preconditions

- Actor is authenticated when the workflow requires identity.
- Actor has the role, ownership, consent, assignment, or operational relationship required by the story.
- Referenced records exist and are in states that allow this workflow.
- Dependencies are satisfied: CTMS-065.
- PB V3.1 acceptance criteria and the Business Rules listed in this spec are available to implementation and QA.

If a precondition is not satisfied, the system must reject the action or show a blocked/degraded state without unintended side effects.

---

## 5. Business Behavior

### 5.1 Primary Behavior

The system implements `View Each Member's Last Synced Location` exactly within the PB V3.1 scope:

- Implement the PB V3.1 acceptance behavior for `View Each Member's Last Synced Location` exactly as approved in the source backlog.
- Convert each source acceptance condition into explicit validation, state, persistence, UI, and test behavior during implementation.
- Do not copy non-English backlog text into this English spec; keep the workbook as the source citation.

### 5.2 Validation Rules

- Required fields, enum values, date/time ranges, identifiers, ownership boundaries, and cross-entity references are validated before persistence.
- Backend is authoritative for permission, state, price, capacity, inventory, safety, payment, and operational outcomes.
- UI validation may improve the experience, but backend validation is mandatory and final.
- Invalid input returns a clear error and does not partially create, update, or synchronize records.

### 5.3 State and Persistence Rules

- State transitions must be explicit, auditable, and reversible only where the source rules allow reversal.
- Writes must be transactional for records changed by a single business action.
- Repeated client submissions must not create duplicate business records.
- Synchronization and offline behavior must preserve ordering, identity, and conflict handling where this story touches offline or real-time flows.

### 5.4 Business Rules Materialized

The following rules are materialized as behavior for this story:

| ID | Content |
| --- | --- |
| `BR-246` | After reconnect, pending GPS logs and safety events must synchronize automatically. Each item keeps `pending`, `synced`, or `failed` state. Sync must preserve client event time, UUID, location, GPS accuracy, and package/version context so the server can reconstruct detection conditions. |
| `BR-405` | Required behavior for `View Each Member's Last Synced Location` must validate and enforce event, sync, offline, Host, monitoring, delayed, stale, indicator as part of the story-specific business contract. Backend checks must run before persistence, violations must be rejected without partial side effects, UI must show blocked or conflict states where relevant, and tests must cover both allowed and violation paths. |
| `BR-406` | Required behavior for `View Each Member's Last Synced Location` must validate and enforce Host, monitoring, location, current, last_seen, event_time, member, online, recent, stale as part of the story-specific business contract. Backend checks must run before persistence, violations must be rejected without partial side effects, UI must show blocked or conflict states where relevant, and tests must cover both allowed and violation paths. |
| `BR-407` | Required behavior for `View Each Member's Last Synced Location` must validate and enforce Host, location, safety, state, member, Trip, authorization as part of the story-specific business contract. Backend checks must run before persistence, violations must be rejected without partial side effects, UI must show blocked or conflict states where relevant, and tests must cover both allowed and violation paths. |
| `BR-172` | Backend access control must be checked from role, ownership, and business scope before the workflow proceeds; UI visibility is not a substitute for backend authorization. |
| `BR-173` | Personally identifiable, health, payment, location, and safety data must be minimized and returned only to actors with a valid business need. |
| `BR-186` | Personal data and health data may return only the fields required for the business purpose and only to an authorized actor. |
| `BR-201` | UI behavior must reflect backend state accurately and must show clear loading, success, empty, validation, permission, conflict, and retry states where applicable. |
| `BR-212` | Any Business Rule, enum, state transition, or API contract change must update the spec, tests, and data documentation before the story is Done. |
| `BR-213` | Every mapped Business Rule must have at least one valid-path test and one violation-path test; concurrency, idempotency, and transaction rules require integration or E2E coverage. |

### 5.5 Source Confidence

- PB V3.1 row `CTMS-066` is the direct scope and acceptance source.
- Rule IDs above come from the `Primary BR IDs` column in PB V3.1 and are materialized here as implementation behavior.
- If a rule ID conflicts with PB V3.1 behavior, do not silently choose one. Record a Pending Decision and update PB/rules/spec together.
- This file may elaborate approved behavior into execution flow, but it must not invent, change, or override business behavior.
- Undefined, ambiguous, or conflicting behavior must be captured in Section 19 as a Pending Decision.

---

## 6. Main Flow

1. Actor starts `View Each Member's Last Synced Location` from the permitted entry point.
2. UI or API collects the minimum information needed by the story.
3. Backend validates identity, role, state, references, and business invariants.
4. Backend persists the approved change or returns a blocked state with a clear reason.
5. System exposes the resulting state to the actor and dependent modules.
6. System records audit evidence needed for support, QA, and compliance review.

---

## 7. Alternate and Exception Flows

- If authentication fails, the system rejects the action and does not persist changes.
- If authorization fails, the system hides or blocks the action and returns a permission error.
- If required data is missing or invalid, the system returns validation feedback and keeps existing state unchanged.
- If the referenced record is no longer eligible, the system returns a conflict or blocked state.
- If synchronization, notification, payment, AI, or external processing is unavailable, the system records a retryable/degraded state only when the source rules allow it.

---

## 8. API and Backend Contract

- Backend endpoints or services must be scoped to `CTMS-066` behavior and must not expose unrelated state changes.
- Request DTOs must validate required fields, formats, enum values, and cross-entity identifiers.
- Response DTOs must include enough state for the UI to show success, pending, blocked, validation failure, authorization failure, and retry states.
- Service logic must be covered by unit tests for success, validation failure, permission failure, conflict, duplicate submission, and retry/degraded behavior where applicable.

---

## 9. UI Contract

- UI shows only actions available to the actor and current state.
- UI presents loading, success, empty, validation error, permission error, conflict, and retry states where relevant.
- UI must not imply that an action succeeded until backend confirmation or an explicitly pending state is returned.
- UI copy must be in English for this spec and must be externalized according to the application's i18n pattern during implementation.

---

## 10. Data, Audit, and Security

- Store only fields required by the approved workflow.
- Protect personally identifiable, financial, location, safety, and operational data according to the role and ownership model.
- Audit records must be queryable by story-relevant identifiers.
- No sensitive token, OTP, payment credential, or private location trail may be logged in plaintext.

---

## 11. Acceptance Criteria

- AC1: The actor can complete `View Each Member's Last Synced Location` when all preconditions and business rules are satisfied.
- AC2: The system blocks the action with a clear reason when authentication, authorization, state, reference, or validation requirements fail.
- AC3: Successful completion persists the correct state and exposes it through the expected UI/API surface.
- AC4: Duplicate submissions, retries, and reconnection paths do not create duplicated business effects.
- AC5: Audit evidence is recorded for the successful and rejected paths required by this story.
- AC6: Tests cover success, validation failure, permission failure, conflict, and retry/degraded states where applicable.

---

## 12. Test Notes

- Unit tests cover backend validation, authorization, state transition, idempotency, and audit behavior.
- Integration tests cover persistence and dependent module contracts.
- UI tests cover enabled/disabled actions, success, loading, empty, validation error, permission error, conflict, and retry states.
- Regression tests cover dependencies: CTMS-065.

---

## 13. Jira Story Mapping

- Jira Story: `CTMS-066`
- Story summary: `View Each Member's Last Synced Location`
- Story description should state WHAT and WHY only; implementation details stay in this file/spec and subtasks.
- Logic Subtask: `CTMS-066-T01`
- UI Subtask: `CTMS-066-T02`
- Test Subtask: `CTMS-066-T03`

---

## 14. Logic Subtask Scope

- Implement backend validation, authorization, state handling, persistence, idempotency, audit, and integration contracts needed for `View Each Member's Last Synced Location`.
- Add or update service tests for success, invalid input, forbidden access, conflict, duplicate submission, and retry/degraded behavior.
- Keep implementation aligned with this spec and the mapped Business Rules.

---

## 15. UI Subtask Scope

- Implement the UI/API client behavior needed for `View Each Member's Last Synced Location`.
- Display allowed actions and clear state feedback for success, loading, empty, validation, permission, conflict, and retry/degraded outcomes.
- Keep labels and messages externalized through the application i18n pattern.

---

## 16. Pending Decisions

- No pending decision is recorded in this generated baseline. If PB V3.1 acceptance criteria are ambiguous, record the exact open question here before implementation.

---

## 17. Traceability

- PB V3.1 row: `CTMS-066`
- Epic: `EPIC 10. Buffer and Synchronization`
- Primary BR IDs: `BR-246, BR-405, BR-406, BR-407, BR-172, BR-173, BR-186, BR-201, BR-212, BR-213`
- Dependencies: `CTMS-065`
- Jira artifacts must link back to this spec path: `/file/spec/ctms-66-view-each-member-s-last-synced-location.md`

---

## 18. Definition of Done

- Spec, Jira Story, Logic subtask, UI subtask, implementation, and tests are consistent.
- Mapped Business Rules are implemented explicitly, not merely referenced.
- Acceptance Criteria pass in automated tests or documented QA evidence.
- Audit, security, permission, state, and idempotency behavior are covered where relevant.
- No unresolved Pending Decision blocks release.

---

## 19. References

- Story ID: `CTMS-066`
- Product Backlog V3.1 use case: `View Each Member's Last Synced Location`
- Epic: `EPIC 10. Buffer and Synchronization`
- Priority: `Must Have`
- Story points: `8.0`
- Dependencies: `CTMS-065`
- Status: `To Do`
- Sprint: `Sprint 4`
- Commitment: `Committed`
