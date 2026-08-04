# CTMS-55 - Record Damaged, Lost, or Returned Equipment

**Spec Reference**  
/file/spec/ctms-55-record-damaged-lost-or-returned-equipment.md

**Story Title**  
Record Damaged, Lost, or Returned Equipment

**Status**  
To Do

**Story**  
As a user, I want to record Damaged, Lost, or Returned Equipment so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [ ] On return, update equipment_reservations.status = returned and specific good-condition items to status = available.
- [ ] damaged items move equipment_items.status = maintenance and create equipment_damage_logs.
- [ ] lost items move to status = lost.
- [ ] overdue unreturned reservations move reservation.status = not_returned.

### Business Rules Checklist
- [ ] BR-202: Enforce this mapped business rule for Record Damaged, Lost, or Returned Equipment; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-204: Enforce this mapped business rule for Record Damaged, Lost, or Returned Equipment; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-205: Enforce this mapped business rule for Record Damaged, Lost, or Returned Equipment; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-230: Enforce this mapped business rule for Record Damaged, Lost, or Returned Equipment; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-231: Enforce this mapped business rule for Record Damaged, Lost, or Returned Equipment; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-242: Enforce this mapped business rule for Record Damaged, Lost, or Returned Equipment; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-243: Enforce this mapped business rule for Record Damaged, Lost, or Returned Equipment; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-244: Enforce this mapped business rule for Record Damaged, Lost, or Returned Equipment; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-210: Enforce this mapped business rule for Record Damaged, Lost, or Returned Equipment; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-211: Enforce this mapped business rule for Record Damaged, Lost, or Returned Equipment; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-206: Enforce this mapped business rule for Record Damaged, Lost, or Returned Equipment; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-207: Enforce this mapped business rule for Record Damaged, Lost, or Returned Equipment; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-209: Enforce this mapped business rule for Record Damaged, Lost, or Returned Equipment; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-162: Enforce this mapped business rule for Record Damaged, Lost, or Returned Equipment; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-163: Enforce this mapped business rule for Record Damaged, Lost, or Returned Equipment; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-164: Enforce this mapped business rule for Record Damaged, Lost, or Returned Equipment; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-165: Enforce this mapped business rule for Record Damaged, Lost, or Returned Equipment; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.

## Dev Notes
- Jira status on 2026-08-04: `To Do`.
- Priority: `Should Have`; Story points: `3`; Commitment: `Stretch`.
- Epic: `EPIC 7. Equipment and Logistics`.
- Sprint: `Sprint 3`; planned window: `2026-08-23` to `2026-09-05`.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks
- CTMS-55-T01 [Backend Preparation, Logic, and Tests] Define preconditions, request/response contract, authorization, validation, domain service behavior, persistence mapping, transaction handling, and backend tests for `Record Damaged, Lost, or Returned Equipment`. Ref: /file/spec/ctms-55-record-damaged-lost-or-returned-equipment.md#backend-preparation-logic-and-tests
- CTMS-55-T02 [UI and Tests] Implement the user-facing flow, API integration, loading/error/empty/success states, validation messaging, and component/E2E coverage for `Record Damaged, Lost, or Returned Equipment`. Ref: /file/spec/ctms-55-record-damaged-lost-or-returned-equipment.md#ui-and-tests

## Task to Acceptance Criteria Traceability
| Acceptance criterion / BR | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: On return, update equipment_reservations.status = returned and specific good-condition items to status = available | CTMS-55-T01, CTMS-55-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC2: damaged items move equipment_items.status = maintenance and create equipment_damage_logs | CTMS-55-T01, CTMS-55-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC3: lost items move to status = lost | CTMS-55-T01, CTMS-55-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC4: overdue unreturned reservations move reservation.status = not_returned | CTMS-55-T01, CTMS-55-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| BR-202 | CTMS-55-T01, CTMS-55-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-204 | CTMS-55-T01, CTMS-55-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-205 | CTMS-55-T01, CTMS-55-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-230 | CTMS-55-T01, CTMS-55-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-231 | CTMS-55-T01, CTMS-55-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-242 | CTMS-55-T01, CTMS-55-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-243 | CTMS-55-T01, CTMS-55-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-244 | CTMS-55-T01, CTMS-55-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-210 | CTMS-55-T01, CTMS-55-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-211 | CTMS-55-T01, CTMS-55-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-206 | CTMS-55-T01, CTMS-55-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-207 | CTMS-55-T01, CTMS-55-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-209 | CTMS-55-T01, CTMS-55-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-162 | CTMS-55-T01, CTMS-55-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-163 | CTMS-55-T01, CTMS-55-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-164 | CTMS-55-T01, CTMS-55-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-165 | CTMS-55-T01, CTMS-55-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.

## Functional and Domain Requirements
- Implement the `Record Damaged, Lost, or Returned Equipment` workflow exactly within `EPIC 7. Equipment and Logistics`.
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

## References
- Story ID: `CTMS-55`
- Epic: `EPIC 7. Equipment and Logistics`
- Sprint: `Sprint 3`
- Dependencies: `CTMS-54`
- Linked items: `Blocked by: CTMS-54
Blocks: None`
- Spec Reference: `/file/spec/ctms-55-record-damaged-lost-or-returned-equipment.md`
- Business Rules: `BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-210, BR-211, BR-206, BR-207, BR-209, BR-162, BR-163, BR-164, BR-165`
