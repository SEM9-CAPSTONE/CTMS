# CTMS-05 - Reset Forgotten Password

**Spec Reference**  
/file/spec/ctms-05-reset-forgotten-password.md

**Story Title**  
Reset Forgotten Password

**Status**  
Done

**Story**  
As a user, I want to reset Forgotten Password so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria

- [x] An OTP code is available.
- [x] The new password must satisfy password rules.
- [x] Old login sessions are revoked.

## Backend Preparation, Logic, and Tests

### Actors and Preconditions

- Actor: any user who has forgotten their password and can receive an OTP through the contact method on the account.
- The reset request endpoint is public because the user is not logged in.
- Reset completion requires an existing active account and a valid, unexpired OTP stored for that account.
- Unknown, pending, suspended, or deleted accounts do not receive a reset OTP; the request response remains neutral to avoid account enumeration.

### API Contract

- `POST /auth/forgot-password`
  - Request: `{ "identifier": "email-or-phone", "channel": "email" | "phone" }`
  - Response: `{ "requestAccepted": true }`
  - Behavior: normalize identifier, find an active account, generate and deliver an OTP, then persist only the OTP hash.
- `POST /auth/reset-password`
  - Request: `{ "identifier": "email-or-phone", "code": "otp", "newPassword": "..." }`
  - Response: `{ "passwordReset": true }`
  - Behavior: verify the OTP, hash the new password, delete the OTP row, revoke active refresh tokens, and append an audit log in one transaction.

### Validation and Error Mapping

- Identifier is required, normalized, and bounded to 254 characters.
- `channel` must be `email` or `phone`.
- `newPassword` must be 8-128 characters and contain at least one letter and one number.
- Missing reset credential returns `404`.
- Expired or incorrect reset credential returns `409`.
- Invalid request shape returns `422`.

### Data Mapping

- Reset OTPs reuse `verification_otps` with one row per user; raw OTP values are never stored.
- Passwords are persisted only as bcrypt hashes using the existing auth cost factor.
- Refresh tokens are revoked by setting `refresh_tokens.revoked_at` for active tokens of the user.
- Audit evidence is appended to `audit_logs` with action `auth.password_reset`, actor/target user id, before/after session-revocation state, and reason `forgot_password_otp_verified`.

### Test Evidence

- Unit tests cover neutral reset requests, OTP delivery/persistence, invalid and expired credentials, password hashing, refresh-token revocation, OTP invalidation, and audit logging.

## Business Rules Checklist

- [x] BR-013: Expired or revoked refresh tokens must be rejected.
- [x] BR-014: Password reset requests must be verified by a valid OTP.
- [x] BR-015: The new password must satisfy the system password policy.
- [x] BR-200: Every change must be written to the audit log.
- [x] BR-201: Every function requiring authentication may only be performed when the user has a valid login session and the account is active.
- [x] BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.
- [x] BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.
- [x] BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.
- [x] BR-214: Every data relationship must reference an existing and valid record; child records must not be created for resources outside the correct business scope.
- [x] BR-215: Emails must be normalized before comparison and storage; phone numbers must be normalized to a consistent format, preferably E.164.
- [x] BR-220: A valid time range must have a start time earlier than the end time, unless the business rule explicitly allows equality.
- [x] BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.
- [x] BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data.
- [x] BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.
- [x] BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.
- [x] BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.

## Dev Notes

- Jira status on 2026-08-04: `To Do`.
- Priority: `Must Have`; Story points: `5`; Commitment: `Stretch`.
- Epic: `EPIC 1. Authentication`.
- Sprint: `Sprint 1`; planned window: `2026-07-26` to `2026-08-08`.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks

- CTMS-05-T01 [BE / Shared Logic] Implement `Reset Forgotten Password` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-200, BR-201, BR-214, BR-215, BR-220, BR-013, BR-014, BR-015, BR-206, BR-207. Ref: /file/spec/ctms-05-reset-forgotten-password.md#backend-preparation-logic-and-tests
- CTMS-05-T02 [UI Web/Mobile/Consumer] Implement `Reset Forgotten Password` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-240, BR-241, BR-242, BR-013, BR-014, BR-015. Ref: /file/spec/ctms-05-reset-forgotten-password.md#ui-and-tests

## Task to Acceptance Criteria Traceability

