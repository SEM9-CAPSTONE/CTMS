# CTMS-29 - Create Booking for Trip

**Spec Reference**  
/file/spec/ctms-29-create-booking-for-trip.md

**Story Title**  
Create Booking for Trip

**Status**  
To Do

**Story**  
As a Camper, I want to create Booking for Trip so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [ ] The intended actor can complete the `Create Booking for Trip` workflow when all Product Backlog V3 preconditions are satisfied.
- [ ] The backend enforces the task-specific business rules listed below before creating, updating, returning, or synchronizing data.
- [ ] Invalid input, unauthorized access, invalid dependencies, and invalid state transitions are rejected with clear errors and no unintended side effects.
- [ ] The workflow respects its V3 dependencies: CTMS-23, CTMS-24, CTMS-18.

## Business Rules Checklist
- [ ] BR-069: Any create, confirm, cancel, or expire booking operation that changes seats_taken must run in a transaction; any error must roll back both booking and seat counters.
- [ ] BR-070: Before checking or updating seats_taken, the backend must serialize concurrent changes on the same trip_id using a row/advisory lock or equivalent mechanism.
- [ ] BR-071: seats_taken counts only people in bookings currently holding or confirming seats under the active policy, at minimum pending_payment and confirmed; cancelled, expired, and completed must not increase held seats. seats_taken prevents overbooking and is not the confirmed minimum participant count used for capacity_min decisions.
- [ ] BR-072: confirmed_participant_count is the sum of num_people for confirmed Bookings still eligible to participate at check time; pending_payment does not count toward capacity_min even though it holds seats in seats_taken.
- [ ] BR-073: A new Booking is valid only when num_people > 0 and current seats_taken + num_people <= trips.capacity_max; Trip capacity_min/max are the only person-count limits for booking.
- [ ] BR-074: If a booking transaction hits a conflict, deadlock, or serialization failure, the system must roll back and return/retry according to safe policy; seats_taken must never drift from booking status.
- [ ] BR-084: A Booking may be created only for a published Trip that is before booking_deadline, not started, on an eligible approved Route version, not Red for Weather Risk, and has enough capacity; the backend must recheck every condition inside the transaction immediately before holding seats.
- [ ] BR-085: A Booking must snapshot the applicable Trip schedule at creation time (starts_at/ends_at or equivalent snapshot fields), base_price, and cancellation_policy so later configuration changes do not rewrite Booking history. Free Trips create confirmed Bookings with payment_status not_required if seats are held successfully.
- [ ] BR-086: Paid Trips create Bookings with status pending_payment, payment_status unpaid, and hold_expires_at from configuration; the Booking becomes confirmed only after successful charge.
- [ ] BR-218: Campers register/buy seats through booking.trip_id; the system must not accept route_id as a booking object or purchasable product.

## Dev Notes
- Jira status on 2026-08-04: `To Do`.
- Priority: `Must Have`; Story points: `8`; Commitment: `Committed`.
- Epic: `EPIC 6. Booking and Payment`.
- Sprint: `Sprint 3`; planned window: `2026-08-23` to `2026-09-05`.
- Product Backlog V3 sheet `version 3` is the numbering and scope authority.
- Business Rules Checklist contains only task-relevant business rules after V3 review.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks
- CTMS-29-T01 [BE / Shared Logic] Implement `Create Booking for Trip` for this task scope and enforce mapped business rules: BR-069, BR-070, BR-071, BR-072, BR-073, BR-074, BR-084, BR-085, BR-086, BR-218. Ref: /file/spec/ctms-29-create-booking-for-trip.md#backend-preparation-logic-and-tests
- CTMS-29-T02 [UI Web/Mobile/Consumer] Implement `Create Booking for Trip` for this task scope and enforce mapped business rules: BR-069, BR-070, BR-071, BR-072, BR-073, BR-074, BR-084, BR-085, BR-086, BR-218. Ref: /file/spec/ctms-29-create-booking-for-trip.md#ui-and-tests

