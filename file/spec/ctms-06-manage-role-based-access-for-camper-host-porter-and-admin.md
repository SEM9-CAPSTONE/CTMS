# CTMS-06 - Manage Role-Based Access for Camper, Host, Porter, and Admin

**Spec Reference**  
/file/spec/ctms-06-manage-role-based-access-for-camper-host-porter-and-admin.md

**Story Title**  
Manage Role-Based Access for Camper, Host, Porter, and Admin

**Status**  
Implemented - pending full UI E2E cleanup and code review

**Story**  
As the system, I want to enforce role-based access for Camper, Host, Porter, and Admin so that users can access only authorized features.

## Acceptance Criteria

- [x] APIs enforce authorization on the backend.
- [x] users cannot access features outside their role.
- [x] unauthorized actions return 403.
- [x] One account may hold multiple valid roles without receiving permissions for roles that were not granted.
- [x] UI visibility is usability-only and never replaces backend authorization.

## Actors

- Camper: maintains their personal profile and camper health profile.
- Host: accesses host-scoped operations and consented camper health data only when a business relationship exists.
- Porter: accesses porter-scoped operations and consented camper health data only when assigned to the relevant trip.
- Admin: manages user accounts and admin-scoped operations.

## Preconditions

- The caller must present a valid, unexpired JWT for protected APIs.
- The account referenced by the JWT subject must exist and have `active` status.
- Granted roles are loaded from backend persistence, not trusted from request body, query string, route params, or JWT role claims.
- A protected endpoint must declare its allowed backend roles with the shared role authorization decorator.

## Main Flow

1. Client calls a protected API with a bearer token.
2. `JwtAuthGuard` authenticates the token and passes the subject to `JwtStrategy`.
3. `JwtStrategy` reloads the account and granted roles from the database.
4. `RolesGuard` compares the route's allowed roles with the granted database roles.
5. The service performs ownership, relationship, state, validation, and transaction checks before side effects.
6. The API returns success only after authorization and business validation pass.

## Alternate and Exception Flows

- Missing, invalid, expired, or inactive-account token returns `401`.
- Authenticated account without a required granted role returns `403`.
- Request manipulation such as adding `role`, `roles`, `status`, or `passwordHash` to protected payloads returns `422` or is ignored by whitelisted mapping before any side effect.
- A JWT containing a role not granted in `user_roles` does not grant that permission.
- Missing target records return `404`; invalid state transitions return `409`; invalid input returns `422`.

## Permission Matrix

| Backend API / operation                          | Camper      | Host        | Porter      | Admin       | Notes                                                                                              |
| ------------------------------------------------ | ----------- | ----------- | ----------- | ----------- | -------------------------------------------------------------------------------------------------- |
| `GET /api/profiles/me`                           | Allow       | Allow       | Allow       | Allow       | Any active granted role can view own profile.                                                      |
| `PATCH /api/profiles/me`                         | Allow       | Allow       | Allow       | Allow       | DTO whitelist prevents privilege escalation by profile payload.                                    |
| `GET /api/camper/health-profile`                 | Allow       | Deny        | Deny        | Deny        | Own camper health profile only.                                                                    |
| `PUT /api/camper/health-profile`                 | Allow       | Deny        | Deny        | Deny        | Own camper health profile only.                                                                    |
| `POST /api/camper/health-profile/consent/grant`  | Allow       | Deny        | Deny        | Deny        | Camper controls sharing consent.                                                                   |
| `POST /api/camper/health-profile/consent/revoke` | Allow       | Deny        | Deny        | Deny        | Camper controls sharing consent.                                                                   |
| `GET /api/camper/health-profile/:userId`         | Conditional | Conditional | Conditional | Conditional | Owner allowed; Host/Porter/Admin still require consent and business relationship where applicable. |
| `GET /api/users`                                 | Deny        | Deny        | Deny        | Allow       | Admin user-account management.                                                                     |
| `GET /api/users/:userId`                         | Deny        | Deny        | Deny        | Allow       | Admin user-account management.                                                                     |
| `PATCH /api/users/:userId/lock`                  | Deny        | Deny        | Deny        | Allow       | Service revalidates admin role and prevents self-lock.                                             |
| `PATCH /api/users/:userId/unlock`                | Deny        | Deny        | Deny        | Allow       | Service revalidates admin role.                                                                    |

