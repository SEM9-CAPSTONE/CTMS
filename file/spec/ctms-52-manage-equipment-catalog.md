# CTMS-52 - Manage Equipment Catalog

**Spec Reference**  
/file/spec/ctms-52-manage-equipment-catalog.md

**Story Title**  
Manage Equipment Catalog

**Status**  
To Do

**Story**  
As a user, I want to manage Equipment Catalog so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [ ] Create and edit equipment catalog entries.
- [ ] do not use soft delete because equipment has no deleted_at column. When removed from service, move equipment.status to maintenance, lost, or retired depending on context.
- [ ] save quantity_total, rental_price_per_day, deposit_amount, storage_location, and maintenance_schedule.

## Business Rules Checklist
- [ ] BR-153: Rented equipment must not be stored in booking_items; use equipment_reservations instead.
- [ ] BR-154: The system must create and edit the equipment catalog.
- [ ] BR-155: Do not use soft delete because the equipment table has no deleted_at. When equipment is no longer used, change equipment.status to maintenance, lost, or retired depending on context.
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
- [ ] BR-234: Public lists may only contain resources in public-allowed states; draft, suspended, closed, or archived resources must not be shown unless another rule explicitly allows it.
- [ ] BR-235: Media must store URL and required metadata; client-provided URLs are valid only after the upload/verification flow is complete.
- [ ] BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.
- [ ] BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.
- [ ] BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.

## Dev Notes
- Jira status on 2026-08-04: `To Do`.
- Priority: `Must Have`; Story points: `5`; Commitment: `Stretch`.
- Epic: `EPIC 7. Equipment and Logistics`.
- Sprint: `Sprint 3`; planned window: `2026-08-23` to `2026-09-05`.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks
- CTMS-52-T01 [BE / Shared Logic] Implement `Manage Equipment Catalog` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-210, BR-211, BR-206, BR-207, BR-209, BR-234, BR-235, BR-153, BR-154, BR-155. Ref: /file/spec/ctms-52-manage-equipment-catalog.md#backend-preparation-logic-and-tests
- CTMS-52-T02 [UI Web/Mobile/Consumer] Implement `Manage Equipment Catalog` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-240, BR-241, BR-242, BR-153, BR-154, BR-155. Ref: /file/spec/ctms-52-manage-equipment-catalog.md#ui-and-tests

