# CTMS-03 - Log In

**Spec Reference**  
/file/spec/ctms-03-log-in.md

**Story Title**  
Log In

**Status**  
In Progress

**Story**  
As a user, I want to log In so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [ ] Valid credentials return an access token and refresh token.
- [ ] invalid credentials show an appropriate error message.
- [ ] locked accounts cannot log in.

## Business Rules Checklist
- [ ] BR-008: An account must not be activated with an incorrect, expired, or already-used OTP.
- [ ] BR-009: Valid login credentials must return an access token and a refresh token.
- [ ] BR-010: When login credentials are invalid, the system must return an appropriate message and must not create a login session.
- [ ] BR-200: Every change must be written to the audit log.
- [ ] BR-201: Every function requiring authentication may only be performed when the user has a valid login session and the account is active.
- [ ] BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.
- [ ] BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.
- [ ] BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.
- [ ] BR-206: The backend is the final authority for permissions, status, pricing, capacity, inventory, risk level, and transaction results; clients must not set these values by themselves.
- [ ] BR-207: Every change involving multiple tables or records must run in a transaction; if one step fails, the whole business operation must roll back.
- [ ] BR-209: Operations that may be retried, such as payment, refund, callback, and synchronization, must support idempotency so one request cannot be successfully processed more than once.
- [ ] BR-214: Every data relationship must reference an existing and valid record; child records must not be created for resources outside the correct business scope.
- [ ] BR-215: Emails must be normalized before comparison and storage; phone numbers must be normalized to a consistent format, preferably E.164.
- [ ] BR-220: A valid time range must have a start time earlier than the end time, unless the business rule explicitly allows equality.
- [ ] BR-225: Automated actions must record actor_id = NULL or a system actor and include a clear execution reason.
- [ ] BR-226: Notifications may only be emitted after the business change succeeds; notification delivery failure must not undo the main transaction result.
- [ ] BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.
- [ ] BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data.
- [ ] BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.
- [ ] BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.
- [ ] BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.

## Dev Notes
- Jira status on 2026-08-04: `In Progress`.
- Priority: `Must Have`; Story points: `5`; Commitment: `Committed`.
- Epic: `EPIC 1. Authentication`.
- Sprint: `Sprint 1`; planned window: `2026-07-26` to `2026-08-08`.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks
- CTMS-03-T01 [BE / Shared Logic] Implement `Log In` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-200, BR-201, BR-214, BR-215, BR-220, BR-206, BR-207, BR-209, BR-225, BR-226, BR-008, BR-009, BR-010. Ref: /file/spec/ctms-03-log-in.md#backend-preparation-logic-and-tests
- CTMS-03-T02 [UI Web/Mobile/Consumer] Implement `Log In` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-240, BR-241, BR-242, BR-008, BR-009, BR-010. Ref: /file/spec/ctms-03-log-in.md#ui-and-tests

