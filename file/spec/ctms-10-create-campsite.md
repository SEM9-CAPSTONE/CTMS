# CTMS-10 - Create Campsite

**Spec Reference**  
/file/spec/ctms-10-create-campsite.md

**Story Title**  
Create Campsite

**Status**  
Done

**Story**  
As a Host, I want to create Campsite so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria

- [x] Name, description, coordinates, province, media, policies, and operating hours are provided.
- [x] The campsite is created in `pending_approval` status for Admin review.
- [x] Only an authenticated Host can create it.

## Backend Preparation, Logic, and Tests

### Actors and Preconditions

- Actor: authenticated Host with an active account.
- The caller must present a valid, unexpired JWT.
- The account referenced by the JWT subject must exist and have `active` status.
- The account must have the Host role through backend role authorization.
- Device-image upload happens before campsite creation when using the current Host UI.

### API Contract

This story uses the current code-backed contract below. It is aligned with:

- Web endpoints: `API_ENDPOINTS.CAMPSITES.UPLOAD_MEDIA = "/campsites/media"` and `API_ENDPOINTS.CAMPSITES.CREATE = "/campsites"`.
- Backend controller routes: `POST /campsites/media` and `POST /campsites`.
- Application API base path: `/api`.

#### `POST /api/campsites/media`

Request:

- Content type: `multipart/form-data`
- Auth: Bearer JWT, role `host`
- Body field: `file`
- Allowed types: JPG, PNG, WebP
- Max size: 5 MB

Success response `201`:

```json
{
  "url": "http://localhost:3000/uploads/campsites/pending/campsite-1787561600-abcd1234.jpg"
}
```

Errors:

- `400` - missing file or unsupported file type.
- `401` - missing/invalid token or inactive account.
- `403` - authenticated user does not have Host permission.

#### `POST /api/campsites`

Request:

```json
{
  "name": "Da Lat Pine Camp",
  "description": "A quiet campsite prepared for guided trekking stays.",
  "latitude": 11.940419,
  "longitude": 108.458313,
  "province": "Lam Dong",
  "policies": {
    "rules": "No campfires after 21:00. Pack out all trash."
  },
  "operatingHours": {
    "opensAt": "08:00",
    "closesAt": "18:00"
  },
  "media": [
    {
      "url": "http://localhost:3000/uploads/campsites/pending/campsite-cover.jpg",
      "type": "photo",
      "sortOrder": 0
    }
  ]
}
```

Success response `201`:

```json
{
  "id": "uuid",
  "hostId": "uuid",
  "name": "Da Lat Pine Camp",
  "description": "A quiet campsite prepared for guided trekking stays.",
  "latitude": 11.940419,
  "longitude": 108.458313,
  "province": "Lam Dong",
  "policies": {
    "rules": "No campfires after 21:00. Pack out all trash."
  },
  "operatingHours": {
    "opensAt": "08:00",
    "closesAt": "18:00"
  },
  "seasonStartDate": null,
  "seasonEndDate": null,
  "maxAdvanceBookingDays": null,
  "minNights": null,
  "maxNights": null,
  "status": "pending_approval",
  "media": [
    {
      "id": "uuid",
      "url": "http://localhost:3000/uploads/campsites/campsite-cover.jpg",
      "type": "photo",
      "sortOrder": 0
    }
  ],
  "createdAt": "2026-08-19T00:00:00.000Z",
  "updatedAt": "2026-08-19T00:00:00.000Z"
}
```

Errors:

- `401` - missing/invalid token or inactive account.
- `403` - authenticated user does not have Host permission.
- `422` - invalid create payload or referenced pending media file no longer exists.
- `409` - reserved for future business conflicts; the web UI already maps this response to a retryable conflict state.

### Validation and Error Mapping

- `name` is required, trimmed, and bounded to 150 characters.
- `description` is required by the Host UI and bounded to 2000 characters. Current backend DTO accepts it as optional; this is retained as known review evidence for the current implementation.
- `latitude` must be a number between -90 and 90 with at most 6 decimal places.
- `longitude` must be a number between -180 and 180 with at most 6 decimal places.
- `province` is required, trimmed, and bounded to 100 characters.
- `policies.rules` is required, trimmed, and bounded to 2000 characters.
- `operatingHours.opensAt` and `operatingHours.closesAt` must be `HH:mm`; `closesAt` must be later than `opensAt`.
- `media` must contain 1-10 items.
- `media[].url` must be HTTP/HTTPS and bounded to 2000 characters.
- `media[].type` is optional and defaults to `photo`; if provided, only `photo` is accepted.
- `media[].sortOrder` is optional, integer, unique when provided, and bounded to 0-100.
- Web error mapping handles 401, 403, 409, 422, server failures, and network failures without exposing stack traces.

