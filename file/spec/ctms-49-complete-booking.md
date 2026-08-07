# CTMS-49 - Complete Booking

**Spec Reference**  
/file/spec/ctms-49-complete-booking.md

**Story Title**  
Complete Booking

**Status**  
To Do

**Story**  
As a user, I want to complete Booking so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [ ] Update booking_members.member_status = left and left_at.
- [ ] booking moves to completed only after the Trip has ended and members are processed.
- [ ] rented equipment is checked as returned or recorded as not returned.
- [ ] reviews are then enabled.

## Business Rules Checklist
- [ ] BR-143: Do not check in members with member_status = removed or bookings with status IN (cancelled, expired).
- [ ] BR-144: The system must update booking_members.member_status = left and left_at.
- [ ] BR-145: A booking may only move to status = completed after the Trip has ended and all members have been handled.
- [ ] BR-146: The system must verify rented equipment has been returned or recorded as not returned.
- [ ] BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.
- [ ] BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.
- [ ] BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.
- [ ] BR-206: The backend is the final authority for permissions, status, pricing, capacity, inventory, risk level, and transaction results; clients must not set these values by themselves.
- [ ] BR-207: Every change involving multiple tables or records must run in a transaction; if one step fails, the whole business operation must roll back.
- [ ] BR-209: Operations that may be retried, such as payment, refund, callback, and synchronization, must support idempotency so one request cannot be successfully processed more than once.
- [ ] BR-210: When concurrent requests change the same resource, the system must use transactions, locking, or version control to prevent overwrites and business limit violations.
- [ ] BR-211: Every stateful resource must follow the defined state transitions and must not use values outside the database enum.
- [ ] BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.
- [ ] BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data.
- [ ] BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.
- [ ] BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.
- [ ] BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.

## Dev Notes
- Jira status on 2026-08-04: `To Do`.
- Priority: `Should Have`; Story points: `3`; Commitment: `Stretch`.
- Epic: `EPIC 6. Booking Lifecycle`.
- Sprint: `Sprint 3`; planned window: `2026-08-23` to `2026-09-05`.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks
- CTMS-49-T01 [BE / Shared Logic] Implement `Complete Booking` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-210, BR-211, BR-206, BR-207, BR-209, BR-143, BR-144, BR-145, BR-146. Ref: /file/spec/ctms-49-complete-booking.md#backend-preparation-logic-and-tests
- CTMS-49-T02 [UI Web/Mobile/Consumer] Implement `Complete Booking` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-240, BR-241, BR-242, BR-143, BR-144, BR-145, BR-146. Ref: /file/spec/ctms-49-complete-booking.md#ui-and-tests

## Task to Acceptance Criteria Traceability
| Acceptance criterion / BR | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: Update booking_members.member_status = left and left_at | CTMS-49-T01, CTMS-49-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC2: booking moves to completed only after the Trip has ended and members are processed | CTMS-49-T01, CTMS-49-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC3: rented equipment is checked as returned or recorded as not returned | CTMS-49-T01, CTMS-49-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC4: reviews are then enabled | CTMS-49-T01, CTMS-49-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. | CTMS-49-T01, CTMS-49-T02 | Tests and review evidence must prove this exact rule is enforced: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. |
| BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data. | CTMS-49-T01, CTMS-49-T02 | Tests and review evidence must prove this exact rule is enforced: Users may only view or change data they own unless their role and business relationship allow access to another user's data. |
| BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. | CTMS-49-T01, CTMS-49-T02 | Tests and review evidence must prove this exact rule is enforced: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. |
| BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. | CTMS-49-T01, CTMS-49-T02 | Tests and review evidence must prove this exact rule is enforced: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. |
| BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. | CTMS-49-T01, CTMS-49-T02 | Tests and review evidence must prove this exact rule is enforced: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. | CTMS-49-T01, CTMS-49-T02 | Tests and review evidence must prove this exact rule is enforced: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. |
| BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect. | CTMS-49-T01 | Tests and review evidence must prove this exact rule is enforced: Cases with insufficient permission or unmet business conditions must not create any side effect. |
| BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. | CTMS-49-T01 | Tests and review evidence must prove this exact rule is enforced: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. |
| BR-210: When concurrent requests change the same resource, the system must use transactions, locking, or version control to prevent overwrites and business limit violations. | CTMS-49-T01 | Tests and review evidence must prove this exact rule is enforced: When concurrent requests change the same resource, the system must use transactions, locking, or version control to prevent overwrites and business limit violations. |
| BR-211: Every stateful resource must follow the defined state transitions and must not use values outside the database enum. | CTMS-49-T01 | Tests and review evidence must prove this exact rule is enforced: Every stateful resource must follow the defined state transitions and must not use values outside the database enum. |
| BR-206: The backend is the final authority for permissions, status, pricing, capacity, inventory, risk level, and transaction results; clients must not set these values by themselves. | CTMS-49-T01 | Tests and review evidence must prove this exact rule is enforced: The backend is the final authority for permissions, status, pricing, capacity, inventory, risk level, and transaction results; clients must not set these values by themselves. |
| BR-207: Every change involving multiple tables or records must run in a transaction; if one step fails, the whole business operation must roll back. | CTMS-49-T01 | Tests and review evidence must prove this exact rule is enforced: Every change involving multiple tables or records must run in a transaction; if one step fails, the whole business operation must roll back. |
| BR-209: Operations that may be retried, such as payment, refund, callback, and synchronization, must support idempotency so one request cannot be successfully processed more than once. | CTMS-49-T01 | Tests and review evidence must prove this exact rule is enforced: Operations that may be retried, such as payment, refund, callback, and synchronization, must support idempotency so one request cannot be successfully processed more than once. |
| BR-143: Do not check in members with member_status = removed or bookings with status IN (cancelled, expired). | CTMS-49-T01, CTMS-49-T02 | Tests and review evidence must prove this exact rule is enforced: Do not check in members with member_status = removed or bookings with status IN (cancelled, expired). |
| BR-144: The system must update booking_members.member_status = left and left_at. | CTMS-49-T01, CTMS-49-T02 | Tests and review evidence must prove this exact rule is enforced: The system must update booking_members.member_status = left and left_at. |
| BR-145: A booking may only move to status = completed after the Trip has ended and all members have been handled. | CTMS-49-T01, CTMS-49-T02 | Tests and review evidence must prove this exact rule is enforced: A booking may only move to status = completed after the Trip has ended and all members have been handled. |
| BR-146: The system must verify rented equipment has been returned or recorded as not returned. | CTMS-49-T01, CTMS-49-T02 | Tests and review evidence must prove this exact rule is enforced: The system must verify rented equipment has been returned or recorded as not returned. |

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped BR missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements
- Implement the `Complete Booking` workflow exactly within `EPIC 6. Booking Lifecycle`.
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
- Story ID: `CTMS-49`
- Epic: `EPIC 6. Booking Lifecycle`
- Sprint: `Sprint 3`
- Dependencies: `CTMS-48`
- Linked items: `Blocked by: CTMS-48

Blocks: CTMS-113, CTMS-114, CTMS-122`
- Spec Reference: `/file/spec/ctms-49-complete-booking.md`
- Business Rules workbook: `C:/Users/admin/Downloads/CTMS_Global_Business_Rules_Sprint_1-3.xlsx`
- Story-level BRs: `BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-210, BR-211, BR-206, BR-207, BR-209, BR-143, BR-144, BR-145, BR-146`
