# CTMS-11 - Edit Campsite Information

**Spec Reference**  
/file/spec/ctms-11-edit-campsite-information.md

**Story Title**  
Edit Campsite Information

**Status**  
In progress

**Story**  
As a Host, I want to edit Campsite Information so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria

- [x] Only the Host who owns the campsite can edit it.
- [x] change history is saved.
- [x] updated data is visible to Campers.

## Business Rules Checklist

- [x] BR-029: Only a logged-in Host may create this resource.
- [x] BR-030: Only the Host who owns the campsite may edit it.
- [x] BR-031: The system must store change history.
- [x] BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.
- [x] BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.
- [x] BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.
- [x] BR-221: OTP TTL, token TTL, retry count, rate limit, booking hold duration, and retry deadline must be configurable and not hard-coded in logic.
- [x] BR-222: Important actions must be written to the audit log with actor, action, target, timestamp, before/after data, or change reason.
- [x] BR-223: Audit logs are append-only; users and Admins must not edit or delete audit logs through normal business functions.
- [x] BR-224: Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data.
- [x] BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.
- [x] BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data.
- [x] BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.
- [x] BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.
- [x] BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.

## Dev Notes

- Jira status on 2026-08-04: `To Do`.
- Priority: `Must Have`; Story points: `5`; Commitment: `Stretch`.
- Epic: `EPIC 2. Campsite`.
- Sprint: `Sprint 2`; planned window: `2026-08-09` to `2026-08-22`.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks

- [x] CTMS-11-T01 [BE / Shared Logic] Implement `Edit Campsite Information` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-221, BR-222, BR-223, BR-224, BR-029, BR-030, BR-031, BR-206, BR-207. Ref: /file/spec/ctms-11-edit-campsite-information.md#backend-preparation-logic-and-tests
- CTMS-11-T02 [UI Web/Mobile/Consumer] Implement `Edit Campsite Information` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-240, BR-241, BR-242, BR-029, BR-030, BR-031. Ref: /file/spec/ctms-11-edit-campsite-information.md#ui-and-tests

## Task to Acceptance Criteria Traceability

| Acceptance criterion / BR                                                                                                                                                                 | Covered by tasks         | Evidence expected                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1: Only the Host who owns the campsite can edit it                                                                                                                                      | CTMS-11-T01, CTMS-11-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer                                                                                                                                                                              |
| AC2: change history is saved                                                                                                                                                              | CTMS-11-T01, CTMS-11-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer                                                                                                                                                                              |
| AC3: updated data is visible to Campers                                                                                                                                                   | CTMS-11-T01, CTMS-11-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer                                                                                                                                                                              |
| BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.              | CTMS-11-T01, CTMS-11-T02 | Tests and review evidence must prove this exact rule is enforced: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.              |
| BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.                                                      | CTMS-11-T01, CTMS-11-T02 | Tests and review evidence must prove this exact rule is enforced: Users may only view or change data they own unless their role and business relationship allow access to another user's data.                                                      |
| BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.                                    | CTMS-11-T01, CTMS-11-T02 | Tests and review evidence must prove this exact rule is enforced: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.                                    |
| BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.                                                                 | CTMS-11-T01, CTMS-11-T02 | Tests and review evidence must prove this exact rule is enforced: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.                                                                 |
| BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. | CTMS-11-T01, CTMS-11-T02 | Tests and review evidence must prove this exact rule is enforced: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.                           | CTMS-11-T01, CTMS-11-T02 | Tests and review evidence must prove this exact rule is enforced: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.                           |
| BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.                                                                                  | CTMS-11-T01              | Tests and review evidence must prove this exact rule is enforced: Cases with insufficient permission or unmet business conditions must not create any side effect.                                                                                  |
| BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.                              | CTMS-11-T01              | Tests and review evidence must prove this exact rule is enforced: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.                              |
| BR-221: OTP TTL, token TTL, retry count, rate limit, booking hold duration, and retry deadline must be configurable and not hard-coded in logic.                                          | CTMS-11-T01              | Tests and review evidence must prove this exact rule is enforced: OTP TTL, token TTL, retry count, rate limit, booking hold duration, and retry deadline must be configurable and not hard-coded in logic.                                          |
| BR-222: Important actions must be written to the audit log with actor, action, target, timestamp, before/after data, or change reason.                                                    | CTMS-11-T01              | Tests and review evidence must prove this exact rule is enforced: Important actions must be written to the audit log with actor, action, target, timestamp, before/after data, or change reason.                                                    |
| BR-223: Audit logs are append-only; users and Admins must not edit or delete audit logs through normal business functions.                                                                | CTMS-11-T01              | Tests and review evidence must prove this exact rule is enforced: Audit logs are append-only; users and Admins must not edit or delete audit logs through normal business functions.                                                                |
| BR-224: Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data.                                                                          | CTMS-11-T01              | Tests and review evidence must prove this exact rule is enforced: Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data.                                                                          |
| BR-029: Only a logged-in Host may create this resource.                                                                                                                                   | CTMS-11-T01, CTMS-11-T02 | Tests and review evidence must prove this exact rule is enforced: Only a logged-in Host may create this resource.                                                                                                                                   |
| BR-030: Only the Host who owns the campsite may edit it.                                                                                                                                  | CTMS-11-T01, CTMS-11-T02 | Tests and review evidence must prove this exact rule is enforced: Only the Host who owns the campsite may edit it.                                                                                                                                  |
| BR-031: The system must store change history.                                                                                                                                             | CTMS-11-T01, CTMS-11-T02 | Tests and review evidence must prove this exact rule is enforced: The system must store change history.                                                                                                                                             |

## Story-Specific Risks and Edge Cases

- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped BR missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements

- Implement the `Edit Campsite Information` workflow exactly within `EPIC 2. Campsite`.
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

## Backend Preparation, Logic, and Tests

### Actors

- Primary actor: authenticated Host with an active account.
- Secondary actor: Camper viewing active campsite public information after the Host update.
- Supporting system actor: audit log writer inside the same database transaction as the campsite update.

### Preconditions

- The requester has a valid JWT and the account status is `active`.
- The requester has the `host` role.
- The campsite exists.
- The campsite `host_id` matches the authenticated Host id.
- If `expectedUpdatedAt` is supplied, it must match the current campsite `updated_at` value.

### Main Flow

1. Host sends `PATCH /api/campsites/{id}` with one or more editable campsite fields.
2. Backend validates scalar fields, nested media, nested zones, URL formats, location bounds, text lengths, operating-hour order, and media sort order.
3. Backend starts a transaction and locks the target campsite row for update.
4. Backend verifies the campsite exists and is owned by the authenticated Host.
5. Backend rejects stale edits when `expectedUpdatedAt` does not match the locked row.
6. Backend persists changed campsite fields; if media or zones are supplied, the supplied list replaces the existing list.
7. Backend writes an append-only `campsite.updated` audit log with actor, target, before snapshot, after snapshot, and reason.
8. Backend returns the updated campsite response.
9. If the campsite remains `active`, the updated public fields are returned to Campers through campsite search.

### Alternate Flows

- Host may update a subset of editable fields.
- `changeReason` is optional; backend defaults it to `host_edit_campsite`.
- Media and zones are unchanged when their arrays are omitted.
- If the request is a no-op after normalization, the response is returned without adding a duplicate audit log.

### Exception Flows

- Missing or invalid authentication returns `401`.
- Authenticated non-Host roles return `403`.
- Active Host editing another Host's campsite returns `403` and creates no side effect.
- Missing campsite returns `404`.
- Invalid payload returns `422` and creates no side effect.
- Stale `expectedUpdatedAt` returns `409` and rolls back all attempted changes.

### Business Rules

- BR-202 is enforced by JWT validation, which rejects non-active accounts.
- BR-204 and BR-030 are enforced by owner verification inside the update transaction.
- BR-205 is enforced by DTO validation and service cross-field validation for latitude/longitude.
- BR-031, BR-222, BR-223, and BR-224 are enforced through append-only audit log creation with campsite-only before/after snapshots.
- BR-230 is handled by transaction rollback and no duplicate audit log on no-op retry.
- BR-231 maps backend errors to `401`, `403`, `404`, `409`, and `422`.
- BR-242 is supported by `expectedUpdatedAt` conflict detection so clients can preserve entered data and ask the user to reload or retry.
- BR-243 is enforced by validating permission and stale state before persistence/audit writes.

### API Contract

- Method/path: `PATCH /api/campsites/{id}`
- Authorization: Bearer JWT; required role `host`.
- Path params: `id` as UUID.
- Request body: partial campsite fields from create campsite plus optional `expectedUpdatedAt` ISO timestamp and optional `changeReason`.
- Editable fields: `name`, `description`, `latitude`, `longitude`, `province`, `policies`, `operatingHours`, `seasonStartDate`, `seasonEndDate`, `maxAdvanceBookingDays`, `minNights`, `maxNights`, `media`, `zones`.
- Response `200`: `CampsiteResponseDto` with campsite, coordinates, media, zones, status, timestamps.
- Error responses: `401`, `403`, `404`, `409`, `422`.

### Data Mapping

- `latitude` and `longitude` map to the PostGIS geography `location` point as `[longitude, latitude]`.
- `policies` and `operatingHours` map to jsonb columns.
- `media` maps to `campsite_media`; provided media replaces existing media in the transaction.
- `zones` maps to `campsite_zones`; provided zones replace existing zones in the transaction and default to active.
- Audit log uses `action = campsite.updated`, `target_type = campsite`, target id as campsite id, and before/after snapshots of public campsite data only.

### Test Evidence

- Implementation checklist:
  - [x] Define actors, preconditions, main flow, alternate flows, and exception flows.
  - [x] Confirm business rules, validation rules, API contract, and data mapping.
  - [x] Implement API, service, repository, and backend authorization.
  - [x] Implement validation, transaction handling, rollback, and idempotency where applicable.
- Unit test checklist:
  - [x] Verify: Only the owning Host can edit the campsite.
  - [x] Verify: Valid changes are persisted and change history is recorded.
  - [x] Verify: Updated public information is visible to Campers when the campsite is active.
  - [x] Verify validation, permission, and error branches.
- E2E/API test checklist:
  - [x] Complete the happy path from request through persistence or external integration to response.
  - [x] Complete an invalid-data flow and verify no unintended side effects.
  - [x] Complete an unauthorized flow and verify the correct error response.
  - [x] Verify rollback, retry, or idempotency behavior where applicable.
- Unit tests: `services/api/src/modules/campsites/services/campsites.service.spec.ts`.
- API/E2E tests: `services/api/test/campsites.update.integration-spec.ts`.
- Covered paths: owner success, audit history, active-campsite Camper visibility, invalid payload rollback, non-owner rejection, stale retry conflict, and no side effects for rejected flows.

## References

- Story ID: `CTMS-11`
- Epic: `EPIC 2. Campsite`
- Sprint: `Sprint 2`
- Dependencies: `CTMS-10`
- Linked items: `Blocked by: CTMS-10

Blocks: None`

- Spec Reference: `/file/spec/ctms-11-edit-campsite-information.md`
- Business Rules workbook: `C:/Users/admin/Downloads/CTMS_Global_Business_Rules_Sprint_1-3.xlsx`
- Story-level BRs: `BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-221, BR-222, BR-223, BR-224, BR-029, BR-030, BR-031`
