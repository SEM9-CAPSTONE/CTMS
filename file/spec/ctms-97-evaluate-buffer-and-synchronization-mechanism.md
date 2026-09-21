# CTMS-097 - Evaluate Buffer and Synchronization Mechanism

**Spec Reference**  
/file/spec/ctms-97-evaluate-buffer-and-synchronization-mechanism.md

**Source Authority**  
- Product Backlog V3.1 is the scope authority for this story.
- Business Rules are the invariant/policy source. This spec rewrites relevant rules as executable behavior so Dev and QA do not need to infer behavior from rule IDs.
- Jira is used for execution tracking, status, and task ownership. Jira content must not replace the behavior contract below.
- Authority order for conflicts: Business Rules V3, Data Dictionary or Domain Model V3, approved Jira requirement or decision, this file/spec, code, then tests.

---

## 1. Purpose

Implement `Evaluate Buffer and Synchronization Mechanism` so the CTMS workflow is safe, consistent, auditable, and aligned with PB V3.1.

Business purpose from PB V3.1:

- English use case: `Evaluate Buffer and Synchronization Mechanism`
- Story: As a System, I want to evaluate buffer and synchronization mechanism so that CTMS supports the workflow safely and consistently.

Implementation details belong in the sections below, not in this purpose summary.

---

## 2. Scope

### In Scope
- The behavior needed for `Evaluate Buffer and Synchronization Mechanism` within `EPIC 17. Reports and Evaluation Metrics`.
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

The system implements `Evaluate Buffer and Synchronization Mechanism` exactly within the PB V3.1 scope:

- Implement the PB V3.1 acceptance behavior for `Evaluate Buffer and Synchronization Mechanism` exactly as approved in the source backlog.
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
| `BR-278` | Required behavior for `Evaluate Buffer and Synchronization Mechanism` must validate and enforce Buffer, synchronization, evaluation, partial, acceptance, rules, Release, gates, valid, records as part of the story-specific business contract. Backend checks must run before persistence, violations must be rejected without partial side effects, UI must show blocked or conflict states where relevant, and tests must cover both allowed and violation paths. |
| `BR-282` | V3 release gates are approved acceptance thresholds. Evaluation reports must store dataset/version, metric value, threshold, rule/model/config version, and pass/fail conclusion. Observational metrics are reported but do not fail release automatically. |
| `BR-436` | Required behavior for `Evaluate Buffer and Synchronization Mechanism` must validate and enforce Offline, sync, evaluation, restart, retry, duplicate, batch, order, records, partial as part of the story-specific business contract. Backend checks must run before persistence, violations must be rejected without partial side effects, UI must show blocked or conflict states where relevant, and tests must cover both allowed and violation paths. |
| `BR-441` | V3 safety tracking configuration is fixed: GPS sampling every 10 seconds, GPS log every 30 seconds, runtime valid accuracy `<= 20m`, OFF_ROUTE `> 50m` with 3 VALID samples, ON_ROUTE recovery `< 20m` with 3 VALID samples, and Route Checkpoint reached `<= 20m` with 3 VALID samples. |
| `BR-442` | Required behavior for `Evaluate Buffer and Synchronization Mechanism` must validate and enforce record, acknowledgement, sync, batch, stable, identifier, result, accepted, duplicate, failed as part of the story-specific business contract. Backend checks must run before persistence, violations must be rejected without partial side effects, UI must show blocked or conflict states where relevant, and tests must cover both allowed and violation paths. |
| `BR-443` | Required behavior for `Evaluate Buffer and Synchronization Mechanism` must validate and enforce synced, record, acknowledgement, accepted, duplicate, retry, failed, retryable, failure_reason, audit as part of the story-specific business contract. Backend checks must run before persistence, violations must be rejected without partial side effects, UI must show blocked or conflict states where relevant, and tests must cover both allowed and violation paths. |
| `BR-188` | Date and time handling must use the authoritative timezone and ordering rules for the business workflow, and invalid or impossible time ranges must be rejected. |
| `BR-212` | Any Business Rule, enum, state transition, or API contract change must update the spec, tests, and data documentation before the story is Done. |
| `BR-213` | Every mapped Business Rule must have at least one valid-path test and one violation-path test; concurrency, idempotency, and transaction rules require integration or E2E coverage. |
| `BR-403` | Required behavior for `Evaluate Buffer and Synchronization Mechanism` must validate and enforce GPS, validate, schema, coordinate, range, timestamps, package, version, references, synced as part of the story-specific business contract. Backend checks must run before persistence, violations must be rejected without partial side effects, UI must show blocked or conflict states where relevant, and tests must cover both allowed and violation paths. |
| `BR-437` | Published Offline Safety Packages are immutable. When authoritative safety data changes, create a new version. For Trips not yet started, the client downloads, validates, and activates the new version before deleting the old package. Ongoing Trips continue using the current active package and are not hot-updated. |

### 5.5 Source Confidence

- PB V3.1 row `CTMS-097` is the direct scope and acceptance source.
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

### Scenario: Evaluate Buffer and Synchronization Mechanism

1. Actor opens or triggers the `Evaluate Buffer and Synchronization Mechanism` workflow.
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

If dependency data from `CTMS-066` is missing or not in an allowed state, block the workflow with a clear reason.

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

The implementation must persist or return only data required for `Evaluate Buffer and Synchronization Mechanism`:

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

