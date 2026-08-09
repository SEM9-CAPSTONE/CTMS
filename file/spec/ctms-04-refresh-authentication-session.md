# CTMS-04 - Refresh Authentication Session

**Spec Reference**  
/file/spec/ctms-04-refresh-authentication-session.md

**Story Title**  
Refresh Authentication Session

**Status**  
In Progress

**Story**  
As a user, I want to refresh Authentication Session so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [x] A valid refresh token creates a new access token.
- [x] expired or revoked tokens must be rejected.

## Business Rules Checklist
- [x] BR-011: Locked accounts must not be allowed to log in.
- [x] BR-012: A valid refresh token must be able to create a new access token.
- [x] BR-200: Every change must be written to the audit log.
- [x] BR-201: Every function requiring authentication may only be performed when the user has a valid login session and the account is active.
- [x] BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.
- [x] BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.
- [x] BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.
- [x] BR-206: The backend is the final authority for permissions, status, pricing, capacity, inventory, risk level, and transaction results; clients must not set these values by themselves.
- [x] BR-207: Every change involving multiple tables or records must run in a transaction; if one step fails, the whole business operation must roll back.
- [x] BR-214: Every data relationship must reference an existing and valid record; child records must not be created for resources outside the correct business scope.
- [x] BR-215: Emails must be normalized before comparison and storage; phone numbers must be normalized to a consistent format, preferably E.164. (Not applicable to CTMS-04-T01 — refresh does not touch email/phone.)
- [x] BR-220: A valid time range must have a start time earlier than the end time, unless the business rule explicitly allows equality. (Not applicable to CTMS-04-T01 — refresh has no time-range input.)
- [x] BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. (Not applicable to CTMS-04-T01 — refresh calls no external service; the DG-03 concurrent-refresh guard covers duplicate-request safety instead.)
- [x] BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data.
- [x] BR-236: Users may only add, delete, or reorder media for resources they own or are authorized to manage. (Not applicable to CTMS-04-T01 — no media involved.)
- [x] BR-237: Background jobs must re-check business conditions at execution time and must not rely only on stale state. (Not applicable to CTMS-04-T01 — refresh is a synchronous request, not a background job.)
- [ ] BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. (CTMS-04-T02 scope — UI concern, not yet implemented.)
- [x] BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.
- [x] BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.

## Dev Notes
- Jira status on 2026-08-04: `In Progress`.
- Priority: `Must Have`; Story points: `3`; Commitment: `Committed`.
- Epic: `EPIC 1. Authentication`.
- Sprint: `Sprint 1`; planned window: `2026-07-26` to `2026-08-08`.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks
- [x] CTMS-04-T01 [BE / Shared Logic] Implement `Refresh Authentication Session` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-200, BR-201, BR-214, BR-215, BR-220, BR-236, BR-237, BR-011, BR-012, BR-206, BR-207. Ref: /file/spec/ctms-04-refresh-authentication-session.md#backend-preparation-logic-and-tests
- [ ] CTMS-04-T02 [UI Web/Mobile/Consumer] Implement `Refresh Authentication Session` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-240, BR-241, BR-242, BR-011, BR-012. Ref: /file/spec/ctms-04-refresh-authentication-session.md#ui-and-tests

## API Contract (CTMS-04-T01 — implemented)

This story shipped with no API Contract on record. The contract below was
resolved through this task's own Decision Gate (DG-01 → DG-05) and is
recorded here per BR-244.

### `POST /auth/refresh`

Request body:

```json
{ "refreshToken": "<raw refresh token issued at login or by a previous refresh>" }
```

Success response `200`:

```json
{ "accessToken": "<new JWT access token>", "refreshToken": "<new raw refresh token>" }
```

No `user` field (DG-01) — unlike `POST /auth/login`'s response.

Errors:
- `401` — the refresh token was not found, expired, already revoked, already
  rotated (reused), or the owning account is no longer `active`. All 5 cases
  return the exact same message, by design — the same anti-enumeration
  reasoning as `/auth/login`'s single "Invalid credentials" message
  (BR-231): a caller must not be able to tell "bad token" from "right token,
  wrong account state" from the response alone.
- `422` — `refreshToken` missing or not a string (BR-205, via the existing
  global `ValidationPipe`).

### Rotation (DG-02)

Every successful refresh revokes the presented token and issues a brand-new
one in the same DB transaction (BR-207) — there is no "keep the same
refresh token, only mint a new access token" path. The new refresh token
reuses `POST /auth/login`'s exact generation scheme (`randomBytes(32)` hex,
SHA-256 hash) and TTL (`JWT_REFRESH_TOKEN_TTL`).

### Reuse / concurrent refresh (DG-03)

Guarded by a single conditional `UPDATE ... WHERE revoked_at IS NULL AND
expires_at > :now`, keyed by the token's row id, executed inside the
rotation transaction. If 0 rows are affected, the token was already
invalidated — a genuine reuse attempt, or a second concurrent request
racing the first — and the call is rejected exactly like a first-time-invalid
token (BR-243: no new token row is written). No token family, no additional
migration, no distributed lock: the row-level conditional `UPDATE` is the
entire guard.