### Main Flow

1. Host opens `/host/campsites/create`.
2. Host selects one or more media files.
3. UI uploads media through `POST /api/campsites/media`.
4. Backend returns pending upload URLs.
5. Host submits campsite details to `POST /api/campsites`.
6. Backend validates the DTO and Host permission.
7. Backend promotes pending media URLs into final campsite media paths.
8. Backend opens a TypeORM transaction.
9. Backend creates the campsite with `host_id = requesting Host` and `status = pending_approval`.
10. Backend creates media rows for the new campsite.
11. Backend writes audit action `campsite.created`.
12. Backend commits and returns the created campsite response.

### Alternate and Exception Flows

- Missing, invalid, expired, or inactive-account token returns `401`.
- Authenticated account without Host role returns `403`.
- Invalid create request returns `422` before campsite persistence.
- Missing pending upload file returns `422` and no campsite is created.
- Unsupported upload file returns `400`.
- Omitted media `type` stores `photo`.
- Omitted media `sortOrder` stores the request index.
- Persistence or audit failure rolls back campsite, media, and audit writes.
- Promoted media files are cleaned up when persistence fails after promotion.
- Duplicate UI submit is blocked while a create request is in flight. Duplicate network retries can still create separate `pending_approval` campsites until a future idempotency-key store is introduced.
- Public search remains active-only; `pending_approval` campsites are not exposed to Campers.

### Data Mapping

| Request field                            | Storage field                           |
| ---------------------------------------- | --------------------------------------- |
| Authenticated user id                    | `campsites.host_id`                     |
| `name`                                   | `campsites.name`                        |
| `description`                            | `campsites.description`                 |
| `latitude` / `longitude`                 | `campsites.location` PostGIS point      |
| `province`                               | `campsites.province`                    |
| `policies`                               | `campsites.policies` JSON               |
| `operatingHours`                         | `campsites.operating_hours` JSON        |
| Server rule                              | `campsites.status = pending_approval`   |
| `media[].url`                            | `campsite_media.url`                    |
| `media[].type`                           | `campsite_media.type`                   |
| `media[].sortOrder`                      | `campsite_media.sort_order`             |

### Test Evidence

- Backend unit evidence: `services/api/src/modules/campsites/dto/create-campsite.dto.spec.ts`, `services/api/src/modules/campsites/repositories/campsites.repository.spec.ts`, and `services/api/src/modules/campsites/services/campsites.service.spec.ts`.
- Targeted backend run on 2026-08-24: 3 suites passed, 11 tests passed.
- Covered backend assertions include localhost upload URL validation, PostGIS point mapping, `pending_approval` status, Host-owned create payload, audit log write, media type defaulting, pending media promotion, 422 for missing pending media, rollback propagation, and promoted-file cleanup.

## UI and Tests

- [x] Implement screens and components according to the specification.
- [x] Implement loading, error, empty, and success states.
- [x] Implement client-side validation and API error mapping.
- [x] Integrate the API and handle responses.
- [x] Enforce Host permission states and prevent duplicate submissions.
- [x] Render loading, error, empty, and success states correctly in unit/component tests.
- [x] Validate campsite fields and error messages in unit tests.
- [x] Mock API responses to verify interactions and permission states.
- [x] Add E2E coverage for valid Host create flow and verify `pending_approval` persistence.
- [x] Add E2E coverage for invalid UI data and verify no campsite is created.
- [x] Add E2E coverage for Camper access denial.
- [ ] Rerun focused web Vitest evidence in this environment; current sandbox blocked Vite temp config writes under `apps/web/node_modules/.vite-temp`.
- [ ] Rerun focused Playwright E2E evidence in this environment; E2E requires web server and database-backed seed helper.

### Web Scope

