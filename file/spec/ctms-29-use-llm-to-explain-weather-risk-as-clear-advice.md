# CTMS-29 - Use LLM to Explain Weather Risk as Clear Advice

**Spec Reference**  
/file/spec/ctms-29-use-llm-to-explain-weather-risk-as-clear-advice.md

**Story Title**  
Use LLM to Explain Weather Risk as Clear Advice

**Status**  
To Do

**Story**  
As a user, I want to use LLM to Explain Weather Risk as Clear Advice so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [ ] The LLM only explains the input data.
- [ ] it must not modify the risk score.
- [ ] the response includes concrete actions.

## Business Rules Checklist
- [ ] BR-074: Do not create Trip Member records because the system uses bookings and booking_members.
- [ ] BR-075: The LLM may only explain the provided input data.
- [ ] BR-076: The LLM must not change the risk score by itself.
- [ ] BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.
- [ ] BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.
- [ ] BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.
- [ ] BR-228: Users may disable ordinary notifications, but mandatory safety or emergency alerts cannot be disabled while participating in the related Trip.
- [ ] BR-229: When an external service times out or returns incomplete data, the system must record the error, must not assume success, and must not create unverifiable data.
- [ ] BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.
- [ ] BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data.
- [ ] BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.
- [ ] BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.
- [ ] BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.

## Dev Notes
- Jira status on 2026-08-04: `To Do`.
- Priority: `Must Have`; Story points: `8`; Commitment: `Committed`.
- Epic: `EPIC 4. Weather Risk`.
- Sprint: `Sprint 2`; planned window: `2026-08-09` to `2026-08-22`.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks
- CTMS-29-T01 [BE / Shared Logic] Implement `Use LLM to Explain Weather Risk as Clear Advice` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-228, BR-229, BR-074, BR-075, BR-076, BR-206, BR-207. Ref: /file/spec/ctms-29-use-llm-to-explain-weather-risk-as-clear-advice.md#backend-preparation-logic-and-tests
- CTMS-29-T02 [UI Web/Mobile/Consumer] Implement `Use LLM to Explain Weather Risk as Clear Advice` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-240, BR-241, BR-242, BR-074, BR-075, BR-076. Ref: /file/spec/ctms-29-use-llm-to-explain-weather-risk-as-clear-advice.md#ui-and-tests

## Task to Acceptance Criteria Traceability
| Acceptance criterion / BR | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: The LLM only explains the input data | CTMS-29-T01, CTMS-29-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC2: it must not modify the risk score | CTMS-29-T01, CTMS-29-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC3: the response includes concrete actions | CTMS-29-T01, CTMS-29-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. | CTMS-29-T01, CTMS-29-T02 | Tests and review evidence must prove this exact rule is enforced: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. |
| BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data. | CTMS-29-T01, CTMS-29-T02 | Tests and review evidence must prove this exact rule is enforced: Users may only view or change data they own unless their role and business relationship allow access to another user's data. |
| BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. | CTMS-29-T01, CTMS-29-T02 | Tests and review evidence must prove this exact rule is enforced: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. |
| BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. | CTMS-29-T01, CTMS-29-T02 | Tests and review evidence must prove this exact rule is enforced: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. |
| BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. | CTMS-29-T01, CTMS-29-T02 | Tests and review evidence must prove this exact rule is enforced: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. | CTMS-29-T01, CTMS-29-T02 | Tests and review evidence must prove this exact rule is enforced: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. |
| BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect. | CTMS-29-T01 | Tests and review evidence must prove this exact rule is enforced: Cases with insufficient permission or unmet business conditions must not create any side effect. |
| BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. | CTMS-29-T01 | Tests and review evidence must prove this exact rule is enforced: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. |
| BR-228: Users may disable ordinary notifications, but mandatory safety or emergency alerts cannot be disabled while participating in the related Trip. | CTMS-29-T01 | Tests and review evidence must prove this exact rule is enforced: Users may disable ordinary notifications, but mandatory safety or emergency alerts cannot be disabled while participating in the related Trip. |
| BR-229: When an external service times out or returns incomplete data, the system must record the error, must not assume success, and must not create unverifiable data. | CTMS-29-T01 | Tests and review evidence must prove this exact rule is enforced: When an external service times out or returns incomplete data, the system must record the error, must not assume success, and must not create unverifiable data. |
| BR-074: Do not create Trip Member records because the system uses bookings and booking_members. | CTMS-29-T01, CTMS-29-T02 | Tests and review evidence must prove this exact rule is enforced: Do not create Trip Member records because the system uses bookings and booking_members. |
| BR-075: The LLM may only explain the provided input data. | CTMS-29-T01, CTMS-29-T02 | Tests and review evidence must prove this exact rule is enforced: The LLM may only explain the provided input data. |
| BR-076: The LLM must not change the risk score by itself. | CTMS-29-T01, CTMS-29-T02 | Tests and review evidence must prove this exact rule is enforced: The LLM must not change the risk score by itself. |

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped BR missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements
- Implement the `Use LLM to Explain Weather Risk as Clear Advice` workflow exactly within `EPIC 4. Weather Risk`.
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
- Story ID: `CTMS-29`
- Epic: `EPIC 4. Weather Risk`
- Sprint: `Sprint 2`
- Dependencies: `CTMS-26`
- Linked items: `Blocked by: CTMS-26

Blocks: None`
- Spec Reference: `/file/spec/ctms-29-use-llm-to-explain-weather-risk-as-clear-advice.md`
- Business Rules workbook: `C:/Users/admin/Downloads/CTMS_Global_Business_Rules_Sprint_1-3.xlsx`
- Story-level BRs: `BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-228, BR-229, BR-074, BR-075, BR-076`