## Task to Acceptance Criteria Traceability
| Acceptance criterion / BR | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: Valid credentials return an access token and refresh token | CTMS-03-T01, CTMS-03-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC2: invalid credentials show an appropriate error message | CTMS-03-T01, CTMS-03-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC3: locked accounts cannot log in | CTMS-03-T01, CTMS-03-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. | CTMS-03-T01, CTMS-03-T02 | Tests and review evidence must prove this exact rule is enforced: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. |
| BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data. | CTMS-03-T01, CTMS-03-T02 | Tests and review evidence must prove this exact rule is enforced: Users may only view or change data they own unless their role and business relationship allow access to another user's data. |
| BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. | CTMS-03-T01, CTMS-03-T02 | Tests and review evidence must prove this exact rule is enforced: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. |
| BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. | CTMS-03-T01, CTMS-03-T02 | Tests and review evidence must prove this exact rule is enforced: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. |
| BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. | CTMS-03-T01, CTMS-03-T02 | Tests and review evidence must prove this exact rule is enforced: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. | CTMS-03-T01, CTMS-03-T02 | Tests and review evidence must prove this exact rule is enforced: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. |
| BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect. | CTMS-03-T01 | Tests and review evidence must prove this exact rule is enforced: Cases with insufficient permission or unmet business conditions must not create any side effect. |
| BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. | CTMS-03-T01 | Tests and review evidence must prove this exact rule is enforced: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. |
| BR-200: Every change must be written to the audit log. | CTMS-03-T01 | Tests and review evidence must prove this exact rule is enforced: Every change must be written to the audit log. |
| BR-201: Every function requiring authentication may only be performed when the user has a valid login session and the account is active. | CTMS-03-T01 | Tests and review evidence must prove this exact rule is enforced: Every function requiring authentication may only be performed when the user has a valid login session and the account is active. |
| BR-214: Every data relationship must reference an existing and valid record; child records must not be created for resources outside the correct business scope. | CTMS-03-T01 | Tests and review evidence must prove this exact rule is enforced: Every data relationship must reference an existing and valid record; child records must not be created for resources outside the correct business scope. |
| BR-215: Emails must be normalized before comparison and storage; phone numbers must be normalized to a consistent format, preferably E.164. | CTMS-03-T01 | Tests and review evidence must prove this exact rule is enforced: Emails must be normalized before comparison and storage; phone numbers must be normalized to a consistent format, preferably E.164. |
| BR-220: A valid time range must have a start time earlier than the end time, unless the business rule explicitly allows equality. | CTMS-03-T01 | Tests and review evidence must prove this exact rule is enforced: A valid time range must have a start time earlier than the end time, unless the business rule explicitly allows equality. |
| BR-206: The backend is the final authority for permissions, status, pricing, capacity, inventory, risk level, and transaction results; clients must not set these values by themselves. | CTMS-03-T01 | Tests and review evidence must prove this exact rule is enforced: The backend is the final authority for permissions, status, pricing, capacity, inventory, risk level, and transaction results; clients must not set these values by themselves. |
| BR-207: Every change involving multiple tables or records must run in a transaction; if one step fails, the whole business operation must roll back. | CTMS-03-T01 | Tests and review evidence must prove this exact rule is enforced: Every change involving multiple tables or records must run in a transaction; if one step fails, the whole business operation must roll back. |
| BR-209: Operations that may be retried, such as payment, refund, callback, and synchronization, must support idempotency so one request cannot be successfully processed more than once. | CTMS-03-T01 | Tests and review evidence must prove this exact rule is enforced: Operations that may be retried, such as payment, refund, callback, and synchronization, must support idempotency so one request cannot be successfully processed more than once. |
| BR-225: Automated actions must record actor_id = NULL or a system actor and include a clear execution reason. | CTMS-03-T01 | Tests and review evidence must prove this exact rule is enforced: Automated actions must record actor_id = NULL or a system actor and include a clear execution reason. |
| BR-226: Notifications may only be emitted after the business change succeeds; notification delivery failure must not undo the main transaction result. | CTMS-03-T01 | Tests and review evidence must prove this exact rule is enforced: Notifications may only be emitted after the business change succeeds; notification delivery failure must not undo the main transaction result. |
| BR-008: An account must not be activated with an incorrect, expired, or already-used OTP. | CTMS-03-T01, CTMS-03-T02 | Tests and review evidence must prove this exact rule is enforced: An account must not be activated with an incorrect, expired, or already-used OTP. |
| BR-009: Valid login credentials must return an access token and a refresh token. | CTMS-03-T01, CTMS-03-T02 | Tests and review evidence must prove this exact rule is enforced: Valid login credentials must return an access token and a refresh token. |
| BR-010: When login credentials are invalid, the system must return an appropriate message and must not create a login session. | CTMS-03-T01, CTMS-03-T02 | Tests and review evidence must prove this exact rule is enforced: When login credentials are invalid, the system must return an appropriate message and must not create a login session. |

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped BR missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements
- Implement the `Log In` workflow exactly within `EPIC 1. Authentication`.
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
- Story ID: `CTMS-03`
- Epic: `EPIC 1. Authentication`
- Sprint: `Sprint 1`
- Dependencies: `CTMS-02`
- Linked items: `Blocked by: CTMS-02

Blocks: CTMS-04, CTMS-06, CTMS-07, CTMS-08, CTMS-97, CTMS-109, CTMS-115`
- Spec Reference: `/file/spec/ctms-03-log-in.md`
- Business Rules workbook: `C:/Users/admin/Downloads/CTMS_Global_Business_Rules_Sprint_1-3.xlsx`
- Story-level BRs: `BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-200, BR-201, BR-214, BR-215, BR-220, BR-206, BR-207, BR-209, BR-225, BR-226, BR-008, BR-009, BR-010`