- The approved PB V3.1 acceptance behavior for `Evaluate Buffer and Synchronization Mechanism` is implemented as explicit system behavior..

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

- The actor or system attempts `Evaluate Buffer and Synchronization Mechanism`.

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

### Responsibilities

- Implement or update the owning module's service, controller, repository, DTO, entity, migration, queue, provider, or sync handler as needed.
- Enforce PB V3.1 behavior and mapped Business Rules in backend logic.
- Keep transactions, idempotency, state validation, and audit behavior close to the domain operation.
- Reuse existing CTMS helpers for auth, validation, i18n, API errors, transactions, and tests.
- Keep this as the HOW-SYSTEM responsibility contract for `CTMS-103-T01`; do not duplicate the complete end-to-end flow in Jira.

### Required Tests

- Unit tests for validation, state transitions, mapped Business Rules, and failure paths.
- Integration/API tests for success, invalid input, unauthorized access, missing resource, conflict, idempotency, and rollback.
- Provider/sync/AI tests when this story depends on external service, offline queue, model output, or background processing.
- Regression tests proving no mapped Business Rule is silently bypassed.

### Logic Subtask DoD

- [ ] Logic implementation completed.
- [ ] Applicable business rules and invariants implemented.
- [ ] Task-specific unit tests added or updated.
- [ ] Task-specific unit tests passed.
- [ ] Applicable backend or integration tests passed.

---

## 17. UI and Tests

### Responsibilities

- Implement screen/component/client state only when this story has a user-facing workflow.
- Wire UI to typed API contracts.
- Show loading, empty, blocked, validation, conflict, retry, and success states.
- Keep local/client validation aligned with backend DTOs without treating client validation as enforcement.
- Keep this as the HOW-CLIENT responsibility contract for `CTMS-103-T02`; backend/server responses remain the source of truth for server-owned business state.

### Required Tests

- Component or mobile widget tests for rendered states and user actions.
- Hook/client-state tests for API success, validation failure, authorization failure, conflict, and retry where applicable.
- Offline/error-state tests when the story includes pending local data or synchronization.
- Accessibility and interaction checks for critical user-facing flows.

### UI or Final Implementation Subtask DoD

- [ ] UI implementation completed when this story has a client-facing workflow.
- [ ] Applicable client-side behavior implemented.
- [ ] Task-specific unit or component tests passed.
- [ ] Backend integration completed.
- [ ] Task-specific E2E tests passed when an end-to-end user path exists.
- [ ] All Story Acceptance Criteria verified.
- [ ] Unit regression tests passed.
- [ ] E2E regression tests passed.
- [ ] `lint:all` passed.
- [ ] `build:all` passed.
- [ ] `test:all` passed.
- If UI is not the final implementation subtask, move these integrated quality gates to the actual final implementation subtask or an explicit Story-level verification step.

---

## 18. Related Specifications

Dependencies:

- CTMS-066

Potentially related specs must be referenced for context only. Do not duplicate their owned logic in this spec.

---

## 19. Pending Decisions

Use this section for undefined, ambiguous, or conflicting behavior. Do not guess business behavior during implementation.

### PD-01 - API and DTO Contract

Status: UNRESOLVED

Question:
What are the final endpoint paths, request DTOs, response DTOs, and error payloads for `Evaluate Buffer and Synchronization Mechanism` if they are not already implemented?

Affected:
- Jira Story: `CTMS-097`
- Logic Subtask: `CTMS-097-T01`
- UI Subtask: `CTMS-097-T02`

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
- PB V3.1 row `CTMS-103`
- Business Rules listed in Section 5.4
- Existing implementation and tests if present

Implementation impact:
A lower-level artifact that conflicts with an approved higher-level source is stale until reconciled.

Required action:
Record the conflict, stop short of inventing behavior, and request BA/PO/domain owner clarification.

---

## References

- Story ID: `CTMS-097`
- Epic: `EPIC 17. Reports and Evaluation Metrics`
- Jira Story owns WHAT and WHY for this capability.
- Jira Logic Subtask `CTMS-103-T01` owns HOW-SYSTEM responsibilities.
- Jira UI Subtask `CTMS-103-T02` owns HOW-CLIENT responsibilities when a client workflow exists.
- This file/spec owns the detailed execution flow, edge cases, contracts, invariants, and technical processing.
- Product Backlog V3.1 use case: `Evaluate Buffer and Synchronization Mechanism`
- Priority: `Must Have`
- Story points: `8.0`
- Dependencies: `CTMS-065`
- Status: `To Do`
- Sprint: `Sprint 5`
- Commitment: `Stretch`
- Planned window: `2026-09-20` to `2026-10-03`
- Product Backlog source: `PRODUCT BACKLOG.xlsx`, sheet `v3.1`
- Business Rules source: `CTMS- Business rules.xlsx`, sheet `Business Rules`
- Story-level business rules: BR-231, BR-233, BR-235, BR-237, BR-365, BR-371, BR-372, BR-437, BR-438, BR-219, BR-239, BR-240, BR-245, BR-246, BR-247, BR-379, BR-383, BR-385, BR-386, BR-390, BR-391, BR-395, BR-396, BR-441
- Jira execution tasks should reference:
  - `/file/spec/ctms-103-evaluate-buffer-and-synchronization-mechanism.md#backend-preparation-logic-and-tests`
  - `/file/spec/ctms-103-evaluate-buffer-and-synchronization-mechanism.md#ui-and-tests`
