# CTMS-08 - Log Out from Current Device or All Devices

**Spec Reference**  
`/file/spec/ctms-08-log-out-from-current-device-or-all-devices.md`

**Story Title**  
Log Out from Current Device or All Devices

**Status**  
Done

**Story**  
As a user, I want to log out from the current device or all devices so that I can protect my account.

## Acceptance Criteria

- [x] AC1: Logging out from the current device revokes the refresh token for that session.
- [x] AC2: Logging out from all devices invalidates every active refresh token belonging to the authenticated user.
- [x] AC3: Revoked refresh tokens cannot be used to refresh a session.
- [x] AC4: The client clears local authentication data after logout.

## Business Rules Checklist

- [x] BR-023: Logging out from the current device must revoke the refresh token for that session.
- [x] BR-200: Every successful logout state change must be written to the audit log.
- [x] BR-201: Functions requiring authentication may only be performed with a valid authenticated session.
- [x] BR-204: Users may only change data/sessions that they own unless explicitly authorized.
- [x] BR-205: Required input fields and data types must be validated before processing.
- [x] BR-206: The backend is the final authority for authorization and transaction results.
- [x] BR-207: Changes involving multiple records must run inside a transaction and roll back on failure.
- [x] BR-209: Retryable operations must be safe and idempotent where applicable.
- [x] BR-231: APIs return consistent error codes for authentication and invalid input.
- [x] BR-243: Rejected requests must not create unauthorized side effects.
- [x] BR-244: API-contract and business-rule changes must update the Spec and tests together.
- [x] BR-022: Client-side handling of sensitive local authentication data is covered by CTMS-08-T02.
- [x] BR-202: Account-status-specific UI/session behavior remains part of the complete story validation.
- [x] BR-242: UI error/retry behavior is covered by CTMS-08-T02.

## Dev Notes

- Jira story: `CTMS-8`.
- Backend subtask: `CTMS-28` / `CTMS-08-T01`.
- Epic: `EPIC 1. Authentication and User Management`.
- Dependency: `CTMS-03`.
- Current backend contract uses one endpoint: `POST /api/auth/logout`.
- Current-device logout is represented by the submitted refresh-token session; no `deviceId`, IP, or user-agent is required.
- Raw refresh tokens are not persisted. The backend stores SHA-256 token hashes.
- Existing `refresh_tokens.revokedAt` supports logout without a schema migration.
- Keep API, UI, database, tests, and Jira references aligned with this Spec Reference.

## Story-Specific Implementation Tasks

- **CTMS-08-T01 / CTMS-28 [BE Preparation + Logic + Tests]** Define actor, precondition, main/alternate/exception flow, business rules, API contract, data mapping and backend test cases; then implement API/service/repository, authorization, validation and transaction handling for `Log Out from Current Device or All Devices`. In the same task, add Unit Tests for service/domain logic and E2E/API tests from request → database → response, including success, error, ownership, rollback and idempotency where applicable.  
  Ref: `/file/spec/ctms-08-log-out-from-current-device-or-all-devices.md#backend-preparation-logic-and-tests`  
  Blocked by: `CTMS-03`  
  Blocks: `CTMS-08-T02`

- **CTMS-08-T02 [UI + Tests]** Use the API contract defined in T01 to implement current-device/all-device logout on Web/Mobile/consumer clients, clear local auth state, map loading/error/success states, and redirect appropriately. Add UI Unit/Component Tests and UI E2E coverage.  
  Ref: `/file/spec/ctms-08-log-out-from-current-device-or-all-devices.md#ui-and-tests`  
  Blocked by: `CTMS-08-T01`

## Task to Acceptance Criteria Traceability

