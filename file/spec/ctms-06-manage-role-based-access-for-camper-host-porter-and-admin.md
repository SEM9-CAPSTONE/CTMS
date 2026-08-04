# CTMS-06 - Manage Role-Based Access for Camper, Host, Porter, and Admin

**Spec Reference**  
/file/spec/ctms-06-manage-role-based-access-for-camper-host-porter-and-admin.md

**Story Title**  
Manage Role-Based Access for Camper, Host, Porter, and Admin

**Status**  
To Do

**Story**  
As a Porter, I want to manage Role-Based Access for Camper, Host, Porter, and Admin so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [ ] APIs enforce authorization on the backend.
- [ ] users cannot access features outside their role.
- [ ] unauthorized actions return 403.

### Business Rules Checklist
- [ ] BR-202: Enforce this mapped business rule for Manage Role-Based Access for Camper, Host, Porter, and Admin; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-204: Enforce this mapped business rule for Manage Role-Based Access for Camper, Host, Porter, and Admin; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-205: Enforce this mapped business rule for Manage Role-Based Access for Camper, Host, Porter, and Admin; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-230: Enforce this mapped business rule for Manage Role-Based Access for Camper, Host, Porter, and Admin; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-231: Enforce this mapped business rule for Manage Role-Based Access for Camper, Host, Porter, and Admin; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-242: Enforce this mapped business rule for Manage Role-Based Access for Camper, Host, Porter, and Admin; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-243: Enforce this mapped business rule for Manage Role-Based Access for Camper, Host, Porter, and Admin; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-244: Enforce this mapped business rule for Manage Role-Based Access for Camper, Host, Porter, and Admin; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-228: Enforce this mapped business rule for Manage Role-Based Access for Camper, Host, Porter, and Admin; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-229: Enforce this mapped business rule for Manage Role-Based Access for Camper, Host, Porter, and Admin; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-016: Enforce this mapped business rule for Manage Role-Based Access for Camper, Host, Porter, and Admin; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-017: Enforce this mapped business rule for Manage Role-Based Access for Camper, Host, Porter, and Admin; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.
- [ ] BR-018: Enforce this mapped business rule for Manage Role-Based Access for Camper, Host, Porter, and Admin; validate the positive path, violation path, permission boundary, and persistence side effects before marking the story Done.

## Dev Notes
- Jira status on 2026-08-04: `To Do`.
- Priority: `Must Have`; Story points: `8`; Commitment: `Committed`.
- Epic: `EPIC 1. Authentication and User Management`.
- Sprint: `Sprint 1`; planned window: `2026-07-26` to `2026-08-08`.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks
- CTMS-06-T01 [Backend Preparation, Logic, and Tests] Define preconditions, request/response contract, authorization, validation, domain service behavior, persistence mapping, transaction handling, and backend tests for `Manage Role-Based Access for Camper, Host, Porter, and Admin`. Ref: /file/spec/ctms-06-manage-role-based-access-for-camper-host-porter-and-admin.md#backend-preparation-logic-and-tests
- CTMS-06-T02 [UI and Tests] Implement the user-facing flow, API integration, loading/error/empty/success states, validation messaging, and component/E2E coverage for `Manage Role-Based Access for Camper, Host, Porter, and Admin`. Ref: /file/spec/ctms-06-manage-role-based-access-for-camper-host-porter-and-admin.md#ui-and-tests

## Task to Acceptance Criteria Traceability
| Acceptance criterion / BR | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: APIs enforce authorization on the backend | CTMS-06-T01, CTMS-06-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC2: users cannot access features outside their role | CTMS-06-T01, CTMS-06-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC3: unauthorized actions return 403 | CTMS-06-T01, CTMS-06-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| BR-202 | CTMS-06-T01, CTMS-06-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-204 | CTMS-06-T01, CTMS-06-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-205 | CTMS-06-T01, CTMS-06-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-230 | CTMS-06-T01, CTMS-06-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-231 | CTMS-06-T01, CTMS-06-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-242 | CTMS-06-T01, CTMS-06-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-243 | CTMS-06-T01, CTMS-06-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-244 | CTMS-06-T01, CTMS-06-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-228 | CTMS-06-T01, CTMS-06-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-229 | CTMS-06-T01, CTMS-06-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-016 | CTMS-06-T01, CTMS-06-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-017 | CTMS-06-T01, CTMS-06-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |
| BR-018 | CTMS-06-T01, CTMS-06-T02 | Positive-path and violation-path tests proving the mapped rule is enforced |

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.

## Functional and Domain Requirements
- Implement the `Manage Role-Based Access for Camper, Host, Porter, and Admin` workflow exactly within `EPIC 1. Authentication and User Management`.
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
- Story ID: `CTMS-06`
- Epic: `EPIC 1. Authentication and User Management`
- Sprint: `Sprint 1`
- Dependencies: `CTMS-03`
- Linked items: `Blocked by: CTMS-03
Blocks: CTMS-10, CTMS-16, CTMS-22, CTMS-30, CTMS-34, CTMS-52, CTMS-57, CTMS-59, CTMS-65, CTMS-91, CTMS-123, CTMS-124, CTMS-126`
- Spec Reference: `/file/spec/ctms-06-manage-role-based-access-for-camper-host-porter-and-admin.md`
- Business Rules: `BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-228, BR-229, BR-016, BR-017, BR-018`
