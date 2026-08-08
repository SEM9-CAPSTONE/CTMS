# CTMS-07 - Update Personal Profile and Emergency Contact

**Spec Reference**  
/file/spec/ctms-07-update-personal-profile-and-emergency-contact.md

**Story Title**  
Update Personal Profile and Emergency Contact

**Status**  
In Progress

**Story**  
As a user, I want to update Personal Profile and Emergency Contact so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria

- [x] Valid profile information is updated successfully by the authenticated backend API.
- [x] Emergency contacts are saved by the authenticated backend API.
- [x] Access to sensitive data is permission-checked by authentication, active-account checks, owner-only routing, DTO whitelisting, and response mapping.

## Business Rules Checklist

- [x] BR-019: Authenticated actions without sufficient permission must return HTTP 403 and must not create side effects.
- [x] BR-020: Personal profile information may only be updated when the submitted data is valid.
- [x] BR-021: Each account may store at most two emergency contacts using the required structure.
- [x] BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.
- [x] BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.
- [x] BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.
- [x] BR-216: Passwords, OTPs, access tokens, and refresh tokens must not be stored as plaintext; logs and API responses must not expose these values.
- [x] BR-217: Personal data and health data may only return the fields needed for the business purpose and only to authorized users.
- [x] BR-223: Audit logs are append-only; users and Admins must not edit or delete audit logs through normal business functions.
- [x] BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.
- [x] BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, and 422 for invalid data.
- [x] BR-242: Backend rejection responses preserve request data client-side by returning structured errors without partial writes; UI retry/reload handling remains CTMS-07-T02.
- [x] BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.
- [x] BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.

## Dev Notes

- Jira status on 2026-08-04: `To Do`.
- Priority: `Must Have`; Story points: `5`; Commitment: `Committed`.
- Epic: `EPIC 1. Authentication`.
- Sprint: `Sprint 1`; planned window: `2026-07-26` to `2026-08-08`.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks

- [x] CTMS-07-T01 [BE / Shared Logic] Implement `Update Personal Profile and Emergency Contact` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-216, BR-217, BR-223, BR-019, BR-020, BR-021, BR-206, BR-207. Ref: /file/spec/ctms-07-update-personal-profile-and-emergency-contact.md#backend-preparation-logic-and-tests
- CTMS-07-T02 [UI Web/Mobile/Consumer] Implement `Update Personal Profile and Emergency Contact` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-240, BR-241, BR-242, BR-019, BR-020, BR-021. Ref: /file/spec/ctms-07-update-personal-profile-and-emergency-contact.md#ui-and-tests

## Task to Acceptance Criteria Traceability