| Acceptance criterion / BR                                    | Covered by tasks         | Evidence expected                            |
| ------------------------------------------------------------ | ------------------------ | -------------------------------------------- |
| AC1: Current-device logout revokes the current refresh token | CTMS-08-T01, CTMS-08-T02 | Unit + API/integration + UI/E2E              |
| AC2: Logout-all invalidates every active refresh token       | CTMS-08-T01, CTMS-08-T02 | Unit + API/integration + UI/E2E              |
| AC3: Revoked refresh token cannot refresh                    | CTMS-08-T01              | API/integration                              |
| AC4: Client clears local auth state                          | CTMS-08-T02              | UI Unit/Component + UI E2E                   |
| BR-023                                                       | CTMS-08-T01, CTMS-08-T02 | Current-session revoke evidence              |
| BR-200                                                       | CTMS-08-T01              | Audit-log Unit/Integration evidence          |
| BR-201                                                       | CTMS-08-T01, CTMS-08-T02 | JWT guard / unauthenticated request evidence |
| BR-204                                                       | CTMS-08-T01              | Cross-user refresh-token ownership test      |
| BR-205                                                       | CTMS-08-T01, CTMS-08-T02 | DTO validation + UI validation               |
| BR-207                                                       | CTMS-08-T01              | Transaction + rollback Unit evidence         |
| BR-209                                                       | CTMS-08-T01              | Repeated logout/idempotency evidence         |
| BR-231                                                       | CTMS-08-T01, CTMS-08-T02 | 401 / 422 error-mapping evidence             |
| BR-243                                                       | CTMS-08-T01              | No-side-effect authorization tests           |
| BR-244                                                       | CTMS-08-T01, CTMS-08-T02 | Spec + tests updated together                |

## Story-Specific Risks and Edge Cases

- A user must not be able to revoke a refresh token owned by another user.
- Current-device logout must not revoke another active session belonging to the same user.
- Logout-all must revoke only sessions belonging to the authenticated user.
- Repeated logout requests must be safe and must not create duplicate audit records.
- A revoked refresh token must be rejected by `/auth/refresh`.
- A missing or invalid access token must be rejected before business mutation.
- Missing `refreshToken` must fail validation without side effects.
- Audit failure must not leave a partially committed logout operation.
- Stateless access tokens may remain valid until expiry; this story revokes refresh-token sessions, not already-issued JWT access tokens.
- UI validation improves UX but never replaces backend authorization or ownership checks.

## Functional and Domain Requirements

- Implement the logout workflow within `EPIC 1. Authentication and User Management`.
- Support both current-device and all-device logout.
- Treat the current device as the session represented by the submitted refresh token.
- Require backend authentication before logout.
- Validate refresh-token ownership before any revoke operation.
- Revoke current/all refresh tokens according to `allDevices`.
- Reject revoked refresh tokens during refresh.
- Return consistent API responses and error codes.
- Write audit logs only when a revoke operation actually changes state.

## Data and Persistence Requirements

- `refresh_tokens` remains one row per refresh token/session.
- Relevant fields: `id`, `userId`, `tokenHash`, `expiresAt`, `revokedAt`, `createdAt`.
- Store only SHA-256 hashes of refresh tokens; never persist the raw token.
- Current-session lookup uses `SHA256(refreshToken)` plus ownership validation against the authenticated user.
- Current-device revoke uses `revokeIfActive(id, revokedAt)`.
- All-device revoke uses `revokeActiveTokensForUser(userId, revokedAt)`.
- Do not hard-delete refresh-token rows as part of logout.
- No schema migration is required for CTMS-08-T01.

## State and Audit Requirements

- An active refresh token has `revokedAt = null` and has not expired.
- Current-device logout marks the target refresh-token session revoked.
- All-device logout marks all active refresh-token rows belonging to the authenticated user revoked.
- Current-device logout audit action: `auth.logout`.
- All-device logout audit action: `auth.logout_all_devices`.
- Revoke + audit write execute inside the same transaction.
- If revoke affects zero rows during a repeated request, no duplicate audit record is written.

## File Structure Notes

Backend files belong under the authentication module:

- `services/api/src/modules/auth/dto/logout.dto.ts`
- `services/api/src/modules/auth/dto/logout-response.dto.ts`
- `services/api/src/modules/auth/auth.controller.ts`
- `services/api/src/modules/auth/auth.service.ts`
- `services/api/src/modules/auth/refresh-token.repository.ts`
- `services/api/src/modules/auth/auth.service.spec.ts`
- `services/api/test/auth.logout.integration-spec.ts`

Frontend implementation belongs to the owning auth feature folders in Web/Mobile and reuses the finalized API contract.

## Implementation Guidance for the Dev Agent

- Reuse existing authentication, refresh-token and audit patterns before adding abstractions.
- Reuse `revokeIfActive()` and `revokeActiveTokensForUser()`.
- Do not introduce a physical-device model solely for CTMS-08.
- Do not store raw refresh tokens.
- Do not revoke by token hash alone without confirming ownership.
- Keep revoke and audit behavior transactionally consistent.
- Keep repeated logout safe/idempotent.
- Do not mark the parent story Done until CTMS-08-T02 is also completed.

