# CTMS-34 - Approve and Publish Trip

**Spec Reference**  
/file/spec/ctms-34-approve-and-publish-trip.md

**Story Title**  
Approve and Publish Trip

**Status**  
To Do

**Story**  
As an Admin, I want to approve and Publish Trip so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [ ] Only Trips with status = pending_approval and valid data can move to status = published.
- [ ] overnight Trips must have complete trip_camp_stays. If not approved, keep status = pending_approval for Host edits and save the reason in audit_logs/notifications.
- [ ] cancelled Trips move to status = cancelled. Do not use rejected.

## Business Rules Checklist
- [ ] BR-091: Capacity must be checked according to CTMS-31.
- [ ] BR-092: Only a Trip with status = pending_approval and valid data may move to status = published.
- [ ] BR-093: Overnight Trips must have complete trip_camp_stays. If not approved, keep status = pending_approval so the Host can edit it, and store the reason in audit_logs/notifications.
- [ ] BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.
- [ ] BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.
- [ ] BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.
- [ ] BR-210: When concurrent requests change the same resource, the system must use transactions, locking, or version control to prevent overwrites and business limit violations.
- [ ] BR-211: Every stateful resource must follow the defined state transitions and must not use values outside the database enum.
- [ ] BR-221: OTP TTL, token TTL, retry count, rate limit, booking hold duration, and retry deadline must be configurable and not hard-coded in logic.
- [ ] BR-222: Important actions must be written to the audit log with actor, action, target, timestamp, before/after data, or change reason.
- [ ] BR-223: Audit logs are append-only; users and Admins must not edit or delete audit logs through normal business functions.
- [ ] BR-224: Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data.
- [ ] BR-225: Automated actions must record actor_id = NULL or a system actor and include a clear execution reason.
- [ ] BR-226: Notifications may only be emitted after the business change succeeds; notification delivery failure must not undo the main transaction result.
- [ ] BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.
- [ ] BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data.
- [ ] BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.
- [ ] BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.
- [ ] BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.

## Dev Notes
- Jira status on 2026-08-04: `To Do`.
- Priority: `Must Have`; Story points: `5`; Commitment: `Committed`.
- Epic: `EPIC 5. Trip Management`.
- Sprint: `Sprint 3`; planned window: `2026-08-23` to `2026-09-05`.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks
- CTMS-34-T01 [BE / Shared Logic] Implement `Approve and Publish Trip` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-210, BR-211, BR-221, BR-222, BR-223, BR-224, BR-225, BR-226, BR-091, BR-092, BR-093, BR-206, BR-207. Ref: /file/spec/ctms-34-approve-and-publish-trip.md#backend-preparation-logic-and-tests
- CTMS-34-T02 [UI Web/Mobile/Consumer] Implement `Approve and Publish Trip` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-240, BR-241, BR-242, BR-091, BR-092, BR-093. Ref: /file/spec/ctms-34-approve-and-publish-trip.md#ui-and-tests

