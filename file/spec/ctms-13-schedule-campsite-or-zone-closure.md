# CTMS-13 - Schedule Campsite or Zone Closure

**Spec Reference**  
/file/spec/ctms-13-schedule-campsite-or-zone-closure.md

**Story Title**  
Schedule Campsite or Zone Closure

**Status**  
To Do

**Story**  
As a Host, I want to schedule Campsite or Zone Closure so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [ ] The Host can select Campsite or Zone scope, start date, end date, and reason.
- [ ] the start date cannot be after the end date.
- [ ] Trips and trip_camp_stays overlapping the closure cannot be published or used.

### Business Rules Checklist
- [ ] BR-202: Enforce this mapped business rule for Schedule Campsite or Zone Closure; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-204: Enforce this mapped business rule for Schedule Campsite or Zone Closure; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-205: Enforce this mapped business rule for Schedule Campsite or Zone Closure; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-230: Enforce this mapped business rule for Schedule Campsite or Zone Closure; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-231: Enforce this mapped business rule for Schedule Campsite or Zone Closure; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-242: Enforce this mapped business rule for Schedule Campsite or Zone Closure; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-243: Enforce this mapped business rule for Schedule Campsite or Zone Closure; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-244: Enforce this mapped business rule for Schedule Campsite or Zone Closure; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-210: Enforce this mapped business rule for Schedule Campsite or Zone Closure; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-211: Enforce this mapped business rule for Schedule Campsite or Zone Closure; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-218: Enforce this mapped business rule for Schedule Campsite or Zone Closure; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-219: Enforce this mapped business rule for Schedule Campsite or Zone Closure; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-033: Enforce this mapped business rule for Schedule Campsite or Zone Closure; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-034: Enforce this mapped business rule for Schedule Campsite or Zone Closure; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-035: Enforce this mapped business rule for Schedule Campsite or Zone Closure; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.

## Dev Notes
- Jira status on 2026-08-04: `To Do`.
- Priority: `Must Have`; Story points: `5`; Commitment: `Stretch`.
- Epic: `EPIC 2. Campsite and Zone Management`.
- Sprint: `Sprint 2`; planned window: `2026-08-09` to `2026-08-22`.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks
- CTMS-13-T01 [Backend Preparation, Logic, and Tests] Define preconditions, request/response contract, authorization, validation, domain service behavior, persistence mapping, transaction handling, and backend tests for `Schedule Campsite or Zone Closure`. Ref: /file/spec/ctms-13-schedule-campsite-or-zone-closure.md#backend-preparation-logic-and-tests
- CTMS-13-T02 [UI and Tests] Implement the user-facing flow, API integration, loading/error/empty/success states, validation messaging, and component/E2E coverage for `Schedule Campsite or Zone Closure`. Ref: /file/spec/ctms-13-schedule-campsite-or-zone-closure.md#ui-and-tests

## Task to Acceptance Criteria Traceability
| Acceptance criterion / BR | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: The Host can select Campsite or Zone scope, start date, end date, and reason | CTMS-13-T01, CTMS-13-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC2: the start date cannot be after the end date | CTMS-13-T01, CTMS-13-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC3: Trips and trip_camp_stays overlapping the closure cannot be published or used | CTMS-13-T01, CTMS-13-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| BR-202 | CTMS-13-T01, CTMS-13-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-204 | CTMS-13-T01, CTMS-13-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-205 | CTMS-13-T01, CTMS-13-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-230 | CTMS-13-T01, CTMS-13-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-231 | CTMS-13-T01, CTMS-13-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-242 | CTMS-13-T01, CTMS-13-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-243 | CTMS-13-T01, CTMS-13-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-244 | CTMS-13-T01, CTMS-13-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-210 | CTMS-13-T01, CTMS-13-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-211 | CTMS-13-T01, CTMS-13-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-218 | CTMS-13-T01, CTMS-13-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-219 | CTMS-13-T01, CTMS-13-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-033 | CTMS-13-T01, CTMS-13-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-034 | CTMS-13-T01, CTMS-13-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-035 | CTMS-13-T01, CTMS-13-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.

## Functional and Domain Requirements
- Implement the `Schedule Campsite or Zone Closure` workflow exactly within `EPIC 2. Campsite and Zone Management`.
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
- Story ID: `CTMS-13`
- Epic: `EPIC 2. Campsite and Zone Management`
- Sprint: `Sprint 2`
- Dependencies: `CTMS-10, CTMS-12`
- Linked items: `Blocked by: CTMS-10, CTMS-12
Blocks: CTMS-31`
- Spec Reference: `/file/spec/ctms-13-schedule-campsite-or-zone-closure.md`
- Business Rules: `BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-210, BR-211, BR-218, BR-219, BR-033, BR-034, BR-035`