# Backend Preparation, Logic and Tests

## Actor

**Authenticated user**

The user may log out the refresh-token session on the current client or revoke every active refresh-token session belonging to their account.

## Preconditions

1. `POST /api/auth/logout` is protected by `JwtAuthGuard`.
2. The caller has a valid access token.
3. Request body contains a non-empty string `refreshToken`.
4. `allDevices` is optional and must be boolean when supplied.
5. The refresh token must exist and belong to the authenticated user before a revoke operation is allowed.

## API Contract

### Endpoint

```http
POST /api/auth/logout
Authorization: Bearer <accessToken>
Content-Type: application/json
```

### Current device request

```json
{
  "refreshToken": "<refresh-token>"
}
```

### All devices request

```json
{
  "refreshToken": "<refresh-token>",
  "allDevices": true
}
```

### Success

```http
200 OK
```

```json
{
  "loggedOut": true
}
```

### Errors

| Status | Condition                             |
| ------ | ------------------------------------- |
| 401    | Missing/invalid access token          |
| 401    | Refresh token not found               |
| 401    | Refresh token belongs to another user |
| 422    | Missing or invalid request data       |

## Data Mapping

| Input / Context            | Backend mapping       | Persistence                                    |
| -------------------------- | --------------------- | ---------------------------------------------- |
| Access-token identity      | `request.user.userId` | scopes logout to authenticated user            |
| `refreshToken`             | SHA-256 → `tokenHash` | matched against `refresh_tokens.token_hash`    |
| `allDevices` omitted/false | current session       | `revokeIfActive(existing.id, revokedAt)`       |
| `allDevices = true`        | all user sessions     | `revokeActiveTokensForUser(userId, revokedAt)` |
| Successful current revoke  | audit action          | `auth.logout`                                  |
| Successful revoke-all      | audit action          | `auth.logout_all_devices`                      |

## Main Flow - Current Device

1. Receive authenticated `POST /api/auth/logout`.
2. Validate `LogoutDto`.
3. Hash submitted refresh token.
4. Find matching refresh-token record.
5. Verify `existing.userId === authenticatedUserId`.
6. Start transaction.
7. Revoke only the matching active token via `revokeIfActive`.
8. If one row changed, write `auth.logout` audit log.
9. Commit transaction.
10. Return `{ loggedOut: true }`.
11. Subsequent `/auth/refresh` using that refresh token returns `401`.

## Main Flow - All Devices

1. Receive authenticated request with `allDevices: true`.
2. Hash and resolve the submitted refresh token.
3. Verify that token belongs to the authenticated user.
4. Start transaction.
5. Revoke every active refresh token for `authenticatedUserId`.
6. If state changed, write `auth.logout_all_devices` audit log.
7. Commit transaction.
8. Return `{ loggedOut: true }`.
9. Previously issued refresh tokens for that user can no longer refresh.

## Alternate Flows

### A1 - Same user has another active session

Current-device logout revokes only the submitted session. Other active refresh-token rows for that user remain usable.

### A2 - Repeated current-device logout

`revokeIfActive()` returns `0`; backend still returns `{ loggedOut: true }` and does not duplicate the audit log.

### A3 - Logout-all when no active tokens remain

The revoke operation may affect `0` rows. The request remains safe and must not generate duplicate side effects.

## Exception Flows

### E1 - No access token

- Return `401`.
- Do not run logout business mutation.

### E2 - Refresh token not found

- Return `401`.
- Do not open a transaction.
- Do not write audit.

### E3 - Refresh token belongs to another user

- Return `401`.
- Do not revoke the foreign session.
- Do not write audit.

### E4 - Invalid DTO

- Return `422`.
- Do not create any side effect.

### E5 - Audit write failure

- Propagate transaction failure.
- Revoke and audit must roll back together.

## Backend Test Cases

### Logic / Unit Tests