## Task to Acceptance Criteria Traceability
| Acceptance criterion / BR | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: Create and edit equipment catalog entries | CTMS-52-T01, CTMS-52-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC2: do not use soft delete because equipment has no deleted_at column. When removed from service, move equipment.status to maintenance, lost, or retired depending on context | CTMS-52-T01, CTMS-52-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC3: save quantity_total, rental_price_per_day, deposit_amount, storage_location, and maintenance_schedule | CTMS-52-T01, CTMS-52-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. | CTMS-52-T01, CTMS-52-T02 | Tests and review evidence must prove this exact rule is enforced: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. |
| BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data. | CTMS-52-T01, CTMS-52-T02 | Tests and review evidence must prove this exact rule is enforced: Users may only view or change data they own unless their role and business relationship allow access to another user's data. |
| BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. | CTMS-52-T01, CTMS-52-T02 | Tests and review evidence must prove this exact rule is enforced: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. |
| BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. | CTMS-52-T01, CTMS-52-T02 | Tests and review evidence must prove this exact rule is enforced: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. |
| BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. | CTMS-52-T01, CTMS-52-T02 | Tests and review evidence must prove this exact rule is enforced: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. | CTMS-52-T01, CTMS-52-T02 | Tests and review evidence must prove this exact rule is enforced: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. |
| BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect. | CTMS-52-T01 | Tests and review evidence must prove this exact rule is enforced: Cases with insufficient permission or unmet business conditions must not create any side effect. |
| BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. | CTMS-52-T01 | Tests and review evidence must prove this exact rule is enforced: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. |
| BR-210: When concurrent requests change the same resource, the system must use transactions, locking, or version control to prevent overwrites and business limit violations. | CTMS-52-T01 | Tests and review evidence must prove this exact rule is enforced: When concurrent requests change the same resource, the system must use transactions, locking, or version control to prevent overwrites and business limit violations. |
| BR-211: Every stateful resource must follow the defined state transitions and must not use values outside the database enum. | CTMS-52-T01 | Tests and review evidence must prove this exact rule is enforced: Every stateful resource must follow the defined state transitions and must not use values outside the database enum. |
| BR-206: The backend is the final authority for permissions, status, pricing, capacity, inventory, risk level, and transaction results; clients must not set these values by themselves. | CTMS-52-T01 | Tests and review evidence must prove this exact rule is enforced: The backend is the final authority for permissions, status, pricing, capacity, inventory, risk level, and transaction results; clients must not set these values by themselves. |
| BR-207: Every change involving multiple tables or records must run in a transaction; if one step fails, the whole business operation must roll back. | CTMS-52-T01 | Tests and review evidence must prove this exact rule is enforced: Every change involving multiple tables or records must run in a transaction; if one step fails, the whole business operation must roll back. |
| BR-209: Operations that may be retried, such as payment, refund, callback, and synchronization, must support idempotency so one request cannot be successfully processed more than once. | CTMS-52-T01 | Tests and review evidence must prove this exact rule is enforced: Operations that may be retried, such as payment, refund, callback, and synchronization, must support idempotency so one request cannot be successfully processed more than once. |
| BR-234: Public lists may only contain resources in public-allowed states; draft, suspended, closed, or archived resources must not be shown unless another rule explicitly allows it. | CTMS-52-T01 | Tests and review evidence must prove this exact rule is enforced: Public lists may only contain resources in public-allowed states; draft, suspended, closed, or archived resources must not be shown unless another rule explicitly allows it. |
| BR-235: Media must store URL and required metadata; client-provided URLs are valid only after the upload/verification flow is complete. | CTMS-52-T01 | Tests and review evidence must prove this exact rule is enforced: Media must store URL and required metadata; client-provided URLs are valid only after the upload/verification flow is complete. |
| BR-153: Rented equipment must not be stored in booking_items; use equipment_reservations instead. | CTMS-52-T01, CTMS-52-T02 | Tests and review evidence must prove this exact rule is enforced: Rented equipment must not be stored in booking_items; use equipment_reservations instead. |
| BR-154: The system must create and edit the equipment catalog. | CTMS-52-T01, CTMS-52-T02 | Tests and review evidence must prove this exact rule is enforced: The system must create and edit the equipment catalog. |
| BR-155: Do not use soft delete because the equipment table has no deleted_at. When equipment is no longer used, change equipment.status to maintenance, lost, or retired depending on context. | CTMS-52-T01, CTMS-52-T02 | Tests and review evidence must prove this exact rule is enforced: Do not use soft delete because the equipment table has no deleted_at. When equipment is no longer used, change equipment.status to maintenance, lost, or retired depending on context. |

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped BR missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements
- Implement the `Manage Equipment Catalog` workflow exactly within `EPIC 7. Equipment and Logistics`.
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
- Story ID: `CTMS-52`
- Epic: `EPIC 7. Equipment and Logistics`
- Sprint: `Sprint 3`
- Dependencies: `CTMS-06, CTMS-10`
- Linked items: `Blocked by: CTMS-06, CTMS-10

Blocks: CTMS-53`
- Spec Reference: `/file/spec/ctms-52-manage-equipment-catalog.md`
- Business Rules workbook: `C:/Users/admin/Downloads/CTMS_Global_Business_Rules_Sprint_1-3.xlsx`
- Story-level BRs: `BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-210, BR-211, BR-206, BR-207, BR-209, BR-234, BR-235, BR-153, BR-154, BR-155`
