# CTMS-125 - View Audit Log

**Spec Reference**  
/file/spec/ctms-125-view-audit-log.md

**Story Title**  
View Audit Log

**Status**  
To Do

**Story**  
As an Admin, I want to view Audit Log so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [ ] Filter by user, action, time, and target.
- [ ] logs cannot be edited.

## Business Rules Checklist
- [ ] BR-195: The system must store actor, action, target, timestamp, before data, and after data.
- [ ] BR-196: The audit log must be filterable by user, action, time, and target.
- [ ] BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.
- [ ] BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.
- [ ] BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.
- [ ] BR-218: Access to health data must be based on consent and the relationship to the Trip; when consent is withdrawn, access must end immediately.
- [ ] BR-219: All times must be stored as timestamptz and displayed using the configured user or location time zone.
- [ ] BR-221: OTP TTL, token TTL, retry count, rate limit, booking hold duration, and retry deadline must be configurable and not hard-coded in logic.
- [ ] BR-222: Important actions must be written to the audit log with actor, action, target, timestamp, before/after data, or change reason.
- [ ] BR-223: Audit logs are append-only; users and Admins must not edit or delete audit logs through normal business functions.
- [ ] BR-224: Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data.
- [ ] BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.
- [ ] BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data.
- [ ] BR-232: Error messages must be clear, actionable, and must not expose stack traces, secrets, or resources the user is not authorized to view.
- [ ] BR-233: List APIs must support pagination and record limits; filtering and sorting may only use published fields.
- [ ] BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.
- [ ] BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.
- [ ] BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.

## Dev Notes
- Jira status on 2026-08-04: `To Do`.
- Priority: `Should Have`; Story points: `5`; Commitment: `Stretch`.
- Epic: `EPIC 19. Administration`.
- Sprint: `Sprint 1`; planned window: `2026-07-26` to `2026-08-08`.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks
- CTMS-125-T01 [BE / Shared Logic] Implement `View Audit Log` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-221, BR-222, BR-223, BR-224, BR-232, BR-233, BR-218, BR-219, BR-195, BR-196, BR-206, BR-207. Ref: /file/spec/ctms-125-view-audit-log.md#backend-preparation-logic-and-tests
- CTMS-125-T02 [UI Web/Mobile/Consumer] Implement `View Audit Log` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-240, BR-241, BR-242, BR-195, BR-196. Ref: /file/spec/ctms-125-view-audit-log.md#ui-and-tests

## Task to Acceptance Criteria Traceability
| Acceptance criterion / BR | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: Filter by user, action, time, and target | CTMS-125-T01, CTMS-125-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC2: logs cannot be edited | CTMS-125-T01, CTMS-125-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. | CTMS-125-T01, CTMS-125-T02 | Tests and review evidence must prove this exact rule is enforced: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. |
| BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data. | CTMS-125-T01, CTMS-125-T02 | Tests and review evidence must prove this exact rule is enforced: Users may only view or change data they own unless their role and business relationship allow access to another user's data. |
| BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. | CTMS-125-T01, CTMS-125-T02 | Tests and review evidence must prove this exact rule is enforced: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. |
| BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. | CTMS-125-T01, CTMS-125-T02 | Tests and review evidence must prove this exact rule is enforced: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. |
| BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. | CTMS-125-T01, CTMS-125-T02 | Tests and review evidence must prove this exact rule is enforced: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. | CTMS-125-T01, CTMS-125-T02 | Tests and review evidence must prove this exact rule is enforced: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. |
| BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect. | CTMS-125-T01 | Tests and review evidence must prove this exact rule is enforced: Cases with insufficient permission or unmet business conditions must not create any side effect. |
| BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. | CTMS-125-T01 | Tests and review evidence must prove this exact rule is enforced: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. |
| BR-221: OTP TTL, token TTL, retry count, rate limit, booking hold duration, and retry deadline must be configurable and not hard-coded in logic. | CTMS-125-T01 | Tests and review evidence must prove this exact rule is enforced: OTP TTL, token TTL, retry count, rate limit, booking hold duration, and retry deadline must be configurable and not hard-coded in logic. |
| BR-222: Important actions must be written to the audit log with actor, action, target, timestamp, before/after data, or change reason. | CTMS-125-T01 | Tests and review evidence must prove this exact rule is enforced: Important actions must be written to the audit log with actor, action, target, timestamp, before/after data, or change reason. |
| BR-223: Audit logs are append-only; users and Admins must not edit or delete audit logs through normal business functions. | CTMS-125-T01 | Tests and review evidence must prove this exact rule is enforced: Audit logs are append-only; users and Admins must not edit or delete audit logs through normal business functions. |
| BR-224: Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data. | CTMS-125-T01 | Tests and review evidence must prove this exact rule is enforced: Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data. |
| BR-232: Error messages must be clear, actionable, and must not expose stack traces, secrets, or resources the user is not authorized to view. | CTMS-125-T01 | Tests and review evidence must prove this exact rule is enforced: Error messages must be clear, actionable, and must not expose stack traces, secrets, or resources the user is not authorized to view. |
| BR-233: List APIs must support pagination and record limits; filtering and sorting may only use published fields. | CTMS-125-T01 | Tests and review evidence must prove this exact rule is enforced: List APIs must support pagination and record limits; filtering and sorting may only use published fields. |
| BR-218: Access to health data must be based on consent and the relationship to the Trip; when consent is withdrawn, access must end immediately. | CTMS-125-T01 | Tests and review evidence must prove this exact rule is enforced: Access to health data must be based on consent and the relationship to the Trip; when consent is withdrawn, access must end immediately. |
| BR-219: All times must be stored as timestamptz and displayed using the configured user or location time zone. | CTMS-125-T01 | Tests and review evidence must prove this exact rule is enforced: All times must be stored as timestamptz and displayed using the configured user or location time zone. |
| BR-195: The system must store actor, action, target, timestamp, before data, and after data. | CTMS-125-T01, CTMS-125-T02 | Tests and review evidence must prove this exact rule is enforced: The system must store actor, action, target, timestamp, before data, and after data. |
| BR-196: The audit log must be filterable by user, action, time, and target. | CTMS-125-T01, CTMS-125-T02 | Tests and review evidence must prove this exact rule is enforced: The audit log must be filterable by user, action, time, and target. |

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped BR missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements
- Implement the `View Audit Log` workflow exactly within `EPIC 19. Administration`.
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
- Story ID: `CTMS-125`
- Epic: `EPIC 19. Administration`
- Sprint: `Sprint 1`
- Dependencies: `CTMS-124`
- Linked items: `Blocked by: CTMS-124

Blocks: None`
- Spec Reference: `/file/spec/ctms-125-view-audit-log.md`
- Business Rules workbook: `C:/Users/admin/Downloads/CTMS_Global_Business_Rules_Sprint_1-3.xlsx`
- Story-level BRs: `BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-221, BR-222, BR-223, BR-224, BR-232, BR-233, BR-218, BR-219, BR-195, BR-196`

