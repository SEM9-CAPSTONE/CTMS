# CTMS-09 - Store Important Health Information

**Spec Reference**  
/file/spec/ctms-09-store-important-health-information.md

**Story Title**  
Store Important Health Information

**Status**  
Done

**Story**  
As a user, I want to store Important Health Information so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [x] Only the Host or Porter for the related trip can view the information.
- [x] the user can edit or revoke sharing permission.

## Business Rules Checklist
- [x] BR-024: Logging out from all devices must revoke all active refresh tokens for the user.
- [x] BR-025: A Camper health profile may only be viewed by a Host or Porter associated with the related Trip when valid consent exists.
- [x] BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.
- [x] BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.
- [x] BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.
- [x] BR-216: Passwords, OTPs, access tokens, and refresh tokens must not be stored as plaintext; logs and API responses must not expose these values.
- [x] BR-217: Personal data and health data may only return the fields needed for the business purpose and only to authorized users.
- [x] BR-223: Audit logs are append-only; users and Admins must not edit or delete audit logs through normal business functions.
- [x] BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.
- [x] BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data.
- [x] BR-232: Error messages must be clear, actionable, and must not expose stack traces, secrets, or resources the user is not authorized to view.
- [x] BR-233: List APIs must support pagination and record limits; filtering and sorting may only use published fields.
- [x] BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.
- [x] BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.
- [x] BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.

## Dev Notes
- Jira status on 2026-08-04: `To Do`.
- Priority: `Should Have`; Story points: `5`; Commitment: `Stretch`.
- Epic: `EPIC 1. Authentication`.
- Sprint: `Sprint 1`; planned window: `2026-07-26` to `2026-08-08`.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks
- CTMS-09-T01 [BE / Shared Logic] Implement `Store Important Health Information` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-216, BR-217, BR-223, BR-232, BR-233, BR-024, BR-025, BR-206, BR-207. Ref: /file/spec/ctms-09-store-important-health-information.md#backend-preparation-logic-and-tests
- CTMS-09-T02 [UI Web/Mobile/Consumer] Implement `Store Important Health Information` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-240, BR-241, BR-242, BR-024, BR-025. Ref: /file/spec/ctms-09-store-important-health-information.md#ui-and-tests

## Task to Acceptance Criteria Traceability
| Acceptance criterion / BR | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: Only the Host or Porter for the related trip can view the information | CTMS-09-T01, CTMS-09-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC2: the user can edit or revoke sharing permission | CTMS-09-T01, CTMS-09-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. | CTMS-09-T01, CTMS-09-T02 | Tests and review evidence must prove this exact rule is enforced: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. |
| BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data. | CTMS-09-T01, CTMS-09-T02 | Tests and review evidence must prove this exact rule is enforced: Users may only view or change data they own unless their role and business relationship allow access to another user's data. |
| BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. | CTMS-09-T01, CTMS-09-T02 | Tests and review evidence must prove this exact rule is enforced: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. |
| BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. | CTMS-09-T01, CTMS-09-T02 | Tests and review evidence must prove this exact rule is enforced: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. |
| BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. | CTMS-09-T01, CTMS-09-T02 | Tests and review evidence must prove this exact rule is enforced: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. | CTMS-09-T01, CTMS-09-T02 | Tests and review evidence must prove this exact rule is enforced: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. |
| BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect. | CTMS-09-T01 | Tests and review evidence must prove this exact rule is enforced: Cases with insufficient permission or unmet business conditions must not create any side effect. |
| BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. | CTMS-09-T01 | Tests and review evidence must prove this exact rule is enforced: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. |
| BR-216: Passwords, OTPs, access tokens, and refresh tokens must not be stored as plaintext; logs and API responses must not expose these values. | CTMS-09-T01 | Tests and review evidence must prove this exact rule is enforced: Passwords, OTPs, access tokens, and refresh tokens must not be stored as plaintext; logs and API responses must not expose these values. |
| BR-217: Personal data and health data may only return the fields needed for the business purpose and only to authorized users. | CTMS-09-T01 | Tests and review evidence must prove this exact rule is enforced: Personal data and health data may only return the fields needed for the business purpose and only to authorized users. |
| BR-223: Audit logs are append-only; users and Admins must not edit or delete audit logs through normal business functions. | CTMS-09-T01 | Tests and review evidence must prove this exact rule is enforced: Audit logs are append-only; users and Admins must not edit or delete audit logs through normal business functions. |
| BR-232: Error messages must be clear, actionable, and must not expose stack traces, secrets, or resources the user is not authorized to view. | CTMS-09-T01 | Tests and review evidence must prove this exact rule is enforced: Error messages must be clear, actionable, and must not expose stack traces, secrets, or resources the user is not authorized to view. |
| BR-233: List APIs must support pagination and record limits; filtering and sorting may only use published fields. | CTMS-09-T01 | Tests and review evidence must prove this exact rule is enforced: List APIs must support pagination and record limits; filtering and sorting may only use published fields. |
| BR-024: Logging out from all devices must revoke all active refresh tokens for the user. | CTMS-09-T01, CTMS-09-T02 | Tests and review evidence must prove this exact rule is enforced: Logging out from all devices must revoke all active refresh tokens for the user. |
| BR-025: A Camper health profile may only be viewed by a Host or Porter associated with the related Trip when valid consent exists. | CTMS-09-T01, CTMS-09-T02 | Tests and review evidence must prove this exact rule is enforced: A Camper health profile may only be viewed by a Host or Porter associated with the related Trip when valid consent exists. |

## Backend Preparation, Logic, and Tests

### Actors