## API and Data Mapping

- `users.role` remains the primary registration role for backward-compatible API responses and existing UI contracts.
- `user_roles(user_id, role, created_at)` is the source of truth for granted backend permissions.
- `user_roles` uses primary key `(user_id, role)` and `user_id` cascades on delete from `users`.
- Login and refresh responses sign JWT `roles` from `user_roles`, not from client input.
- `JwtStrategy` ignores JWT `roles` for authorization decisions and reconstructs `request.user.roles` from the database.
- Profile and user account responses expose both `role` and `roles`; `roles` reflects the granted role set.

## Backend Preparation, Logic, and Tests

- [x] Add `UserRoleAssignment` entity mapped to `user_roles`.
- [x] Add migration `1786500000000-CreateUserRolesTable` to create and backfill granted roles from existing `users.role`.
- [x] Add `@Roles(...)` decorator and `RolesGuard`; protected controllers must use `JwtAuthGuard` plus `RolesGuard`.
- [x] Enforce admin-only user management at both controller and service layer.
- [x] Enforce camper-only write access for own camper health profile APIs.
- [x] Unit evidence: `jwt.strategy.spec.ts`, `roles.guard.spec.ts`, `users.service.spec.ts`, `auth.service.spec.ts` (`85` tests passed).
- [x] API/E2E evidence: `auth.register.integration-spec.ts`, `users.admin.integration-spec.ts`, plus full API integration suite (`73` tests passed).

## UI and Tests

- [x] Add shared frontend permission helper for role normalization, `roles[]` fallback, and `hasAnyRole` checks.
- [x] Update `AppRoleGuard` to authorize against multiple granted roles, while retaining the legacy `currentRole` fallback during migration.
- [x] Protect `RoutePath.ADMIN_USERS` with `AppRoleGuard` and reuse `UnauthorizedPage` for client-side `403` access denial.
- [x] Update login success redirect to use `user.roles.includes("admin")` semantics instead of `user.role === "admin"`.
- [x] Persist the authenticated user profile in web storage so direct navigation and page reloads can evaluate granted UI roles.
- [x] Keep backend `403` handling separate from route visibility: admin user account APIs still map HTTP `403` to an authorization alert.
- [x] Update web auth/register/verify contracts and test fixtures to include `roles[]` returned by T01 API responses.
- [x] Add role dashboard UI for web `/dashboard` for Camper, Host, Porter, and Admin.
- [x] Web dashboard uses `roles[]` to switch available role views and `displayName` from `GET /profiles/me` / stored auth user.
- [x] Camper web dashboard reuses the shared Camper sidebar and supports profile navigation plus logout.
- [x] Web logged-in root navigation redirects `/` to `/dashboard`.
- [x] Update mobile auth user model and router to evaluate `roles[]`: Camper routes to camper shell, Porter routes to porter shell, Host/Admin-only accounts show an unsupported-mobile screen with logout.
- [x] Add Camper mobile profile/logout/date display updates that match the web profile behavior.
- [x] Add Porter mobile dashboard UI with greeting, KPI cards, current route, schedule, alerts, and quick actions.
- [x] Web unit/component evidence: `npm --prefix apps/web run test -- CamperProfilePage.test.tsx AppRoleGuard.test.tsx LoginPage.test.tsx` (`20` tests passed).
- [x] Web build evidence: `npm --prefix apps/web run build` passed.
- [x] Web E2E evidence for CTMS-06-T02 route authorization: `npm --prefix apps/web run test:e2e -- admin-user-accounts.spec.ts` (`3` tests passed).
- [x] Web audit-log targeted E2E regression after OTP-channel click fix: `npm --prefix apps/web run test:e2e -- tests/e2e/audit-logs.spec.ts --project=chromium` (`2` tests passed).
- [x] Mobile unit/widget evidence: `D:\src\flutter\bin\flutter.bat test` (`33` tests passed).
- [x] Mobile Porter UI focused evidence: `D:\src\flutter\bin\flutter.bat test test/widget_test.dart --plain-name "porter"` (`3` tests passed).
- [ ] Full web E2E suite evidence is not clean yet: latest `npm --prefix apps/web run test:e2e` produced `14` passed, `12` failed, `3` did not run. Failures are in real-backend auth/register/refresh/verify flows under full parallel Playwright execution, not the CTMS-06 route-guard focused suite.
- [ ] Mobile E2E test file is present (`apps/mobile/integration_test/app_test.dart`) and includes Porter dashboard coverage, but Chrome execution is blocked until `chromedriver --port=4444` is available; Android/emulator E2E still needs a recorded passing run.