## Backend Preparation Logic and Tests

This section outlines the detailed requirements, actors, flows, and API specifications for viewing audit logs.

### 1. Actors
- **Admin**: The authorized system user who has permission to view audit logs.

### 2. Preconditions
- The Admin must be authenticated.
- The Admin must have the `admin` role and an active account status.

### 3. Core Audit Logs Viewing Flows

#### View Audit Logs (Main Flow)
1. **Request**: The Admin requests the list of audit logs via `GET /api/audit-logs` with optional query filters (actor, action, target, outcome, time range) and pagination (page, limit).
2. **Authorization**: The system checks if the user is authenticated and is a current active Admin. If not, it returns `401 Unauthorized` or `403 Forbidden` respectively.
3. **Validation**: The system validates query inputs. If invalid (e.g. invalid UUID format for IDs, non-integer page/limit, invalid Date format), it returns `422 Unprocessable Entity`.
4. **Execution**: The service queries the `audit_logs` table matching the criteria, sorting by `created_at DESC, id DESC`.
5. **Masking**: The system masks any sensitive fields (like password, OTP, tokens) present in the `before` or `after` states with `[MASKED]`.
6. **Response**: Returns a `200 OK` status with the paginated list of audit logs and pagination metadata.

#### Filter by Outcome (Alternate Flow)
- If the requested outcome is `failure`, since failed operations do not persist logs, the system returns an empty items array `[]` with correct pagination metrics (total: 0, totalPages: 0, page: 1, limit: limit).

### 4. API Specification

- **Endpoint**: `GET /api/audit-logs`
- **Headers**: `Authorization: Bearer <token>`
- **Query Parameters**:
  - `actorId` / `actor` (UUID, optional): Filter by actor user ID
  - `action` (string, optional): Filter by action name (e.g., `auth.register`)
  - `targetId` / `target` (UUID, optional): Filter by target ID
  - `targetType` (string, optional): Filter by target entity type
  - `outcome` (string, optional): Filter by outcome (`success` or `failure`)
  - `startDate` (ISO Date, optional): Start of time range (inclusive)
  - `endDate` (ISO Date, optional): End of time range (inclusive)
  - `page` (number, optional, default: 1): Page number
  - `limit` (number, optional, default: 20): Maximum records per page
- **Responses**:
  - `200 OK`: Returns paginated list of logs.
  - `401 Unauthorized`: Authentication required or invalid token.
  - `403 Forbidden`: Admin role required.
  - `422 Unprocessable Entity`: Invalid query parameters.