| Acceptance criterion / BR                                                                                                                                                                 | Covered by tasks         | Evidence expected                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1: An OTP or reset link is available                                                                                                                                                    | CTMS-05-T01, CTMS-05-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer                                                                                                                                                                              |
| AC2: the new password must satisfy password rules                                                                                                                                         | CTMS-05-T01, CTMS-05-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer                                                                                                                                                                              |
| AC3: old login sessions are revoked                                                                                                                                                       | CTMS-05-T01, CTMS-05-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer                                                                                                                                                                              |
| BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.              | CTMS-05-T01, CTMS-05-T02 | Tests and review evidence must prove this exact rule is enforced: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.              |
| BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.                                                      | CTMS-05-T01, CTMS-05-T02 | Tests and review evidence must prove this exact rule is enforced: Users may only view or change data they own unless their role and business relationship allow access to another user's data.                                                      |
| BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.                                    | CTMS-05-T01, CTMS-05-T02 | Tests and review evidence must prove this exact rule is enforced: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.                                    |
| BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.                                                                 | CTMS-05-T01, CTMS-05-T02 | Tests and review evidence must prove this exact rule is enforced: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.                                                                 |
| BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. | CTMS-05-T01, CTMS-05-T02 | Tests and review evidence must prove this exact rule is enforced: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.                           | CTMS-05-T01, CTMS-05-T02 | Tests and review evidence must prove this exact rule is enforced: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.                           |
| BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.                                                                                  | CTMS-05-T01              | Tests and review evidence must prove this exact rule is enforced: Cases with insufficient permission or unmet business conditions must not create any side effect.                                                                                  |
| BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.                              | CTMS-05-T01              | Tests and review evidence must prove this exact rule is enforced: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.                              |
| BR-200: Every change must be written to the audit log.                                                                                                                                    | CTMS-05-T01              | Tests and review evidence must prove this exact rule is enforced: Every change must be written to the audit log.                                                                                                                                    |
| BR-201: Every function requiring authentication may only be performed when the user has a valid login session and the account is active.                                                  | CTMS-05-T01              | Tests and review evidence must prove this exact rule is enforced: Every function requiring authentication may only be performed when the user has a valid login session and the account is active.                                                  |
| BR-214: Every data relationship must reference an existing and valid record; child records must not be created for resources outside the correct business scope.                          | CTMS-05-T01              | Tests and review evidence must prove this exact rule is enforced: Every data relationship must reference an existing and valid record; child records must not be created for resources outside the correct business scope.                          |
| BR-215: Emails must be normalized before comparison and storage; phone numbers must be normalized to a consistent format, preferably E.164.                                               | CTMS-05-T01              | Tests and review evidence must prove this exact rule is enforced: Emails must be normalized before comparison and storage; phone numbers must be normalized to a consistent format, preferably E.164.                                               |
| BR-220: A valid time range must have a start time earlier than the end time, unless the business rule explicitly allows equality.                                                         | CTMS-05-T01              | Tests and review evidence must prove this exact rule is enforced: A valid time range must have a start time earlier than the end time, unless the business rule explicitly allows equality.                                                         |
| BR-013: Expired or revoked refresh tokens must be rejected.                                                                                                                               | CTMS-05-T01, CTMS-05-T02 | Tests and review evidence must prove this exact rule is enforced: Expired or revoked refresh tokens must be rejected.                                                                                                                               |
| BR-014: Password reset requests must be verified by a valid OTP or reset link.                                                                                                            | CTMS-05-T01, CTMS-05-T02 | Tests and review evidence must prove this exact rule is enforced: Password reset requests must be verified by a valid OTP or reset link.                                                                                                            |
| BR-015: The new password must satisfy the system password policy.                                                                                                                         | CTMS-05-T01, CTMS-05-T02 | Tests and review evidence must prove this exact rule is enforced: The new password must satisfy the system password policy.                                                                                                                         |

## Story-Specific Risks and Edge Cases

- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped BR missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements

- Implement the `Reset Forgotten Password` workflow exactly within `EPIC 1. Authentication`.
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

- Story ID: `CTMS-05`
- Epic: `EPIC 1. Authentication`
- Sprint: `Sprint 1`
- Dependencies: `CTMS-01`
- Linked items: `Blocked by: CTMS-01

Blocks: None`

- Spec Reference: `/file/spec/ctms-05-reset-forgotten-password.md`
- Business Rules workbook: `C:/Users/admin/Downloads/CTMS_Global_Business_Rules_Sprint_1-3.xlsx`
- Story-level BRs: `BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-200, BR-201, BR-214, BR-215, BR-220, BR-013, BR-014, BR-015`