- **L-UT1:** Current-device logout calls `revokeIfActive` for exactly the submitted session.
- **L-UT2:** `allDevices: true` calls `revokeActiveTokensForUser`.
- **L-UT3:** Unknown refresh token returns `UnauthorizedException`.
- **L-UT4:** Foreign-user refresh token returns `UnauthorizedException`.
- **L-UT5:** Current-device logout writes `auth.logout`.
- **L-UT6:** Logout-all writes `auth.logout_all_devices`.
- **L-UT7:** Repeated current-device logout is idempotent.
- **L-UT8:** Zero-row revoke does not create a duplicate audit log.
- **L-UT9:** Revoke and audit execute within one transaction.
- **L-UT10:** Audit failure propagates so transaction rollback can occur.

### API / Integration Tests

- **L-E2E1:** Current-device logout revokes only current refresh token; another same-user session remains refreshable.
- **L-E2E2:** Logout-all revokes every active refresh token belonging to the user.
- **L-E2E3:** Another user's refresh token cannot be revoked.
- **L-E2E4:** Repeated logout is safe and does not duplicate audit logs.
- **L-E2E5:** Missing access token returns `401`.
- **L-E2E6:** Missing `refreshToken` returns `422`.
- **L-E2E7:** Revoked refresh token is rejected by `/auth/refresh`.

## Backend Test Evidence

### AuthService

```text
AuthService.logout
  10 tests passed
```

Full auth-service suite:

```text
Test Suites: 1 passed, 1 total
Tests:       80 passed, 80 total
```

### Logout integration

```text
Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
```

### Full backend unit regression

```text
Test Suites: 10 passed, 10 total
Tests:       129 passed, 129 total
Snapshots:   0 total
```

### Backend build

```text
pnpm --filter ./services/api build
nest build
PASS
```

# UI and Tests

## UI Responsibilities

1. Provide current-device logout.
2. Provide all-device logout where the product flow exposes the option.
3. Submit the current refresh token with the request.
4. Clear locally stored access token, refresh token and authenticated-user state after successful logout.
5. Redirect the user to Login after successful logout.
6. When refresh fails because a token has been revoked, clear local authentication state and redirect to Login.
7. Present loading and error states without treating client-side checks as authorization authority.

## UI Test Cases

- **UI-UT1:** Render logout actions and loading/error/success states correctly.
- **UI-UT2:** Current-device action sends `refreshToken` without `allDevices: true`.
- **UI-UT3:** Logout-all action sends `refreshToken` with `allDevices: true`.
- **UI-UT4:** Successful logout clears local authentication state.
- **UI-UT5:** Logout/refresh authentication errors redirect to Login appropriately.
- **UI-E2E1:** Complete current-device logout through the real API and verify local auth is cleared.
- **UI-E2E2:** Complete logout-all and verify previous sessions cannot refresh.
- **UI-E2E3:** Failure response does not create incorrect local/authenticated UI state.

## Testing Requirements

- Add Unit Tests for domain/business logic, validation, permission/ownership checks, transactions and idempotency.
- Add API/integration tests for success, invalid input, unauthenticated access, ownership failure and repeated requests.
- Add UI/component tests for rendering, validation, interaction, local-state clearing and error mapping.
- Add UI E2E coverage for current-device logout and logout-all.
- Keep test evidence attached to the Jira task before Done.

## Definition of Done

### CTMS-08-T01 / CTMS-28

- [x] Actor, preconditions, main/alternate/exception flows defined.
- [x] Business rules, validation rules, API contract and data mapping confirmed.
- [x] API/service/repository/authorization implemented.
- [x] Transaction, rollback and idempotency behavior implemented.
- [x] Current-device revoke covered.
- [x] Logout-all revoke covered.
- [x] Revoked token refresh rejection covered.
- [x] Unrelated session isolation covered.
- [x] Repeated logout safety covered.
- [x] Backend Unit Tests pass.
- [x] Backend API/integration tests pass.
- [x] Backend build passes.
- [x] Specification updated to reflect implementation.
- [x] Code review approved.
- [x] No Critical or High defects remain after review.
- [x] Test evidence attached to Jira.

### CTMS-08 Parent Story

- [x] CTMS-08-T01 completed.
- [x] CTMS-08-T02 completed.
- [x] All Acceptance Criteria pass end-to-end.
- [x] Story review approved.
- [x] No Critical or High defects remain.

## References

- Story ID: `CTMS-08`
- Jira story: `CTMS-8`
- Backend Jira subtask: `CTMS-28`
- Epic: `EPIC 1. Authentication and User Management`
- Dependency: `CTMS-03`
- Spec Reference: `/file/spec/ctms-08-log-out-from-current-device-or-all-devices.md`
