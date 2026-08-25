# CTMS-16 - Approve Campsite Before Publishing

**Spec Reference**  
/file/spec/ctms-16-approve-campsite-before-publishing.md

**Story Title**  
Approve Campsite Before Publishing

**Status**  
To Do

**Story**  
As an Admin, I want to approve Campsite Before Publishing so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [x] Only campsites with status = pending_approval can be reviewed.
- [x] approval changes status to active. If not approved, status returns to draft for Host edits and the reason is saved in audit_logs/notifications.
- [x] do not use rejected because the database does not define that status.

## Business Rules Checklist
- [ ] BR-042: Only the Host who owns the campsite may update it.
- [x] BR-043: Only campsites with status = pending_approval may be reviewed.
- [x] BR-044: Approval changes status to active. Rejection returns the campsite to draft so the Host can edit it, and the reason must be stored in audit_logs/notifications.
- [x] BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.
- [x] BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.
- [x] BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.
- [x] BR-210: When concurrent requests change the same resource, the system must use transactions, locking, or version control to prevent overwrites and business limit violations.
- [x] BR-211: Every stateful resource must follow the defined state transitions and must not use values outside the database enum.
- [ ] BR-221: OTP TTL, token TTL, retry count, rate limit, booking hold duration, and retry deadline must be configurable and not hard-coded in logic.
- [x] BR-222: Important actions must be written to the audit log with actor, action, target, timestamp, before/after data, or change reason.
- [x] BR-223: Audit logs are append-only; users and Admins must not edit or delete audit logs through normal business functions.
- [x] BR-224: Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data.
- [ ] BR-225: Automated actions must record actor_id = NULL or a system actor and include a clear execution reason.
- [x] BR-226: Notifications may only be emitted after the business change succeeds; notification delivery failure must not undo the main transaction result.
- [ ] BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.
- [x] BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data.
- [ ] BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.
- [x] BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.
- [x] BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.

## Dev Notes
- Jira status on 2026-08-04: `To Do`.
- Priority: `Should Have`; Story points: `5`; Commitment: `Stretch`.
- Epic: `EPIC 2. Campsite`.
- Sprint: `Sprint 2`; planned window: `2026-08-09` to `2026-08-22`.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks
- CTMS-16-T01 [BE / Shared Logic] Implement `Approve Campsite Before Publishing` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-210, BR-211, BR-221, BR-222, BR-223, BR-224, BR-225, BR-226, BR-042, BR-043, BR-044, BR-206, BR-207. Ref: /file/spec/ctms-16-approve-campsite-before-publishing.md#backend-preparation-logic-and-tests
- CTMS-16-T02 [UI Web/Mobile/Consumer] Implement `Approve Campsite Before Publishing` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-240, BR-241, BR-242, BR-042, BR-043, BR-044. Ref: /file/spec/ctms-16-approve-campsite-before-publishing.md#ui-and-tests