## Task to Acceptance Criteria Traceability
| Acceptance criterion / BR | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: Only Trips with status = pending_approval and valid data can move to status = published | CTMS-34-T01, CTMS-34-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC2: overnight Trips must have complete trip_camp_stays. If not approved, keep status = pending_approval for Host edits and save the reason in audit_logs/notifications | CTMS-34-T01, CTMS-34-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC3: cancelled Trips move to status = cancelled. Do not use rejected | CTMS-34-T01, CTMS-34-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. | CTMS-34-T01, CTMS-34-T02 | Tests and review evidence must prove this exact rule is enforced: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. |
| BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data. | CTMS-34-T01, CTMS-34-T02 | Tests and review evidence must prove this exact rule is enforced: Users may only view or change data they own unless their role and business relationship allow access to another user's data. |
| BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. | CTMS-34-T01, CTMS-34-T02 | Tests and review evidence must prove this exact rule is enforced: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. |
| BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. | CTMS-34-T01, CTMS-34-T02 | Tests and review evidence must prove this exact rule is enforced: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. |
| BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. | CTMS-34-T01, CTMS-34-T02 | Tests and review evidence must prove this exact rule is enforced: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. | CTMS-34-T01, CTMS-34-T02 | Tests and review evidence must prove this exact rule is enforced: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. |
| BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect. | CTMS-34-T01 | Tests and review evidence must prove this exact rule is enforced: Cases with insufficient permission or unmet business conditions must not create any side effect. |
| BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. | CTMS-34-T01 | Tests and review evidence must prove this exact rule is enforced: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. |
| BR-210: When concurrent requests change the same resource, the system must use transactions, locking, or version control to prevent overwrites and business limit violations. | CTMS-34-T01 | Tests and review evidence must prove this exact rule is enforced: When concurrent requests change the same resource, the system must use transactions, locking, or version control to prevent overwrites and business limit violations. |
| BR-211: Every stateful resource must follow the defined state transitions and must not use values outside the database enum. | CTMS-34-T01 | Tests and review evidence must prove this exact rule is enforced: Every stateful resource must follow the defined state transitions and must not use values outside the database enum. |
| BR-221: OTP TTL, token TTL, retry count, rate limit, booking hold duration, and retry deadline must be configurable and not hard-coded in logic. | CTMS-34-T01 | Tests and review evidence must prove this exact rule is enforced: OTP TTL, token TTL, retry count, rate limit, booking hold duration, and retry deadline must be configurable and not hard-coded in logic. |
| BR-222: Important actions must be written to the audit log with actor, action, target, timestamp, before/after data, or change reason. | CTMS-34-T01 | Tests and review evidence must prove this exact rule is enforced: Important actions must be written to the audit log with actor, action, target, timestamp, before/after data, or change reason. |
| BR-223: Audit logs are append-only; users and Admins must not edit or delete audit logs through normal business functions. | CTMS-34-T01 | Tests and review evidence must prove this exact rule is enforced: Audit logs are append-only; users and Admins must not edit or delete audit logs through normal business functions. |
| BR-224: Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data. | CTMS-34-T01 | Tests and review evidence must prove this exact rule is enforced: Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data. |
| BR-225: Automated actions must record actor_id = NULL or a system actor and include a clear execution reason. | CTMS-34-T01 | Tests and review evidence must prove this exact rule is enforced: Automated actions must record actor_id = NULL or a system actor and include a clear execution reason. |
| BR-226: Notifications may only be emitted after the business change succeeds; notification delivery failure must not undo the main transaction result. | CTMS-34-T01 | Tests and review evidence must prove this exact rule is enforced: Notifications may only be emitted after the business change succeeds; notification delivery failure must not undo the main transaction result. |
| BR-091: Capacity must be checked according to CTMS-31. | CTMS-34-T01, CTMS-34-T02 | Tests and review evidence must prove this exact rule is enforced: Capacity must be checked according to CTMS-31. |
| BR-092: Only a Trip with status = pending_approval and valid data may move to status = published. | CTMS-34-T01, CTMS-34-T02 | Tests and review evidence must prove this exact rule is enforced: Only a Trip with status = pending_approval and valid data may move to status = published. |
| BR-093: Overnight Trips must have complete trip_camp_stays. If not approved, keep status = pending_approval so the Host can edit it, and store the reason in audit_logs/notifications. | CTMS-34-T01, CTMS-34-T02 | Tests and review evidence must prove this exact rule is enforced: Overnight Trips must have complete trip_camp_stays. If not approved, keep status = pending_approval so the Host can edit it, and store the reason in audit_logs/notifications. |

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped BR missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements
- Implement the `Approve and Publish Trip` workflow exactly within `EPIC 5. Trip Management`.
- Enforce role-based access before executing any domain action.
- Validate all required fields, enum values, date ranges, ownership boundaries, and cross-entity references before writing data.
- Return consistent API errors: 401 for authentication failures, 403 for authorization failures, 404 for missing resources, 409 for business conflicts, and 422 for invalid input.

## Data and Persistence Requirements
- Persist only validated data and keep all foreign-key relationships scoped to existing, authorized CTMS records.
- Use transactions for multi-record updates, capacity checks, payments, booking changes, equipment changes, synchronization, or any workflow with side effects.
- Store timestamps in a consistent server-side format and preserve source timestamps when client-side events are synchronized later.
- Avoid hard deletes unless the related database model and business rule explicitly allow them.

## State and Audit Requirements
- Validate the current state before every transition and reject transitions that are not explicitly allowed.
- Record important create, update, approval, cancellation, payment, synchronization, administrative, and safety-related actions in audit logs.
- Capture actor, target type, target id, before value, after value, timestamp, and reason whenever those fields apply.
- Notify affected users when the workflow changes booking, trip, route, campsite, Porter, SOS, emergency, or administrative state.

## File Structure Notes
- Backend: place controllers, DTOs, services, repositories, guards, and tests in the module that owns the domain entity.
- Frontend: place screens, components, hooks, API clients, schemas, and tests in the feature folder that owns the workflow.
- Shared constants, enums, query keys, and validation schemas should be centralized only when reused by more than one feature.
- Keep migration, seed, and fixture changes close to the persistence model they support.

## Implementation Guidance for the Dev Agent
- Start by reading the existing module patterns before adding new files or abstractions.
- Keep the implementation narrow to this story and reuse existing CTMS helpers for auth, validation, transactions, i18n, API errors, and tests.
- Build backend behavior first when the UI depends on an API contract, then wire the frontend to the typed contract.
- Do not mark the story Done until mapped ACs, business rules, audit behavior, and regression tests are all covered.

## Testing Requirements
- Add unit tests for domain validation, permission checks, state transitions, and mapped business rule violations.
- Add API or integration tests for success, invalid input, unauthorized access, missing resource, conflict, and rollback cases.
- Add UI/component tests for rendering, validation messages, disabled states, loading states, error handling, and successful submission where UI exists.
- Add E2E coverage for the primary user journey and at least one critical failure path.
- Every BR listed in the Business Rules Checklist must appear in at least one test or review evidence item.

## References
- Story ID: `CTMS-34`
- Epic: `EPIC 5. Trip Management`
- Sprint: `Sprint 3`
- Dependencies: `CTMS-06, CTMS-32, CTMS-33`
- Linked items: `Blocked by: CTMS-06, CTMS-32, CTMS-33

Blocks: CTMS-36, CTMS-40, CTMS-47, CTMS-67`
- Spec Reference: `/file/spec/ctms-34-approve-and-publish-trip.md`
- Business Rules workbook: `C:/Users/admin/Downloads/CTMS_Global_Business_Rules_Sprint_1-3.xlsx`
- Story-level BRs: `BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-210, BR-211, BR-221, BR-222, BR-223, BR-224, BR-225, BR-226, BR-091, BR-092, BR-093`