### Session revocation (DG-04)

Not a separate mechanism: a token revoked through any existing path (e.g.
`resetPassword()`'s bulk `revokeActiveTokensForUser()`) is rejected by
`/auth/refresh` the same way an already-rotated token is — both simply have
`revoked_at IS NOT NULL`.

### Account status re-check (BR-201/BR-202)

Every refresh re-checks the owning user's *current* `status`; only `active`
accounts may refresh, independent of what the account's status was at the
time the presented token was originally issued.

### Audit logging (DG-05/BR-200)

Each successful rotation writes one `audit_logs` row
(`action: "auth.token_refreshed"`). `POST /auth/login`'s own refresh-token
creation does not write an equivalent row — tracked separately as CTMS-03
known debt, intentionally left unchanged by this story (Decision Gate
DG-05).

## Task to Acceptance Criteria Traceability
| Acceptance criterion / BR | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: A valid refresh token creates a new access token | CTMS-04-T01, CTMS-04-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC2: expired or revoked tokens must be rejected | CTMS-04-T01, CTMS-04-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. | CTMS-04-T01, CTMS-04-T02 | Tests and review evidence must prove this exact rule is enforced: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. |
| BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data. | CTMS-04-T01, CTMS-04-T02 | Tests and review evidence must prove this exact rule is enforced: Users may only view or change data they own unless their role and business relationship allow access to another user's data. |
| BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. | CTMS-04-T01, CTMS-04-T02 | Tests and review evidence must prove this exact rule is enforced: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. |
| BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. | CTMS-04-T01, CTMS-04-T02 | Tests and review evidence must prove this exact rule is enforced: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. |
| BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. | CTMS-04-T01, CTMS-04-T02 | Tests and review evidence must prove this exact rule is enforced: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. | CTMS-04-T01, CTMS-04-T02 | Tests and review evidence must prove this exact rule is enforced: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. |
| BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect. | CTMS-04-T01 | Tests and review evidence must prove this exact rule is enforced: Cases with insufficient permission or unmet business conditions must not create any side effect. |
| BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. | CTMS-04-T01 | Tests and review evidence must prove this exact rule is enforced: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. |
| BR-200: Every change must be written to the audit log. | CTMS-04-T01 | Tests and review evidence must prove this exact rule is enforced: Every change must be written to the audit log. |
| BR-201: Every function requiring authentication may only be performed when the user has a valid login session and the account is active. | CTMS-04-T01 | Tests and review evidence must prove this exact rule is enforced: Every function requiring authentication may only be performed when the user has a valid login session and the account is active. |
| BR-214: Every data relationship must reference an existing and valid record; child records must not be created for resources outside the correct business scope. | CTMS-04-T01 | Tests and review evidence must prove this exact rule is enforced: Every data relationship must reference an existing and valid record; child records must not be created for resources outside the correct business scope. |
| BR-215: Emails must be normalized before comparison and storage; phone numbers must be normalized to a consistent format, preferably E.164. | CTMS-04-T01 | Tests and review evidence must prove this exact rule is enforced: Emails must be normalized before comparison and storage; phone numbers must be normalized to a consistent format, preferably E.164. |
| BR-220: A valid time range must have a start time earlier than the end time, unless the business rule explicitly allows equality. | CTMS-04-T01 | Tests and review evidence must prove this exact rule is enforced: A valid time range must have a start time earlier than the end time, unless the business rule explicitly allows equality. |
| BR-236: Users may only add, delete, or reorder media for resources they own or are authorized to manage. | CTMS-04-T01 | Tests and review evidence must prove this exact rule is enforced: Users may only add, delete, or reorder media for resources they own or are authorized to manage. |
| BR-237: Background jobs must re-check business conditions at execution time and must not rely only on stale state. | CTMS-04-T01 | Tests and review evidence must prove this exact rule is enforced: Background jobs must re-check business conditions at execution time and must not rely only on stale state. |
| BR-011: Locked accounts must not be allowed to log in. | CTMS-04-T01, CTMS-04-T02 | Tests and review evidence must prove this exact rule is enforced: Locked accounts must not be allowed to log in. |
| BR-012: A valid refresh token must be able to create a new access token. | CTMS-04-T01, CTMS-04-T02 | Tests and review evidence must prove this exact rule is enforced: A valid refresh token must be able to create a new access token. |

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped BR missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements
- Implement the `Refresh Authentication Session` workflow exactly within `EPIC 1. Authentication`.
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
- Story ID: `CTMS-04`
- Epic: `EPIC 1. Authentication`
- Sprint: `Sprint 1`
- Dependencies: `CTMS-03`
- Linked items: `Blocked by: CTMS-03

Blocks: None`
- Spec Reference: `/file/spec/ctms-04-refresh-authentication-session.md`
- Business Rules workbook: `C:/Users/admin/Downloads/CTMS_Global_Business_Rules_Sprint_1-3.xlsx`
- Story-level BRs: `BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-200, BR-201, BR-214, BR-215, BR-220, BR-236, BR-237, BR-011, BR-012`