## Task to Acceptance Criteria Traceability
| Acceptance criterion / BR | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: Only campsites with status = pending_approval can be reviewed | CTMS-16-T01, CTMS-16-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC2: approval changes status to active. If not approved, status returns to draft for Host edits and the reason is saved in audit_logs/notifications | CTMS-16-T01, CTMS-16-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC3: do not use rejected because the database does not define that status | CTMS-16-T01, CTMS-16-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. | CTMS-16-T01, CTMS-16-T02 | Tests and review evidence must prove this exact rule is enforced: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. |
| BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data. | CTMS-16-T01, CTMS-16-T02 | Tests and review evidence must prove this exact rule is enforced: Users may only view or change data they own unless their role and business relationship allow access to another user's data. |
| BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. | CTMS-16-T01, CTMS-16-T02 | Tests and review evidence must prove this exact rule is enforced: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. |
| BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. | CTMS-16-T01, CTMS-16-T02 | Tests and review evidence must prove this exact rule is enforced: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. |
| BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. | CTMS-16-T01, CTMS-16-T02 | Tests and review evidence must prove this exact rule is enforced: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. | CTMS-16-T01, CTMS-16-T02 | Tests and review evidence must prove this exact rule is enforced: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. |
| BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect. | CTMS-16-T01 | Tests and review evidence must prove this exact rule is enforced: Cases with insufficient permission or unmet business conditions must not create any side effect. |
| BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. | CTMS-16-T01 | Tests and review evidence must prove this exact rule is enforced: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. |
| BR-210: When concurrent requests change the same resource, the system must use transactions, locking, or version control to prevent overwrites and business limit violations. | CTMS-16-T01 | Tests and review evidence must prove this exact rule is enforced: When concurrent requests change the same resource, the system must use transactions, locking, or version control to prevent overwrites and business limit violations. |
| BR-211: Every stateful resource must follow the defined state transitions and must not use values outside the database enum. | CTMS-16-T01 | Tests and review evidence must prove this exact rule is enforced: Every stateful resource must follow the defined state transitions and must not use values outside the database enum. |
| BR-221: OTP TTL, token TTL, retry count, rate limit, booking hold duration, and retry deadline must be configurable and not hard-coded in logic. | CTMS-16-T01 | Tests and review evidence must prove this exact rule is enforced: OTP TTL, token TTL, retry count, rate limit, booking hold duration, and retry deadline must be configurable and not hard-coded in logic. |
| BR-222: Important actions must be written to the audit log with actor, action, target, timestamp, before/after data, or change reason. | CTMS-16-T01 | Tests and review evidence must prove this exact rule is enforced: Important actions must be written to the audit log with actor, action, target, timestamp, before/after data, or change reason. |
| BR-223: Audit logs are append-only; users and Admins must not edit or delete audit logs through normal business functions. | CTMS-16-T01 | Tests and review evidence must prove this exact rule is enforced: Audit logs are append-only; users and Admins must not edit or delete audit logs through normal business functions. |
| BR-224: Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data. | CTMS-16-T01 | Tests and review evidence must prove this exact rule is enforced: Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data. |
| BR-225: Automated actions must record actor_id = NULL or a system actor and include a clear execution reason. | CTMS-16-T01 | Tests and review evidence must prove this exact rule is enforced: Automated actions must record actor_id = NULL or a system actor and include a clear execution reason. |
| BR-226: Notifications may only be emitted after the business change succeeds; notification delivery failure must not undo the main transaction result. | CTMS-16-T01 | Tests and review evidence must prove this exact rule is enforced: Notifications may only be emitted after the business change succeeds; notification delivery failure must not undo the main transaction result. |
| BR-042: Only the Host who owns the campsite may update it. | CTMS-16-T01, CTMS-16-T02 | Tests and review evidence must prove this exact rule is enforced: Only the Host who owns the campsite may update it. |
| BR-043: Only campsites with status = pending_approval may be reviewed. | CTMS-16-T01, CTMS-16-T02 | Tests and review evidence must prove this exact rule is enforced: Only campsites with status = pending_approval may be reviewed. |
| BR-044: Approval changes status to active. Rejection returns the campsite to draft so the Host can edit it, and the reason must be stored in audit_logs/notifications. | CTMS-16-T01, CTMS-16-T02 | Tests and review evidence must prove this exact rule is enforced: Approval changes status to active. Rejection returns the campsite to draft so the Host can edit it, and the reason must be stored in audit_logs/notifications. |

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped BR missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements
- Implement the `Approve Campsite Before Publishing` workflow exactly within `EPIC 2. Campsite`.
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
- Story ID: `CTMS-16`
- Epic: `EPIC 2. Campsite`
- Sprint: `Sprint 2`
- Dependencies: `CTMS-06, CTMS-10`
- Linked items: `Blocked by: CTMS-06, CTMS-10

Blocks: CTMS-17`
- Spec Reference: `/file/spec/ctms-16-approve-campsite-before-publishing.md`
- Business Rules workbook: `C:/Users/admin/Downloads/CTMS_Global_Business_Rules_Sprint_1-3.xlsx`
- Story-level BRs: `BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-210, BR-211, BR-221, BR-222, BR-223, BR-224, BR-225, BR-226, BR-042, BR-043, BR-044`

## Backend Preparation Logic and Tests

