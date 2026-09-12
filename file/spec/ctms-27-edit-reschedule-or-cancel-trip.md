# CTMS-27 - Edit, Reschedule, or Cancel Trip

**Spec Reference**  
/file/spec/ctms-27-edit-reschedule-or-cancel-trip.md

**Story Title**  
Edit, Reschedule, or Cancel Trip

**Status**  
To Do

**Story**  
As a Host, I want to edit, Reschedule, or Cancel Trip so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [ ] The intended actor can complete the `Edit, Reschedule, or Cancel Trip` workflow when all Product Backlog V3 preconditions are satisfied.
- [ ] The backend enforces the task-specific business rules listed below before creating, updating, returning, or synchronizing data.
- [ ] Invalid input, unauthorized access, invalid dependencies, and invalid state transitions are rejected with clear errors and no unintended side effects.
- [ ] The workflow respects its V3 dependencies: CTMS-21, CTMS-22.

## Business Rules Checklist
- [ ] BR-065: A Trip may move to cancelled only from states that allow cancellation. The owning Host may cancel before completed; if the Trip is published and has Booking, Porter, or Equipment commitments, cancellation must revalidate state, cancel/release commitments by policy, create refunds when needed, audit the reason, and notify after commit. Completed Trips cannot move back to cancelled, and rejected status is not used.
- [ ] BR-078: Only the owning Host may edit a Trip; ongoing, completed, and cancelled Trips must not have planning fields edited except through a dedicated flow explicitly allowed by spec.
- [ ] BR-079: After a Trip is published, material changes to route/version, starts_at, ends_at, meeting_point/meeting_at, province/city snapshot, capacity_min/max, price, or trip_waypoints must go through the Trip Edit/Reschedule flow and revalidate Booking, Porter Assignment, Equipment Reservation, and Offline Package. If no Booking is confirmed, the material change returns the Trip to draft for resubmission/reapproval. If confirmed Bookings exist, existing commitments must not be silently changed; reschedule must save a reason, preserve historical snapshots, revalidate/reapprove the new schedule before it is bookable, and notify affected users. Bookings cancelled by reschedule/cancel follow Booking/Payment refund policy.
- [ ] BR-080: Trip Edit, Reschedule, or Cancel operations that affect commitments must be audited; notifications for affected Campers, Porters, or Hosts are queued/sent only after the Trip and related state transaction commits.

## Dev Notes
- Jira status on 2026-08-04: `To Do`.
- Priority: `Must Have`; Story points: `8`; Commitment: `Stretch`.
- Epic: `EPIC 5. Trip Management`.
- Sprint: `Sprint 3`; planned window: `2026-08-23` to `2026-09-05`.
- Product Backlog V3 sheet `version 3` is the numbering and scope authority.
- Business Rules Checklist contains only task-relevant business rules after V3 review.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks
- CTMS-27-T01 [BE / Shared Logic] Implement `Edit, Reschedule, or Cancel Trip` for this task scope and enforce mapped business rules: BR-065, BR-078, BR-079, BR-080. Ref: /file/spec/ctms-27-edit-reschedule-or-cancel-trip.md#backend-preparation-logic-and-tests
- CTMS-27-T02 [UI Web/Mobile/Consumer] Implement `Edit, Reschedule, or Cancel Trip` for this task scope and enforce mapped business rules: BR-065, BR-078, BR-079, BR-080. Ref: /file/spec/ctms-27-edit-reschedule-or-cancel-trip.md#ui-and-tests

## Task to Acceptance Criteria Traceability
| Acceptance criterion / business rule | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: The intended actor can complete the `Edit, Reschedule, or Cancel Trip` workflow when all Product Backlog V3 preconditions are satisfied. | CTMS-27-T01, CTMS-27-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC2: The backend enforces the task-specific business rules listed below before creating, updating, returning, or synchronizing data. | CTMS-27-T01, CTMS-27-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC3: Invalid input, unauthorized access, invalid dependencies, and invalid state transitions are rejected with clear errors and no unintended side effects. | CTMS-27-T01, CTMS-27-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC4: The workflow respects its V3 dependencies: CTMS-21, CTMS-22. | CTMS-27-T01, CTMS-27-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| BR-065: A Trip may move to cancelled only from states that allow cancellation. The owning Host may cancel before completed; if the Trip is published and has Booking, Porter, or Equipment commitments, cancellation must revalidate state, cancel/release commitments by policy, create refunds when needed, audit the reason, and notify after commit. Completed Trips cannot move back to cancelled, and rejected status is not used. | CTMS-27-T01, CTMS-27-T02 | Tests and review evidence must prove this rule is enforced for `Edit, Reschedule, or Cancel Trip`. |
| BR-078: Only the owning Host may edit a Trip; ongoing, completed, and cancelled Trips must not have planning fields edited except through a dedicated flow explicitly allowed by spec. | CTMS-27-T01, CTMS-27-T02 | Tests and review evidence must prove this rule is enforced for `Edit, Reschedule, or Cancel Trip`. |
| BR-079: After a Trip is published, material changes to route/version, starts_at, ends_at, meeting_point/meeting_at, province/city snapshot, capacity_min/max, price, or trip_waypoints must go through the Trip Edit/Reschedule flow and revalidate Booking, Porter Assignment, Equipment Reservation, and Offline Package. If no Booking is confirmed, the material change returns the Trip to draft for resubmission/reapproval. If confirmed Bookings exist, existing commitments must not be silently changed; reschedule must save a reason, preserve historical snapshots, revalidate/reapprove the new schedule before it is bookable, and notify affected users. Bookings cancelled by reschedule/cancel follow Booking/Payment refund policy. | CTMS-27-T01, CTMS-27-T02 | Tests and review evidence must prove this rule is enforced for `Edit, Reschedule, or Cancel Trip`. |
| BR-080: Trip Edit, Reschedule, or Cancel operations that affect commitments must be audited; notifications for affected Campers, Porters, or Hosts are queued/sent only after the Trip and related state transaction commits. | CTMS-27-T01, CTMS-27-T02 | Tests and review evidence must prove this rule is enforced for `Edit, Reschedule, or Cancel Trip`. |

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, routes, bookings, or operational records.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped business rule missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements
- Implement the `Edit, Reschedule, or Cancel Trip` workflow exactly within `EPIC 5. Trip Management`.
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
- Story ID: `CTMS-27`
- Epic: `EPIC 5. Trip Management`
- Sprint: `Sprint 3`
- Dependencies: `CTMS-21`, `CTMS-22`
- Linked items: `Blocked by: CTMS-21, CTMS-22
Blocks: None`
- Spec Reference: `/file/spec/ctms-27-edit-reschedule-or-cancel-trip.md`
- Product Backlog source: `PRODUCT BACKLOG.xlsx`, sheet `version 3`
- Business Rules source: `CTMS- Business rules.xlsx`
- Story-level business rules: BR-065, BR-078, BR-079, BR-080