- Primary actor: authenticated Camper (User) with an active account.
- Supporting actors: authenticated Host or Porter associated with an active trip the camper is booked on.
- System actor: CTMS API with JWT authentication, TypeORM transactions, and audit logging.

### Preconditions

- The caller presents a valid Bearer access token issued by CTMS login.
- The token subject maps to an existing active user.
- For retrieving another camper's profile, the camper must have granted sharing consent (`isConsentGranted = true`), and the caller must be a Host or Porter associated with a Trip that the camper has booked.

### Main Flow

1. User requests their own health profile via `GET /api/camper/health-profile`.
2. If the health profile doesn't exist, the system creates a default profile with empty/default fields.
3. Camper updates their health profile details via `PUT /api/camper/health-profile` specifying the query parameter `version` for optimistic locking.
4. System validates inputs (blood type, physical fitness level, allergies, medical conditions, etc.).
5. System persists the updated health profile, increments the version, and writes a health profile update audit log in a transaction.

### Alternate Flows

- Granting consent via `POST /api/camper/health-profile/consent/grant` sets `is_consent_granted` to `true`, updates `consent_granted_at` and version, and writes audit log.
- Revoking consent via `POST /api/camper/health-profile/consent/revoke` sets `is_consent_granted` to `false`, updates `consent_revoked_at` and version, and writes audit log.
- Authorized Host or Porter retrieves a camper's profile via `GET /api/camper/health-profile/:userId`.

### Exception Flows

- Unauthenticated requests return HTTP 401.
- Inactive caller or inactive target camper account returns HTTP 403.
- Caller has no business relationship (not the owner, and not a Host/Porter of the camper's booked trip) returns HTTP 403.
- Camper has not granted consent (`isConsentGranted = false`) returns HTTP 403 for other users.
- Stale version number in `PUT` update request returns HTTP 409.
- Invalid input format or values returns HTTP 422.

### Business Rules and Validation Rules

- Only authenticated users may access the health profile API.
- Users may only read or update their own health profile through `/camper/health-profile`.
- `bloodType`: Enum value (`A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`, `UNKNOWN`).
- `physicalFitnessLevel`: Enum value (`BEGINNER`, `INTERMEDIATE`, `ADVANCED`, `EXPERT`).
- `dietaryRestrictions`: Max 300 characters.
- `emergencyNotes`: Max 500 characters.
- `allergies`: Array of items containing `id` (non-empty string), `name` (non-empty string, max 100), `severity` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), and optional `reaction` (max 200).
- `medicalConditions`: Array of items containing `id` (non-empty string), `name` (non-empty string, max 100), optional `medication` (max 200), and optional `notes` (max 300).
- `isConsentGranted`: Boolean.
- Auditing: All updates, consent grants, and consent revocations must write to append-only audit logs.

### API Contract

`GET /api/camper/health-profile`

- Auth: Bearer access token required.
- Success: HTTP 200 with `HealthProfileResponseDto`.
- Errors: 401 unauthenticated, 403 inactive account, 404 missing user.

`PUT /api/camper/health-profile?version={version}`

- Auth: Bearer access token required.
- Query Parameter: `version` (number).
- Body: `UpdateHealthProfileDto`.
- Success: HTTP 200 with `HealthProfileResponseDto`.
- Errors: 401 unauthenticated, 403 inactive account, 404 missing profile, 409 conflict (stale version), 422 invalid input.

`POST /api/camper/health-profile/consent/grant`

- Auth: Bearer access token required.
- Success: HTTP 200 with `HealthProfileResponseDto` (consent granted).
- Errors: 401 unauthenticated, 403 inactive account.

`POST /api/camper/health-profile/consent/revoke`

- Auth: Bearer access token required.
- Success: HTTP 200 with `HealthProfileResponseDto` (consent revoked).
- Errors: 401 unauthenticated, 403 inactive account.

`GET /api/camper/health-profile/:userId`

- Auth: Bearer access token required.
- Path Parameter: `userId` (string).
- Success: HTTP 200 with `HealthProfileResponseDto`.
- Errors: 401 unauthenticated, 403 access denied (no consent/relationship or inactive account), 404 missing profile.

### Data Mapping

- `bloodType` -> `health_profiles.blood_type`
- `physicalFitnessLevel` -> `health_profiles.physical_fitness_level`
- `dietaryRestrictions` -> `health_profiles.dietary_restrictions`
- `emergencyNotes` -> `health_profiles.emergency_notes`
- `allergies` -> `health_profiles.allergies`
- `medicalConditions` -> `health_profiles.medical_conditions`
- `isConsentGranted` -> `health_profiles.is_consent_granted`
- `consentGrantedAt` -> `health_profiles.consent_granted_at`
- `consentRevokedAt` -> `health_profiles.consent_revoked_at`
- `version` -> `health_profiles.version`

### Test Evidence for CTMS-09-T01

- All backend unit tests: `pnpm --filter @ctms/api test` -> passed.
- Backend lint: `npx biome check .` -> passed.

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped BR missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements
- Implement the `Store Important Health Information` workflow exactly within `EPIC 1. Authentication`.
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
- Story ID: `CTMS-09`
- Epic: `EPIC 1. Authentication`
- Sprint: `Sprint 1`
- Dependencies: `CTMS-07`
- Linked items: `Blocked by: CTMS-07

Blocks: None`
- Spec Reference: `/file/spec/ctms-09-store-important-health-information.md`
- Business Rules workbook: `C:/Users/admin/Downloads/CTMS_Global_Business_Rules_Sprint_1-3.xlsx`
- Story-level BRs: `BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-216, BR-217, BR-223, BR-232, BR-233, BR-024, BR-025`