| Acceptance criterion / BR                                                                                                                                                                 | Covered by tasks         | Evidence expected                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1: Valid profile information is updated successfully                                                                                                                                    | CTMS-07-T01, CTMS-07-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer                                                                                                                                                                              |
| AC2: emergency contacts are saved                                                                                                                                                         | CTMS-07-T01, CTMS-07-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer                                                                                                                                                                              |
| AC3: access to sensitive data is permission-checked                                                                                                                                       | CTMS-07-T01, CTMS-07-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer                                                                                                                                                                              |
| BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.              | CTMS-07-T01, CTMS-07-T02 | Tests and review evidence must prove this exact rule is enforced: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.              |
| BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.                                                      | CTMS-07-T01, CTMS-07-T02 | Tests and review evidence must prove this exact rule is enforced: Users may only view or change data they own unless their role and business relationship allow access to another user's data.                                                      |
| BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.                                    | CTMS-07-T01, CTMS-07-T02 | Tests and review evidence must prove this exact rule is enforced: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.                                    |
| BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.                                                                 | CTMS-07-T01, CTMS-07-T02 | Tests and review evidence must prove this exact rule is enforced: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.                                                                 |
| BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. | CTMS-07-T01, CTMS-07-T02 | Tests and review evidence must prove this exact rule is enforced: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.                           | CTMS-07-T01, CTMS-07-T02 | Tests and review evidence must prove this exact rule is enforced: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.                           |
| BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.                                                                                  | CTMS-07-T01              | Tests and review evidence must prove this exact rule is enforced: Cases with insufficient permission or unmet business conditions must not create any side effect.                                                                                  |
| BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.                              | CTMS-07-T01              | Tests and review evidence must prove this exact rule is enforced: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.                              |
| BR-216: Passwords, OTPs, access tokens, and refresh tokens must not be stored as plaintext; logs and API responses must not expose these values.                                          | CTMS-07-T01              | Tests and review evidence must prove this exact rule is enforced: Passwords, OTPs, access tokens, and refresh tokens must not be stored as plaintext; logs and API responses must not expose these values.                                          |
| BR-217: Personal data and health data may only return the fields needed for the business purpose and only to authorized users.                                                            | CTMS-07-T01              | Tests and review evidence must prove this exact rule is enforced: Personal data and health data may only return the fields needed for the business purpose and only to authorized users.                                                            |
| BR-223: Audit logs are append-only; users and Admins must not edit or delete audit logs through normal business functions.                                                                | CTMS-07-T01              | Tests and review evidence must prove this exact rule is enforced: Audit logs are append-only; users and Admins must not edit or delete audit logs through normal business functions.                                                                |
| BR-019: Authenticated actions without sufficient permission must return HTTP 403 and must not create side effects.                                                                        | CTMS-07-T01, CTMS-07-T02 | Tests and review evidence must prove this exact rule is enforced: Authenticated actions without sufficient permission must return HTTP 403 and must not create side effects.                                                                        |
| BR-020: Personal profile information may only be updated when the submitted data is valid.                                                                                                | CTMS-07-T01, CTMS-07-T02 | Tests and review evidence must prove this exact rule is enforced: Personal profile information may only be updated when the submitted data is valid.                                                                                                |
| BR-021: Each account may store at most two emergency contacts using the required structure.                                                                                               | CTMS-07-T01, CTMS-07-T02 | Tests and review evidence must prove this exact rule is enforced: Each account may store at most two emergency contacts using the required structure.                                                                                               |

## Backend Preparation, Logic, and Tests

### Actors

- Primary actor: authenticated CTMS user with an active account.
- Supporting system actor: CTMS API using JWT authentication and TypeORM transactions.
- Out-of-scope actor for CTMS-07-T01: Admin-managed profile updates for another user. The implemented route is owner-only.

### Preconditions

- The caller presents a valid Bearer access token issued by CTMS login.
- The token subject maps to an existing `users.id`.
- The user status is `active`.
- Request payload passes backend validation and contains only allowed profile/contact fields.

### Main Flow

1. User calls `GET /api/profiles/me` to retrieve the current personal profile and emergency contacts.
2. User calls `PATCH /api/profiles/me` with profile fields, emergency contacts, or both.
3. API authenticates the access token with `JwtAuthGuard`.
4. Service loads the token subject as the owner; no request body or path field can select another user.
5. Service rejects non-active accounts before writes.
6. Service updates allowed user profile columns and, when `emergencyContacts` is present, atomically replaces the user's emergency-contact list.
7. Service writes an append-only `profile.updated` audit log when the submitted state changes persisted profile/contact data.
8. API returns the mapped profile response without password hashes, OTPs, refresh tokens, or other sensitive fields.

### Alternate Flows

- Payload contains only personal profile fields: update only `users.full_name`, `users.date_of_birth`, `users.gender`, `users.address`, and/or `users.bio`.
- Payload contains only `emergencyContacts`: replace only that user's emergency-contact list.
- Payload contains an empty `emergencyContacts` array: remove all emergency contacts for the authenticated user.
- Retried identical emergency-contact request: replaces the list with the same final state and does not create duplicate contacts.
- Submitted state is unchanged: API returns the current profile and skips the audit write.

### Exception Flows

- Missing or invalid Bearer token returns HTTP 401 and creates no side effects.
- Token subject does not map to a user returns HTTP 404 and creates no side effects.
- `pending_verification`, `suspended`, or `deleted` account returns HTTP 403 and creates no side effects.
- Invalid field formats, enum values, lengths, more than two emergency contacts, or non-whitelisted fields return HTTP 422 and create no side effects.
- Future `dateOfBirth` returns HTTP 403 and opens no transaction.

