# CTMS-35 - Prevent Trip and Zone Overcapacity

**Spec Reference**  
/file/spec/ctms-35-prevent-trip-and-zone-overcapacity.md

**Story Title**  
Prevent Trip and Zone Overcapacity

**Status**  
To Do

**Story**  
As a Host, I want to prevent Trip and Zone Overcapacity so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [ ] Booking creation or confirmation runs in a transaction.
- [ ] lock by trip_id when updating seats_taken.
- [ ] lock by zone_id when checking trip_camp_stays.
- [ ] total people cannot exceed capacity_max or max_people and total tents cannot exceed max_tents.
- [ ] conflicting transactions must roll back.

## Business Rules Checklist
- [ ] BR-094: If a Trip is cancelled, set status = cancelled. Do not use rejected status.
- [ ] BR-095: The system must create or confirm a booking inside a transaction.
- [ ] BR-096: The system must lock by trip_id when updating seats_taken.
- [ ] BR-097: The system must lock by zone_id when checking trip_camp_stays.
- [ ] BR-098: Total people must not exceed capacity_max or max_people, and total tents must not exceed max_tents.
- [ ] BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.
- [ ] BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.
- [ ] BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.
- [ ] BR-206: The backend is the final authority for permissions, status, pricing, capacity, inventory, risk level, and transaction results; clients must not set these values by themselves.
- [ ] BR-207: Every change involving multiple tables or records must run in a transaction; if one step fails, the whole business operation must roll back.
- [ ] BR-209: Operations that may be retried, such as payment, refund, callback, and synchronization, must support idempotency so one request cannot be successfully processed more than once.
- [ ] BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.
- [ ] BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data.
- [ ] BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.
- [ ] BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.
- [ ] BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.

## Dev Notes
- Jira status on 2026-08-04: `To Do`.
- Priority: `Must Have`; Story points: `8`; Commitment: `Committed`.
- Epic: `EPIC 5. Trip Management`.
- Sprint: `Sprint 3`; planned window: `2026-08-23` to `2026-09-05`.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks
- CTMS-35-T01 [BE / Shared Logic] Implement `Prevent Trip and Zone Overcapacity` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-206, BR-207, BR-209, BR-094, BR-095, BR-096, BR-097, BR-098. Ref: /file/spec/ctms-35-prevent-trip-and-zone-overcapacity.md#backend-preparation-logic-and-tests
- CTMS-35-T02 [UI Web/Mobile/Consumer] Implement `Prevent Trip and Zone Overcapacity` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-240, BR-241, BR-242, BR-094, BR-095, BR-096, BR-097, BR-098. Ref: /file/spec/ctms-35-prevent-trip-and-zone-overcapacity.md#ui-and-tests

## Task to Acceptance Criteria Traceability
| Acceptance criterion / BR | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: Booking creation or confirmation runs in a transaction | CTMS-35-T01, CTMS-35-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC2: lock by trip_id when updating seats_taken | CTMS-35-T01, CTMS-35-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC3: lock by zone_id when checking trip_camp_stays | CTMS-35-T01, CTMS-35-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC4: total people cannot exceed capacity_max or max_people and total tents cannot exceed max_tents | CTMS-35-T01, CTMS-35-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC5: conflicting transactions must roll back | CTMS-35-T01, CTMS-35-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. | CTMS-35-T01, CTMS-35-T02 | Tests and review evidence must prove this exact rule is enforced: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. |
| BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data. | CTMS-35-T01, CTMS-35-T02 | Tests and review evidence must prove this exact rule is enforced: Users may only view or change data they own unless their role and business relationship allow access to another user's data. |
| BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. | CTMS-35-T01, CTMS-35-T02 | Tests and review evidence must prove this exact rule is enforced: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. |
| BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. | CTMS-35-T01, CTMS-35-T02 | Tests and review evidence must prove this exact rule is enforced: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. |
| BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. | CTMS-35-T01, CTMS-35-T02 | Tests and review evidence must prove this exact rule is enforced: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. | CTMS-35-T01, CTMS-35-T02 | Tests and review evidence must prove this exact rule is enforced: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. |
| BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect. | CTMS-35-T01 | Tests and review evidence must prove this exact rule is enforced: Cases with insufficient permission or unmet business conditions must not create any side effect. |
| BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. | CTMS-35-T01 | Tests and review evidence must prove this exact rule is enforced: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. |
| BR-206: The backend is the final authority for permissions, status, pricing, capacity, inventory, risk level, and transaction results; clients must not set these values by themselves. | CTMS-35-T01 | Tests and review evidence must prove this exact rule is enforced: The backend is the final authority for permissions, status, pricing, capacity, inventory, risk level, and transaction results; clients must not set these values by themselves. |
| BR-207: Every change involving multiple tables or records must run in a transaction; if one step fails, the whole business operation must roll back. | CTMS-35-T01 | Tests and review evidence must prove this exact rule is enforced: Every change involving multiple tables or records must run in a transaction; if one step fails, the whole business operation must roll back. |
| BR-209: Operations that may be retried, such as payment, refund, callback, and synchronization, must support idempotency so one request cannot be successfully processed more than once. | CTMS-35-T01 | Tests and review evidence must prove this exact rule is enforced: Operations that may be retried, such as payment, refund, callback, and synchronization, must support idempotency so one request cannot be successfully processed more than once. |
| BR-094: If a Trip is cancelled, set status = cancelled. Do not use rejected status. | CTMS-35-T01, CTMS-35-T02 | Tests and review evidence must prove this exact rule is enforced: If a Trip is cancelled, set status = cancelled. Do not use rejected status. |
| BR-095: The system must create or confirm a booking inside a transaction. | CTMS-35-T01, CTMS-35-T02 | Tests and review evidence must prove this exact rule is enforced: The system must create or confirm a booking inside a transaction. |
| BR-096: The system must lock by trip_id when updating seats_taken. | CTMS-35-T01, CTMS-35-T02 | Tests and review evidence must prove this exact rule is enforced: The system must lock by trip_id when updating seats_taken. |
| BR-097: The system must lock by zone_id when checking trip_camp_stays. | CTMS-35-T01, CTMS-35-T02 | Tests and review evidence must prove this exact rule is enforced: The system must lock by zone_id when checking trip_camp_stays. |
| BR-098: Total people must not exceed capacity_max or max_people, and total tents must not exceed max_tents. | CTMS-35-T01, CTMS-35-T02 | Tests and review evidence must prove this exact rule is enforced: Total people must not exceed capacity_max or max_people, and total tents must not exceed max_tents. |

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped BR missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements
- Implement the `Prevent Trip and Zone Overcapacity` workflow exactly within `EPIC 5. Trip Management`.
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
- Story ID: `CTMS-35`
- Epic: `EPIC 5. Trip Management`
- Sprint: `Sprint 3`
- Dependencies: `CTMS-32, CTMS-33`
- Linked items: `Blocked by: CTMS-32, CTMS-33

Blocks: CTMS-40, CTMS-102, CTMS-116`
- Spec Reference: `/file/spec/ctms-35-prevent-trip-and-zone-overcapacity.md`
- Business Rules workbook: `C:/Users/admin/Downloads/CTMS_Global_Business_Rules_Sprint_1-3.xlsx`
- Story-level BRs: `BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-206, BR-207, BR-209, BR-094, BR-095, BR-096, BR-097, BR-098`