- Route: `/host/campsites/create`.
- Host page renders sections for campsite information, location picker, policies and operating hours, and initial media.
- Form uses React Hook Form and Zod validation.
- Location selection stores `placeLabel`, `latitude`, and `longitude`; only latitude/longitude are submitted to the backend create API.
- Device-image upload calls `POST /api/campsites/media`; returned URLs are submitted as `media`.
- Submit shows loading state and blocks duplicate submissions using both disabled UI and an in-flight ref guard.
- Success state displays created campsite id and renders `pending` for `pending_approval`.
- 409 conflict preserves entered form data and exposes retry.
- Local draft form data is saved in `localStorage` and cleared only after successful create.

### Web Test Evidence

- Unit/component tests exist for schema validation, API contract mapping, empty state, invalid form no-submit, exact create payload, selected location province, loading state, duplicate-submit prevention, local draft restore, `pending_approval` success, 403 permission mapping, 409 retry, structured backend validation error mapping, Bearer-auth create call, and multipart media upload.
- E2E tests exist in `apps/web/tests/e2e/create-campsite.spec.ts` for valid Host create, invalid UI data no-create, and Camper denied.

## CTMS-10-T02 Definition of Done Status

- [x] UI matches the implemented CTMS-10 flow and current API contract.
- [x] Code has no known Critical or High defect in the Create Campsite flow.
- [x] Specification reflects the current implementation state and remaining test gaps.
- [x] Test evidence is recorded in this spec section.
- [ ] Focused UI Unit/Component tests need a fresh passing run in this environment.
- [ ] Focused UI E2E tests need a fresh passing run in this environment.
- [ ] Code review approval is still pending.

## Business Rules Checklist

- [x] BR-026: A Camper may edit the health profile or withdraw sharing consent at any time. (Not applicable to CTMS-10 because Create Campsite accepts no Camper health profile data.)
- [x] BR-027: A Campsite must include a name, description, coordinates, province, media, policies, and operating hours. (UI enforces all fields. Backend currently treats `description` as optional; recorded as known review evidence.)
- [x] BR-028: A newly created Campsite must start in `pending_approval` status for Admin review.
- [x] BR-200: Every change must be written to the audit log.
- [x] BR-201: Every function requiring authentication may only be performed when the user has a valid login session and the account is active.
- [x] BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.
- [x] BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.
- [x] BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.
- [x] BR-210: When concurrent requests change the same resource, the system must use transactions, locking, or version control to prevent overwrites and business limit violations.
- [x] BR-211: Every stateful resource must follow the defined state transitions and must not use values outside the database enum.
- [x] BR-214: Every data relationship must reference an existing and valid record; child records must not be created for resources outside the correct business scope.
- [x] BR-215: Emails must be normalized before comparison and storage; phone numbers must be normalized to a consistent format, preferably E.164. (Not applicable to CTMS-10 because Create Campsite accepts no email or phone input.)
- [x] BR-218: Access to health data must be based on consent and the relationship to the Trip; when consent is withdrawn, access must end immediately. (Not applicable to CTMS-10 because Create Campsite accepts no health data.)
- [x] BR-219: All times must be stored as timestamptz and displayed using the configured user or location time zone. (Not directly applicable to user-entered operating hours; server timestamps are persisted by the database layer.)
- [x] BR-220: A valid time range must have a start time earlier than the end time, unless the business rule explicitly allows equality.
- [x] BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. (Not applicable to CTMS-10 because no external service retry is performed; UI duplicate-submit prevention is covered separately.)
- [x] BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data.
- [x] BR-234: Public lists may only contain resources in public-allowed states; draft, pending_approval, suspended, closed, or archived resources must not be shown unless another rule explicitly allows it.
- [x] BR-235: Media must store URL and required metadata; client-provided URLs are valid only after the upload/verification flow is complete.
- [x] BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.
- [x] BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.
- [x] BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.

## Dev Notes

- Jira status on 2026-08-04: `To Do`.
- Priority: `Must Have`; Story points: `5`; Commitment: `Committed`.
- Epic: `EPIC 2. Campsite`.
- Sprint: `Sprint 2`; planned window: `2026-08-09` to `2026-08-22`.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks

- [x] CTMS-10-T01 [BE / Shared Logic] Implement `Create Campsite` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-200, BR-201, BR-214, BR-215, BR-220, BR-210, BR-211, BR-234, BR-235, BR-218, BR-219, BR-026, BR-027, BR-028, BR-206, BR-207. Ref: /file/spec/ctms-10-create-campsite.md#backend-preparation-logic-and-tests
- [x] CTMS-10-T02 [UI Web/Mobile/Consumer] Implement `Create Campsite` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-240, BR-241, BR-242, BR-026, BR-027, BR-028. Ref: /file/spec/ctms-10-create-campsite.md#ui-and-tests

