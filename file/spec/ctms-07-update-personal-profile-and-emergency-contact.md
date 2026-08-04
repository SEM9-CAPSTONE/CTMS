# CTMS-07 - Update Personal Profile and Emergency Contact

**Spec Reference**  
/file/spec/ctms-07-update-personal-profile-and-emergency-contact.md

**Story Title**  
Update Personal Profile and Emergency Contact

**Status**  
To Do

**Story**  
As a user, I want to update Personal Profile and Emergency Contact so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [ ] Valid profile information is updated successfully.
- [ ] emergency contacts are saved.
- [ ] access to sensitive data is permission-checked.

## Business Rules Checklist
- [ ] BR-019: Authenticated actions without sufficient permission must return HTTP 403 and must not create side effects.
- [ ] BR-020: Personal profile information may only be updated when the submitted data is valid.
- [ ] BR-021: Each account may store at most two emergency contacts using the required structure.
- [ ] BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.
- [ ] BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.
- [ ] BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.
- [ ] BR-216: Passwords, OTPs, access tokens, and refresh tokens must not be stored as plaintext; logs and API responses must not expose these values.
- [ ] BR-217: Personal data and health data may only return the fields needed for the business purpose and only to authorized users.
- [ ] BR-223: Audit logs are append-only; users and Admins must not edit or delete audit logs through normal business functions.
- [ ] BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.
- [ ] BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data.
- [ ] BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.
- [ ] BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.
- [ ] BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.

## Dev Notes
- Jira status on 2026-08-04: `To Do`.
- Priority: `Must Have`; Story points: `5`; Commitment: `Committed`.
- Epic: `EPIC 1. Authentication`.
- Sprint: `Sprint 1`; planned window: `2026-07-26` to `2026-08-08`.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks
- CTMS-07-T01 [BE / Shared Logic] Implement `Update Personal Profile and Emergency Contact` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-216, BR-217, BR-223, BR-019, BR-020, BR-021, BR-206, BR-207. Ref: /file/spec/ctms-07-update-personal-profile-and-emergency-contact.md#backend-preparation-logic-and-tests
- CTMS-07-T02 [UI Web/Mobile/Consumer] Implement `Update Personal Profile and Emergency Contact` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-240, BR-241, BR-242, BR-019, BR-020, BR-021. Ref: /file/spec/ctms-07-update-personal-profile-and-emergency-contact.md#ui-and-tests

## Task to Acceptance Criteria Traceability
| Acceptance criterion / BR | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: Valid profile information is updated successfully | CTMS-07-T01, CTMS-07-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC2: emergency contacts are saved | CTMS-07-T01, CTMS-07-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC3: access to sensitive data is permission-checked | CTMS-07-T01, CTMS-07-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. | CTMS-07-T01, CTMS-07-T02 | Tests and review evidence must prove this exact rule is enforced: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. |
| BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data. | CTMS-07-T01, CTMS-07-T02 | Tests and review evidence must prove this exact rule is enforced: Users may only view or change data they own unless their role and business relationship allow access to another user's data. |
| BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. | CTMS-07-T01, CTMS-07-T02 | Tests and review evidence must prove this exact rule is enforced: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. |
| BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. | CTMS-07-T01, CTMS-07-T02 | Tests and review evidence must prove this exact rule is enforced: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. |
| BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. | CTMS-07-T01, CTMS-07-T02 | Tests and review evidence must prove this exact rule is enforced: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. | CTMS-07-T01, CTMS-07-T02 | Tests and review evidence must prove this exact rule is enforced: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. |
| BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect. | CTMS-07-T01 | Tests and review evidence must prove this exact rule is enforced: Cases with insufficient permission or unmet business conditions must not create any side effect. |
| BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. | CTMS-07-T01 | Tests and review evidence must prove this exact rule is enforced: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. |
| BR-216: Passwords, OTPs, access tokens, and refresh tokens must not be stored as plaintext; logs and API responses must not expose these values. | CTMS-07-T01 | Tests and review evidence must prove this exact rule is enforced: Passwords, OTPs, access tokens, and refresh tokens must not be stored as plaintext; logs and API responses must not expose these values. |
| BR-217: Personal data and health data may only return the fields needed for the business purpose and only to authorized users. | CTMS-07-T01 | Tests and review evidence must prove this exact rule is enforced: Personal data and health data may only return the fields needed for the business purpose and only to authorized users. |
| BR-223: Audit logs are append-only; users and Admins must not edit or delete audit logs through normal business functions. | CTMS-07-T01 | Tests and review evidence must prove this exact rule is enforced: Audit logs are append-only; users and Admins must not edit or delete audit logs through normal business functions. |
| BR-019: Authenticated actions without sufficient permission must return HTTP 403 and must not create side effects. | CTMS-07-T01, CTMS-07-T02 | Tests and review evidence must prove this exact rule is enforced: Authenticated actions without sufficient permission must return HTTP 403 and must not create side effects. |
| BR-020: Personal profile information may only be updated when the submitted data is valid. | CTMS-07-T01, CTMS-07-T02 | Tests and review evidence must prove this exact rule is enforced: Personal profile information may only be updated when the submitted data is valid. |
| BR-021: Each account may store at most two emergency contacts using the required structure. | CTMS-07-T01, CTMS-07-T02 | Tests and review evidence must prove this exact rule is enforced: Each account may store at most two emergency contacts using the required structure. |

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped BR missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements
- Implement the `Update Personal Profile and Emergency Contact` workflow exactly within `EPIC 1. Authentication`.
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
- Story ID: `CTMS-07`
- Epic: `EPIC 1. Authentication`
- Sprint: `Sprint 1`
- Dependencies: `CTMS-03`
- Linked items: `Blocked by: CTMS-03

Blocks: CTMS-09`
- Spec Reference: `/file/spec/ctms-07-update-personal-profile-and-emergency-contact.md`
- Business Rules workbook: `C:/Users/admin/Downloads/CTMS_Global_Business_Rules_Sprint_1-3.xlsx`
- Story-level BRs: `BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-216, BR-217, BR-223, BR-019, BR-020, BR-021`