### Actors
- **Admin**: Responsible for reviewing and approving/declining campsites before publishing.
- **System**: Enforces business rules, records actions to audit logs, and handles transactions and notifications.

### Preconditions
- The campsite must exist in the database.
- The campsite's current status must be `pending_approval` (BR-043).
- The authenticated user must be an active account with the role of `admin` (BR-202, BR-204).

### Workflows and Flows

#### Main Flow (Successful Approval)
1. Admin submits a review request with `action = "approve"`.
2. System validates input data and user authorization (BR-204, BR-205).
3. System loads and locks the campsite resource to handle concurrency (BR-210).
4. System verifies that the campsite is in `pending_approval` state (BR-043).
5. System updates the campsite status to `active` (BR-044, BR-211).
6. System writes an entry to the audit log detailing the action and before/after state (BR-222, BR-223, BR-224).
7. System commits the transaction.
8. System emits a notification about the approval (BR-226).
9. System returns `200 OK` with the updated campsite details.

#### Alternate Flow (Decline/Return to Draft)
1. Admin submits a review request with `action = "decline"` and a required `reason`.
2. System performs validation and authorization checks (BR-204, BR-205).
3. System loads and locks the campsite resource (BR-210).
4. System verifies that the campsite is in `pending_approval` state (BR-043).
5. System updates the campsite status back to `draft` (BR-044, BR-211).
6. System writes an entry to the audit log detailing the decline action and the reason (BR-222, BR-223, BR-224).
7. System commits the transaction.
8. System emits a notification to the Host with the decline reason (BR-226).
9. System returns `200 OK` with the updated campsite details.

#### Exception Flows
- **Unauthenticated**: User does not provide a valid JWT token. System aborts and returns `401 Unauthorized` (BR-231).
- **Unauthorized Role**: User is authenticated but is not an Admin. System aborts and returns `403 Forbidden` (BR-231).
- **Invalid Payload**: Request payload is malformed (e.g. invalid action value, or decline action without a reason). System aborts, performs no database writes, and returns `422 Unprocessable Entity` (BR-205, BR-231, BR-243).
- **Campsite Not Found**: The requested campsite ID does not exist. System returns `404 Not Found` (BR-231).
- **Invalid Source State / Conflict**: The campsite is not currently in `pending_approval` status. System returns `409 Conflict` (BR-043, BR-211, BR-231).

### API Contract

**Endpoint**: `PATCH /api/campsites/:id/review`

**Request Headers**:
- `Authorization: Bearer <JWT_TOKEN>`

**Request Body (`ReviewCampsiteDto`)**:
```json
{
  "action": "approve" | "decline",
  "reason": "string (required if action is decline)"
}
```

**Response Body (`CampsiteResponseDto`)**:
- Status: `200 OK`
- Returns updated campsite object (with `status` set to `active` or `draft`).

**Error Responses**:
- `401 Unauthorized`: Authentication failed or user is not active.
- `403 Forbidden`: User is authenticated but does not have `admin` role.
- `404 Not Found`: Campsite does not exist.
- `409 Conflict`: Campsite is not in `pending_approval` status.
- `422 Unprocessable Entity`: Input validation failed (e.g., missing reason when action is decline).

### Data Mapping

| DB Table | DB Field | Source Field / Value | Notes |
| --- | --- | --- | --- |
| `campsites` | `status` | `active` (if action = "approve") or `draft` (if action = "decline") | State transition (BR-044) |
| `audit_logs` | `actor_id` | Authenticated Admin User ID | BR-222 |
| `audit_logs` | `action` | `"campsite.approved"` or `"campsite.declined"` | BR-222 |
| `audit_logs` | `target_type` | `"campsite"` | BR-222 |
| `audit_logs` | `target_id` | Campsite ID | BR-222 |
| `audit_logs` | `before` | `{ "status": "pending_approval" }` | BR-222 |
| `audit_logs` | `after` | `{ "status": "active" }` or `{ "status": "draft" }` | BR-222 |
| `audit_logs` | `reason` | Request `reason` (null if approved) | BR-222, BR-224 |