## Task to Acceptance Criteria Traceability
| Acceptance criterion / business rule | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: The intended actor can complete the `Create Booking for Trip` workflow when all Product Backlog V3 preconditions are satisfied. | CTMS-29-T01, CTMS-29-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC2: The backend enforces the task-specific business rules listed below before creating, updating, returning, or synchronizing data. | CTMS-29-T01, CTMS-29-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC3: Invalid input, unauthorized access, invalid dependencies, and invalid state transitions are rejected with clear errors and no unintended side effects. | CTMS-29-T01, CTMS-29-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC4: The workflow respects its V3 dependencies: CTMS-23, CTMS-24, CTMS-18. | CTMS-29-T01, CTMS-29-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| BR-069: Any create, confirm, cancel, or expire booking operation that changes seats_taken must run in a transaction; any error must roll back both booking and seat counters. | CTMS-29-T01, CTMS-29-T02 | Tests and review evidence must prove this rule is enforced for `Create Booking for Trip`. |
| BR-070: Before checking or updating seats_taken, the backend must serialize concurrent changes on the same trip_id using a row/advisory lock or equivalent mechanism. | CTMS-29-T01, CTMS-29-T02 | Tests and review evidence must prove this rule is enforced for `Create Booking for Trip`. |
| BR-071: seats_taken counts only people in bookings currently holding or confirming seats under the active policy, at minimum pending_payment and confirmed; cancelled, expired, and completed must not increase held seats. seats_taken prevents overbooking and is not the confirmed minimum participant count used for capacity_min decisions. | CTMS-29-T01, CTMS-29-T02 | Tests and review evidence must prove this rule is enforced for `Create Booking for Trip`. |
| BR-072: confirmed_participant_count is the sum of num_people for confirmed Bookings still eligible to participate at check time; pending_payment does not count toward capacity_min even though it holds seats in seats_taken. | CTMS-29-T01, CTMS-29-T02 | Tests and review evidence must prove this rule is enforced for `Create Booking for Trip`. |
| BR-073: A new Booking is valid only when num_people > 0 and current seats_taken + num_people <= trips.capacity_max; Trip capacity_min/max are the only person-count limits for booking. | CTMS-29-T01, CTMS-29-T02 | Tests and review evidence must prove this rule is enforced for `Create Booking for Trip`. |
| BR-074: If a booking transaction hits a conflict, deadlock, or serialization failure, the system must roll back and return/retry according to safe policy; seats_taken must never drift from booking status. | CTMS-29-T01, CTMS-29-T02 | Tests and review evidence must prove this rule is enforced for `Create Booking for Trip`. |
| BR-084: A Booking may be created only for a published Trip that is before booking_deadline, not started, on an eligible approved Route version, not Red for Weather Risk, and has enough capacity; the backend must recheck every condition inside the transaction immediately before holding seats. | CTMS-29-T01, CTMS-29-T02 | Tests and review evidence must prove this rule is enforced for `Create Booking for Trip`. |
| BR-085: A Booking must snapshot the applicable Trip schedule at creation time (starts_at/ends_at or equivalent snapshot fields), base_price, and cancellation_policy so later configuration changes do not rewrite Booking history. Free Trips create confirmed Bookings with payment_status not_required if seats are held successfully. | CTMS-29-T01, CTMS-29-T02 | Tests and review evidence must prove this rule is enforced for `Create Booking for Trip`. |
| BR-086: Paid Trips create Bookings with status pending_payment, payment_status unpaid, and hold_expires_at from configuration; the Booking becomes confirmed only after successful charge. | CTMS-29-T01, CTMS-29-T02 | Tests and review evidence must prove this rule is enforced for `Create Booking for Trip`. |
| BR-218: Campers register/buy seats through booking.trip_id; the system must not accept route_id as a booking object or purchasable product. | CTMS-29-T01, CTMS-29-T02 | Tests and review evidence must prove this rule is enforced for `Create Booking for Trip`. |

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, routes, bookings, or operational records.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped business rule missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements
- Implement the `Create Booking for Trip` workflow exactly within `EPIC 6. Booking and Payment`.
- Enforce role-based access before executing any domain action.
- Validate required fields, enum values, date ranges, ownership boundaries, and cross-entity references before writing data.
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
- Notify affected users when the workflow changes booking, trip, route, Porter, SOS, emergency, or administrative state.

## File Structure Notes
- Backend: place controllers, DTOs, services, repositories, guards, and tests in the module that owns the domain entity.
- Frontend: place screens, components, hooks, API clients, schemas, and tests in the feature folder that owns the workflow.
- Shared constants, enums, query keys, and validation schemas should be centralized only when reused by more than one feature.
- Keep migration, seed, and fixture changes close to the persistence model they support.

## Implementation Guidance for the Dev Agent
- Start by reading the existing module patterns before adding new files or abstractions.
- Keep the implementation narrow to this story and reuse existing CTMS helpers for auth, validation, transactions, i18n, API errors, and tests.
- Build backend behavior first when the UI depends on an API contract, then wire the frontend to the typed contract.
- Do not mark the story Done until mapped acceptance criteria, business rules, audit behavior, and regression tests are all covered.

## Testing Requirements
- Add unit tests for domain validation, permission checks, state transitions, and mapped business rule violations.
- Add API or integration tests for success, invalid input, unauthorized access, missing resource, conflict, and rollback cases.
- Add UI/component tests for rendering, validation messages, disabled states, loading states, error handling, and successful submission where UI exists.
- Add E2E coverage for the primary user journey and at least one critical failure path.
- Every business rule listed in the Business Rules Checklist must appear in at least one test or review evidence item.

## References
- Story ID: `CTMS-29`
- Epic: `EPIC 6. Booking and Payment`
- Sprint: `Sprint 3`
- Dependencies: `CTMS-23`, `CTMS-24`, `CTMS-18`
- Linked items: `Blocked by: CTMS-23, CTMS-24, CTMS-18
Blocks: CTMS-30, CTMS-31, CTMS-32, CTMS-33, CTMS-34, CTMS-40, CTMS-42, CTMS-87, CTMS-107, CTMS-116`
- Spec Reference: `/file/spec/ctms-29-create-booking-for-trip.md`
- Product Backlog source: `PRODUCT BACKLOG.xlsx`, sheet `version 3`
- Business Rules source: `CTMS- Business rules.xlsx`
- Story-level business rules: BR-069, BR-070, BR-071, BR-072, BR-073, BR-074, BR-084, BR-085, BR-086, BR-218