## CTMS-06-T02 UI Scope Checklist

| Scope item                                                            | Status | Evidence / notes                                                                                                                                       |
| --------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Implement the screen and components according to the specification    | [x]    | Web role dashboards for Camper, Host, Porter, Admin; mobile Camper shell/profile and Porter dashboard.                                                 |
| Implement loading, error, empty, and success states                   | [x]    | Auth/register/verify/profile/admin flows preserve loading/error/success states; role dashboards render fallback data where APIs are not yet available. |
| Implement client-side validation and API error mapping                | [x]    | Auth/register/login/verify/profile validation and 401/403/409/422 mappings remain in place.                                                            |
| Integrate the API and handle responses                                | [x]    | Web dashboard/profile uses stored auth user and `GET /profiles/me`; admin user APIs map `403`; mobile auth/profile repositories handle API contracts.  |
| Enforce permission states and prevent repeated submissions or actions | [x]    | `AppRoleGuard`, mobile router, auth submit guards, register/login duplicate-submit tests.                                                              |
| Show features allowed for current roles                               | [x]    | Role-specific web dashboards and mobile Camper/Porter shells.                                                                                          |
| Hide or disable unauthorized actions                                  | [x]    | Admin routes guarded; mobile Host/Admin-only accounts route to unsupported-mobile screen.                                                              |
| Handle HTTP 403 consistently                                          | [x]    | `UnauthorizedPage` for route guard; admin API `403` shown as authorization alert.                                                                      |
| Support switching role-specific views when applicable                 | [x]    | Web `/dashboard` role switcher uses granted `roles[]`.                                                                                                 |
| Verify direct navigation cannot bypass UI restrictions                | [x]    | `admin-user-accounts.spec.ts` direct navigation non-admin test passes.                                                                                 |
| All UI Unit/Component Tests pass                                      | [x]    | Web focused component tests pass; mobile full widget/unit suite passes (`33` tests).                                                                   |
| All UI E2E Tests pass                                                 | [ ]    | CTMS-06 focused web E2E and audit targeted pass; full web real-backend E2E and mobile E2E still need clean full-suite evidence.                        |

## CTMS-06-T02 Definition of Done Status

- [x] The UI matches the approved CTMS-06 flow and T01 API contract for `role` + `roles[]`.
- [ ] Code review is approved.
- [x] No Critical or High defects are known in the CTMS-06 role-guard/dashboard implementation.
- [x] The specification reflects the final implementation state and remaining test gaps.
- [x] Test evidence is recorded in this spec section.
- [ ] Full UI E2E evidence is clean across web and mobile.

## Business Rules Checklist

- [x] BR-016: After a successful password reset, all existing login sessions for the account must be revoked.
- [x] BR-017: Every protected API must enforce access permission checks on the backend.
- [x] BR-018: Users must not access functions outside their role or assigned permission scope.
- [x] BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.
- [x] BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.
- [x] BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.
- [x] BR-229: When an external service times out or returns incomplete data, the system must record the error, must not assume success, and must not create unverifiable data.
- [x] BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.
- [x] BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data.
- [x] BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.
- [x] BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.
- [x] BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.

## Dev Notes

- Jira status on 2026-08-04: `To Do`.
- Priority: `Must Have`; Story points: `8`; Commitment: `Committed`.
- Epic: `EPIC 1. Authentication`.
- Sprint: `Sprint 1`; planned window: `2026-07-26` to `2026-08-08`.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks

- CTMS-06-T01 [BE / Shared Logic] Implement `Manage Role-Based Access for Camper, Host, Porter, and Admin` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-229, BR-016, BR-017, BR-018, BR-206, BR-207. Ref: /file/spec/ctms-06-manage-role-based-access-for-camper-host-porter-and-admin.md#backend-preparation-logic-and-tests
- CTMS-06-T02 [UI Web/Mobile/Consumer] Implement `Manage Role-Based Access for Camper, Host, Porter, and Admin` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-240, BR-241, BR-242, BR-016, BR-017, BR-018. Ref: /file/spec/ctms-06-manage-role-based-access-for-camper-host-porter-and-admin.md#ui-and-tests