### Business Rules and Validation Rules

- Only authenticated users may access the profile API.
- Users may only read or update their own profile through `/profiles/me`.
- Personal profile fields are limited to: `fullName`, `dateOfBirth`, `gender`, `address`, `bio`.
- Sensitive and administrative fields such as `role`, `status`, `passwordHash`, token fields, and user identifiers are not accepted for update.
- `fullName`: optional string, 2-50 characters.
- `dateOfBirth`: optional ISO date string; must not be in the future.
- `gender`: optional enum: `male`, `female`, `other`.
- `address`: optional string, 5-200 characters.
- `bio`: optional string, maximum 500 characters.
- `emergencyContacts`: optional array, maximum 2 contacts.
- Emergency contact fields: `name` 2-80 characters, `relationship` 2-40 characters, Vietnamese mobile `phone`, optional normalized email up to 254 characters.
- Multi-record profile/contact writes run in a TypeORM transaction and roll back together on errors.

### API Contract

`GET /api/profiles/me`

- Auth: Bearer access token required.
- Success: HTTP 200 with `ProfileResponseDto`.
- Errors: 401 unauthenticated, 403 inactive account, 404 missing user.

`PATCH /api/profiles/me`

- Auth: Bearer access token required.
- Body: `UpdateProfileDto`.
- Success: HTTP 200 with `ProfileResponseDto`.
- Errors: 401 unauthenticated, 403 inactive account or future date of birth, 404 missing user, 422 invalid input or mass-assignment attempt.

Example request:

```json
{
  "fullName": "Nguyen Van B",
  "dateOfBirth": "1995-04-12",
  "gender": "male",
  "address": "Da Lat, Lam Dong",
  "bio": "Weekend trekker",
  "emergencyContacts": [
    {
      "name": "Tran Thi C",
      "relationship": "mother",
      "phone": "0911111111",
      "email": "mom@example.com"
    }
  ]
}
```

Example response:

```json
{
  "id": "user-uuid",
  "email": "camper@example.com",
  "phone": "+84912345678",
  "role": "camper",
  "status": "active",
  "fullName": "Nguyen Van B",
  "dateOfBirth": "1995-04-12",
  "gender": "male",
  "address": "Da Lat, Lam Dong",
  "bio": "Weekend trekker",
  "emergencyContacts": [
    {
      "id": "contact-uuid",
      "name": "Tran Thi C",
      "relationship": "mother",
      "phone": "+84911111111",
      "email": "mom@example.com"
    }
  ],
  "createdAt": "2026-08-09T00:00:00.000Z",
  "updatedAt": "2026-08-09T00:00:00.000Z"
}
```

### Data Mapping

- `UpdateProfileDto.fullName` -> `users.full_name`.
- `UpdateProfileDto.dateOfBirth` -> `users.date_of_birth`.
- `UpdateProfileDto.gender` -> `users.gender`.
- `UpdateProfileDto.address` -> `users.address`.
- `UpdateProfileDto.bio` -> `users.bio`.
- `UpdateProfileDto.emergencyContacts[]` -> rows in `emergency_contacts` owned by `user_id`.
- Emergency contact local Vietnamese phone numbers are normalized to E.164 before persistence.
- API response uses explicit DTO mapping and never returns `users.password_hash`.
- Audit entry: `audit_logs.action = profile.updated`, `target_type = user`, `target_id = users.id`, `before` and `after` contain profile/contact snapshots.

### Test Evidence for CTMS-07-T01

- Unit: `pnpm --filter @ctms/api test -- profiles.service.spec.ts` -> 9 passed.
- Backend build: `pnpm --filter @ctms/api build` -> passed.
- API/E2E: `pnpm --filter @ctms/api test:integration -- profiles.me.integration-spec.ts` -> 7 passed.
- All backend unit tests: `pnpm --filter @ctms/api test` -> 72 passed.
- All backend API/integration tests: `pnpm --filter @ctms/api test:integration` -> 49 passed.
- Backend lint: `pnpm --filter @ctms/api lint` -> passed.

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