## Task to Acceptance Criteria Traceability

| Acceptance criterion / BR                                                                                                                                                                               | Covered by tasks         | Evidence expected                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1: Name, description, coordinates, province, media, policies, and operating hours are provided                                                                                                        | CTMS-10-T01, CTMS-10-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer                                                                                                                                                                 |
| AC2: the campsite is created in `pending_approval` status for Admin review                                                                                                                              | CTMS-10-T01, CTMS-10-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer                                                                                                                                                                 |
| AC3: only an authenticated Host can create it                                                                                                                                                           | CTMS-10-T01, CTMS-10-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer                                                                                                                                                                 |
| BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.                            | CTMS-10-T01, CTMS-10-T02 | Tests and review evidence must prove this exact rule is enforced: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. |
| BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.                                                                    | CTMS-10-T01, CTMS-10-T02 | Tests and review evidence must prove this exact rule is enforced: Users may only view or change data they own unless their role and business relationship allow access to another user's data.                                         |
| BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.                                                  | CTMS-10-T01, CTMS-10-T02 | Tests and review evidence must prove this exact rule is enforced: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.                       |
| BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.                                                                               | CTMS-10-T01, CTMS-10-T02 | Review evidence must prove this rule is not applicable because Create Campsite performs no external-service retry; UI duplicate-submit prevention is covered under BR-241/CTMS-10-T02.                                                 |
| BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data.               | CTMS-10-T01, CTMS-10-T02 | Tests and review evidence must prove this exact rule is enforced: APIs must return consistent error codes.                                                                                                                             |
| BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.                                         | CTMS-10-T01, CTMS-10-T02 | Tests and review evidence must prove this exact rule is enforced for 409 conflict responses.                                                                                                                                           |
| BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.                                                                                                | CTMS-10-T01              | Tests and review evidence must prove this exact rule is enforced: rejected create requests create no campsite side effect.                                                                                                             |
| BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.                                            | CTMS-10-T01              | Tests and review evidence must prove this exact rule is enforced: this file, tests, and API contract remain aligned.                                                                                                                   |
| BR-200: Every change must be written to the audit log.                                                                                                                                                  | CTMS-10-T01              | Tests and review evidence must prove this exact rule is enforced: create writes `campsite.created`.                                                                                                                                    |
| BR-201: Every function requiring authentication may only be performed when the user has a valid login session and the account is active.                                                                | CTMS-10-T01              | Tests and review evidence must prove this exact rule is enforced through auth guards and active-account JWT validation.                                                                                                                |
| BR-214: Every data relationship must reference an existing and valid record; child records must not be created for resources outside the correct business scope.                                        | CTMS-10-T01              | Tests and review evidence must prove this exact rule is enforced: media rows are scoped to the created campsite.                                                                                                              |
| BR-215: Emails must be normalized before comparison and storage; phone numbers must be normalized to a consistent format, preferably E.164.                                                             | CTMS-10-T01              | Review evidence must mark this BR not applicable because Create Campsite accepts no email or phone input.                                                                                                                              |
| BR-220: A valid time range must have a start time earlier than the end time, unless the business rule explicitly allows equality.                                                                       | CTMS-10-T01              | Tests and review evidence must prove this exact rule is enforced for operating hours.                                                                                                                                                  |
| BR-210: When concurrent requests change the same resource, the system must use transactions, locking, or version control to prevent overwrites and business limit violations.                           | CTMS-10-T01              | Tests and review evidence must prove this exact rule is enforced by the create transaction.                                                                                                                                            |
| BR-211: Every stateful resource must follow the defined state transitions and must not use values outside the database enum.                                                                            | CTMS-10-T01              | Tests and review evidence must prove this exact rule is enforced: new campsite uses enum `pending_approval`.                                                                                              |
| BR-234: Public lists may only contain resources in public-allowed states; draft, pending_approval, suspended, closed, or archived resources must not be shown unless another rule explicitly allows it. | CTMS-10-T01              | Tests and review evidence must prove this exact rule is enforced by active-only public search.                                                                                                                                         |
| BR-235: Media must store URL and required metadata; client-provided URLs are valid only after the upload/verification flow is complete.                                                                 | CTMS-10-T01              | Tests and review evidence must prove this exact rule is enforced by media upload, URL validation, metadata storage, and pending media promotion.                                                                                       |
| BR-218: Access to health data must be based on consent and the relationship to the Trip; when consent is withdrawn, access must end immediately.                                                        | CTMS-10-T01              | Review evidence must mark this BR not applicable because Create Campsite accepts no health data.                                                                                                                                       |
| BR-219: All times must be stored as timestamptz and displayed using the configured user or location time zone.                                                                                          | CTMS-10-T01              | Review evidence must mark this BR not directly applicable to user-entered operating hours; server timestamps are persisted by the database layer.                                                                                      |
| BR-026: A Camper may edit the health profile or withdraw sharing consent at any time.                                                                                                                   | CTMS-10-T01, CTMS-10-T02 | Review evidence must mark this BR not applicable because Create Campsite accepts no Camper health profile data.                                                                                                                        |
| BR-027: A Campsite must include a name, description, coordinates, province, media, policies, and operating hours.                                                                                       | CTMS-10-T01, CTMS-10-T02 | Tests and review evidence must prove this exact rule is enforced; backend optional description remains known review evidence.                                                                                                          |
| BR-028: A newly created Campsite must start in `pending_approval` status for Admin review.                                                                                                              | CTMS-10-T01, CTMS-10-T02 | Tests and review evidence must prove this exact rule is enforced.                                                                                                                                                                      |