## Task to Acceptance Criteria Traceability

| Acceptance criterion / BR                                                                                                                                                                 | Covered by tasks         | Evidence expected                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| AC1: APIs enforce authorization on the backend                                                                                                                                            | CTMS-06-T01, CTMS-06-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer                                                                                                                                                                              |
| AC2: users cannot access features outside their role                                                                                                                                      | CTMS-06-T01, CTMS-06-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer                                                                                                                                                                              |
| AC3: unauthorized actions return 403                                                                                                                                                      | CTMS-06-T01, CTMS-06-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer                                                                                                                                                                              |
| BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.              | CTMS-06-T01, CTMS-06-T02 | Tests and review evidence must prove this exact rule is enforced: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.              |
| BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.                                                      | CTMS-06-T01, CTMS-06-T02 | Tests and review evidence must prove this exact rule is enforced: Users may only view or change data they own unless their role and business relationship allow access to another user's data.                                                      |
| BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.                                    | CTMS-06-T01, CTMS-06-T02 | Tests and review evidence must prove this exact rule is enforced: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.                                    |
| BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.                                                                 | CTMS-06-T01, CTMS-06-T02 | Tests and review evidence must prove this exact rule is enforced: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.                                                                 |
| BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. | CTMS-06-T01, CTMS-06-T02 | Tests and review evidence must prove this exact rule is enforced: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.                           | CTMS-06-T01, CTMS-06-T02 | Tests and review evidence must prove this exact rule is enforced: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.                           |
| BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.                                                                                  | CTMS-06-T01              | Tests and review evidence must prove this exact rule is enforced: Cases with insufficient permission or unmet business conditions must not create any side effect.                                                                                  |
| BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.                              | CTMS-06-T01              | Tests and review evidence must prove this exact rule is enforced: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.                              |     |
| BR-229: When an external service times out or returns incomplete data, the system must record the error, must not assume success, and must not create unverifiable data.                  | CTMS-06-T01              | Tests and review evidence must prove this exact rule is enforced: When an external service times out or returns incomplete data, the system must record the error, must not assume success, and must not create unverifiable data.                  |
| BR-016: After a successful password reset, all existing login sessions for the account must be revoked.                                                                                   | CTMS-06-T01, CTMS-06-T02 | Tests and review evidence must prove this exact rule is enforced: After a successful password reset, all existing login sessions for the account must be revoked.                                                                                   |
| BR-017: Every protected API must enforce access permission checks on the backend.                                                                                                         | CTMS-06-T01, CTMS-06-T02 | Tests and review evidence must prove this exact rule is enforced: Every protected API must enforce access permission checks on the backend.                                                                                                         |
| BR-018: Users must not access functions outside their role or assigned permission scope.                                                                                                  | CTMS-06-T01, CTMS-06-T02 | Tests and review evidence must prove this exact rule is enforced: Users must not access functions outside their role or assigned permission scope.                                                                                                  |

## Story-Specific Risks and Edge Cases

- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped BR missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements

- Implement the `Manage Role-Based Access for Camper, Host, Porter, and Admin` workflow exactly within `EPIC 1. Authentication`.
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

- Story ID: `CTMS-06`
- Epic: `EPIC 1. Authentication`
- Sprint: `Sprint 1`
- Dependencies: `CTMS-03`
- Linked items: `Blocked by: CTMS-03

Blocks: CTMS-10, CTMS-16, CTMS-22, CTMS-30, CTMS-34, CTMS-52, CTMS-57, CTMS-59, CTMS-65, CTMS-91, CTMS-123, CTMS-124, CTMS-126`

- Spec Reference: `/file/spec/ctms-06-manage-role-based-access-for-camper-host-porter-and-admin.md`
- Business Rules workbook: `C:/Users/admin/Downloads/CTMS_Global_Business_Rules_Sprint_1-3.xlsx`
- Story-level BRs: `BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-229, BR-016, BR-017, BR-018`
