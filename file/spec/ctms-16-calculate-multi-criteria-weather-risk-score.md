# CTMS-16 - Calculate Multi-Criteria Weather Risk Score

**Spec Reference**  
/file/spec/ctms-16-calculate-multi-criteria-weather-risk-score.md

**Story Title**  
Calculate Multi-Criteria Weather Risk Score

**Status**  
To Do

**Story**  
As the System, I want to calculate Multi-Criteria Weather Risk Score so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [ ] The intended actor can complete the `Calculate Multi-Criteria Weather Risk Score` workflow when all Product Backlog V3 preconditions are satisfied.
- [ ] The backend enforces the task-specific business rules listed below before creating, updating, returning, or synchronizing data.
- [ ] Invalid input, unauthorized access, invalid dependencies, and invalid state transitions are rejected with clear errors and no unintended side effects.
- [ ] The workflow respects its V3 dependencies: CTMS-15.

## Business Rules Checklist
- [ ] BR-041: Weather Risk score must be calculated deterministically from the weather snapshot and the active weather_rules; the backend is the final source of the result.
- [ ] BR-042: Weather Risk level may only be Green, Yellow, or Red according to the thresholds of the rule used; boundaries must be clearly defined and testable.
- [ ] BR-043: Each weather_risk_assessment must store snapshot_id, rule_id, score, level, reasons, and created_at so the same input and rule version can reproduce the result.

## Dev Notes
- Jira status on 2026-08-04: `To Do`.
- Priority: `Must Have`; Story points: `8`; Commitment: `Committed`.
- Epic: `EPIC 4. Weather Risk Assessment`.
- Sprint: `Sprint 2`; planned window: `2026-08-09` to `2026-08-22`.
- Product Backlog V3 sheet `version 3` is the numbering and scope authority.
- Business Rules Checklist contains only task-relevant business rules after V3 review.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks
- CTMS-16-T01 [BE / Shared Logic] Implement `Calculate Multi-Criteria Weather Risk Score` for this task scope and enforce mapped business rules: BR-041, BR-042, BR-043. Ref: /file/spec/ctms-16-calculate-multi-criteria-weather-risk-score.md#backend-preparation-logic-and-tests
- CTMS-16-T02 [UI Web/Mobile/Consumer] Implement `Calculate Multi-Criteria Weather Risk Score` for this task scope and enforce mapped business rules: BR-041, BR-042, BR-043. Ref: /file/spec/ctms-16-calculate-multi-criteria-weather-risk-score.md#ui-and-tests

## Task to Acceptance Criteria Traceability
| Acceptance criterion / business rule | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: The intended actor can complete the `Calculate Multi-Criteria Weather Risk Score` workflow when all Product Backlog V3 preconditions are satisfied. | CTMS-16-T01, CTMS-16-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC2: The backend enforces the task-specific business rules listed below before creating, updating, returning, or synchronizing data. | CTMS-16-T01, CTMS-16-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC3: Invalid input, unauthorized access, invalid dependencies, and invalid state transitions are rejected with clear errors and no unintended side effects. | CTMS-16-T01, CTMS-16-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC4: The workflow respects its V3 dependencies: CTMS-15. | CTMS-16-T01, CTMS-16-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| BR-041: Weather Risk score must be calculated deterministically from the weather snapshot and the active weather_rules; the backend is the final source of the result. | CTMS-16-T01, CTMS-16-T02 | Tests and review evidence must prove this rule is enforced for `Calculate Multi-Criteria Weather Risk Score`. |
| BR-042: Weather Risk level may only be Green, Yellow, or Red according to the thresholds of the rule used; boundaries must be clearly defined and testable. | CTMS-16-T01, CTMS-16-T02 | Tests and review evidence must prove this rule is enforced for `Calculate Multi-Criteria Weather Risk Score`. |
| BR-043: Each weather_risk_assessment must store snapshot_id, rule_id, score, level, reasons, and created_at so the same input and rule version can reproduce the result. | CTMS-16-T01, CTMS-16-T02 | Tests and review evidence must prove this rule is enforced for `Calculate Multi-Criteria Weather Risk Score`. |

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, routes, bookings, or operational records.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped business rule missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements
- Implement the `Calculate Multi-Criteria Weather Risk Score` workflow exactly within `EPIC 4. Weather Risk Assessment`.
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
- Story ID: `CTMS-16`
- Epic: `EPIC 4. Weather Risk Assessment`
- Sprint: `Sprint 2`
- Dependencies: `CTMS-15`
- Linked items: `Blocked by: CTMS-15
Blocks: CTMS-17, CTMS-18, CTMS-19, CTMS-25, CTMS-26, CTMS-42, CTMS-52, CTMS-93, CTMS-105, CTMS-113`
- Spec Reference: `/file/spec/ctms-16-calculate-multi-criteria-weather-risk-score.md`
- Product Backlog source: `PRODUCT BACKLOG.xlsx`, sheet `version 3`
- Business Rules source: `CTMS- Business rules.xlsx`
- Story-level business rules: BR-041, BR-042, BR-043