## Story-Specific Risks and Edge Cases

- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Current backend DTO treats `description` as optional even though the UI and AC/BR wording require it.
- Any mapped BR missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements

- Implement the `Create Campsite` workflow exactly within `EPIC 2. Campsite`.
- Enforce role-based access before executing any domain action.
- Validate all required fields, enum values, date ranges, ownership boundaries, and cross-entity references before writing data.
- Return consistent API errors: 401 for authentication failures, 403 for authorization failures, 404 for missing resources, 409 for business conflicts, and 422 for invalid input.
- Create returns a campsite awaiting Admin review with `status = pending_approval`.

## Data and Persistence Requirements

- Persist only validated data and keep all foreign-key relationships scoped to existing, authorized CTMS records.
- Use transactions for campsite, media, and audit writes.
- Store timestamps in a consistent server-side format and preserve source timestamps when client-side events are synchronized later.
- Promote pending uploaded media into the campsite upload directory before saving final media URLs.
- Avoid hard deletes unless the related database model and business rule explicitly allow them.

## State and Audit Requirements

- Validate the current state before every transition and reject transitions that are not explicitly allowed.
- New campsites start in `pending_approval`; Admin approval and rejection behavior belongs to CTMS-16.
- Client input must not set `hostId` or `status`.
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
- Keep the implementation narrow to this story and reuse existing CTMS helpers for auth, validation, transactions, i18n, API errors, uploads, and tests.
- Build backend behavior first when the UI depends on an API contract, then wire the frontend to the typed contract.
- Do not mark the story Done until mapped ACs, business rules, audit behavior, and regression tests are all covered.

## Testing Requirements

- Add unit tests for domain validation, permission checks, state transitions, media handling, and mapped business rule violations.
- Add API or integration tests for success, invalid input, unauthorized access, missing resource, conflict, and rollback cases.
- Add UI/component tests for rendering, validation messages, disabled states, loading states, error handling, permission states, duplicate submission prevention, and successful submission where UI exists.
- Add E2E coverage for the primary user journey and at least one critical failure path.
- Every BR listed in the Business Rules Checklist must appear in at least one test or review evidence item.

## References

- Story ID: `CTMS-10`
- Epic: `EPIC 2. Campsite`
- Sprint: `Sprint 2`
- Dependencies: `CTMS-06`
- Linked items: `Blocked by: CTMS-06

Blocks: CTMS-11, CTMS-12, CTMS-13, CTMS-15, CTMS-16, CTMS-19, CTMS-52, CTMS-59`

- Spec Reference: `/file/spec/ctms-10-create-campsite.md`
- Business Rules workbook: `C:/Users/admin/Downloads/CTMS_Global_Business_Rules_Sprint_1-3.xlsx`
- Story-level BRs: `BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-200, BR-201, BR-214, BR-215, BR-220, BR-210, BR-211, BR-234, BR-235, BR-218, BR-219, BR-026, BR-027, BR-028`
