# CTMS-10 - Create Campsite

**Spec Reference**  
/file/spec/ctms-10-create-campsite.md

**Story Title**  
Create Campsite

**Status**  
To Do

**Story**  
As a Host, I want to create Campsite so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [ ] Name, description, coordinates, province/city, images, policies, and operating hours are provided.
- [ ] the campsite is created in Draft status.
- [ ] only an authenticated Host can create it.

## Business Rules Checklist
- [ ] BR-026: A Camper may edit the health profile or withdraw sharing consent at any time.
- [ ] BR-027: A Campsite must include a name, description, coordinates, province/city, images, policies, and operating hours.
- [ ] BR-028: A newly created Campsite must start in Draft status.
- [ ] BR-200: Every change must be written to the audit log.
- [ ] BR-201: Every function requiring authentication may only be performed when the user has a valid login session and the account is active.
- [ ] BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.
- [ ] BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.
- [ ] BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.
- [ ] BR-210: When concurrent requests change the same resource, the system must use transactions, locking, or version control to prevent overwrites and business limit violations.
- [ ] BR-211: Every stateful resource must follow the defined state transitions and must not use values outside the database enum.
- [ ] BR-214: Every data relationship must reference an existing and valid record; child records must not be created for resources outside the correct business scope.
- [ ] BR-215: Emails must be normalized before comparison and storage; phone numbers must be normalized to a consistent format, preferably E.164.
- [ ] BR-218: Access to health data must be based on consent and the relationship to the Trip; when consent is withdrawn, access must end immediately.
- [ ] BR-219: All times must be stored as timestamptz and displayed using the configured user or location time zone.
- [ ] BR-220: A valid time range must have a start time earlier than the end time, unless the business rule explicitly allows equality.
- [ ] BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.
- [ ] BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data.
- [ ] BR-234: Public lists may only contain resources in public-allowed states; draft, suspended, closed, or archived resources must not be shown unless another rule explicitly allows it.
- [ ] BR-235: Media must store URL and required metadata; client-provided URLs are valid only after the upload/verification flow is complete.
- [ ] BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.
- [ ] BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.
- [ ] BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.

## Dev Notes
- Jira status on 2026-08-04: `To Do`.
- Priority: `Must Have`; Story points: `5`; Commitment: `Committed`.
- Epic: `EPIC 2. Campsite`.
- Sprint: `Sprint 2`; planned window: `2026-08-09` to `2026-08-22`.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks
- CTMS-10-T01 [BE / Shared Logic] Implement `Create Campsite` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-200, BR-201, BR-214, BR-215, BR-220, BR-210, BR-211, BR-234, BR-235, BR-218, BR-219, BR-026, BR-027, BR-028, BR-206, BR-207. Ref: /file/spec/ctms-10-create-campsite.md#backend-preparation-logic-and-tests
- CTMS-10-T02 [UI Web/Mobile/Consumer] Implement `Create Campsite` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-240, BR-241, BR-242, BR-026, BR-027, BR-028. Ref: /file/spec/ctms-10-create-campsite.md#ui-and-tests

## Task to Acceptance Criteria Traceability
| Acceptance criterion / BR | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: Name, description, coordinates, province/city, images, policies, and operating hours are provided | CTMS-10-T01, CTMS-10-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC2: the campsite is created in Draft status | CTMS-10-T01, CTMS-10-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC3: only an authenticated Host can create it | CTMS-10-T01, CTMS-10-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. | CTMS-10-T01, CTMS-10-T02 | Tests and review evidence must prove this exact rule is enforced: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. |
| BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data. | CTMS-10-T01, CTMS-10-T02 | Tests and review evidence must prove this exact rule is enforced: Users may only view or change data they own unless their role and business relationship allow access to another user's data. |
| BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. | CTMS-10-T01, CTMS-10-T02 | Tests and review evidence must prove this exact rule is enforced: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. |
| BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. | CTMS-10-T01, CTMS-10-T02 | Tests and review evidence must prove this exact rule is enforced: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. |
| BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. | CTMS-10-T01, CTMS-10-T02 | Tests and review evidence must prove this exact rule is enforced: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. | CTMS-10-T01, CTMS-10-T02 | Tests and review evidence must prove this exact rule is enforced: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. |
| BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect. | CTMS-10-T01 | Tests and review evidence must prove this exact rule is enforced: Cases with insufficient permission or unmet business conditions must not create any side effect. |
| BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. | CTMS-10-T01 | Tests and review evidence must prove this exact rule is enforced: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. |
| BR-200: Every change must be written to the audit log. | CTMS-10-T01 | Tests and review evidence must prove this exact rule is enforced: Every change must be written to the audit log. |
| BR-201: Every function requiring authentication may only be performed when the user has a valid login session and the account is active. | CTMS-10-T01 | Tests and review evidence must prove this exact rule is enforced: Every function requiring authentication may only be performed when the user has a valid login session and the account is active. |
| BR-214: Every data relationship must reference an existing and valid record; child records must not be created for resources outside the correct business scope. | CTMS-10-T01 | Tests and review evidence must prove this exact rule is enforced: Every data relationship must reference an existing and valid record; child records must not be created for resources outside the correct business scope. |
| BR-215: Emails must be normalized before comparison and storage; phone numbers must be normalized to a consistent format, preferably E.164. | CTMS-10-T01 | Tests and review evidence must prove this exact rule is enforced: Emails must be normalized before comparison and storage; phone numbers must be normalized to a consistent format, preferably E.164. |
| BR-220: A valid time range must have a start time earlier than the end time, unless the business rule explicitly allows equality. | CTMS-10-T01 | Tests and review evidence must prove this exact rule is enforced: A valid time range must have a start time earlier than the end time, unless the business rule explicitly allows equality. |
| BR-210: When concurrent requests change the same resource, the system must use transactions, locking, or version control to prevent overwrites and business limit violations. | CTMS-10-T01 | Tests and review evidence must prove this exact rule is enforced: When concurrent requests change the same resource, the system must use transactions, locking, or version control to prevent overwrites and business limit violations. |
| BR-211: Every stateful resource must follow the defined state transitions and must not use values outside the database enum. | CTMS-10-T01 | Tests and review evidence must prove this exact rule is enforced: Every stateful resource must follow the defined state transitions and must not use values outside the database enum. |
| BR-234: Public lists may only contain resources in public-allowed states; draft, suspended, closed, or archived resources must not be shown unless another rule explicitly allows it. | CTMS-10-T01 | Tests and review evidence must prove this exact rule is enforced: Public lists may only contain resources in public-allowed states; draft, suspended, closed, or archived resources must not be shown unless another rule explicitly allows it. |
| BR-235: Media must store URL and required metadata; client-provided URLs are valid only after the upload/verification flow is complete. | CTMS-10-T01 | Tests and review evidence must prove this exact rule is enforced: Media must store URL and required metadata; client-provided URLs are valid only after the upload/verification flow is complete. |
| BR-218: Access to health data must be based on consent and the relationship to the Trip; when consent is withdrawn, access must end immediately. | CTMS-10-T01 | Tests and review evidence must prove this exact rule is enforced: Access to health data must be based on consent and the relationship to the Trip; when consent is withdrawn, access must end immediately. |
| BR-219: All times must be stored as timestamptz and displayed using the configured user or location time zone. | CTMS-10-T01 | Tests and review evidence must prove this exact rule is enforced: All times must be stored as timestamptz and displayed using the configured user or location time zone. |
| BR-026: A Camper may edit the health profile or withdraw sharing consent at any time. | CTMS-10-T01, CTMS-10-T02 | Tests and review evidence must prove this exact rule is enforced: A Camper may edit the health profile or withdraw sharing consent at any time. |
| BR-027: A Campsite must include a name, description, coordinates, province/city, images, policies, and operating hours. | CTMS-10-T01, CTMS-10-T02 | Tests and review evidence must prove this exact rule is enforced: A Campsite must include a name, description, coordinates, province/city, images, policies, and operating hours. |
| BR-028: A newly created Campsite must start in Draft status. | CTMS-10-T01, CTMS-10-T02 | Tests and review evidence must prove this exact rule is enforced: A newly created Campsite must start in Draft status. |

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped BR missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements
- Implement the `Create Campsite` workflow exactly within `EPIC 2. Campsite`.
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
- Rejected actors: unauthenticated caller, Camper, Porter, Admin, and any Host whose account status is not `active`.
- Supporting systems: PostgreSQL persistence, TypeORM transaction manager, audit log table.

### Preconditions
- Caller presents a valid JWT.
- JWT resolves to an existing active account through `JwtAuthGuard` / `JwtStrategy`.
- Caller has the `host` role through `RolesGuard`.
- Request body passes backend DTO validation before any persistence action starts.

### Main Flow
1. Host sends `POST /api/campsites`.
2. Backend validates required campsite details: name, description, latitude, longitude, province, city, policies, operating hours, and at least one initial image.
3. Backend opens a transaction.
4. Backend creates the campsite with `status = draft` and `host_id = requesting Host`.
5. Backend creates initial image rows for the campsite, defaulting image `type` to `photo` and omitted `displayOrder` to request order.
6. Backend writes audit action `campsite.created` in the same transaction.
7. Backend commits and returns the created campsite and image metadata.

### Alternate Flows
- Optional image `displayOrder` may be omitted; backend assigns a deterministic order from the request index.
- Optional image `type` may be omitted; backend stores `photo`.
- Public search remains unchanged: `GET /api/campsites` is still Camper-only and active-only.

### Exception Flows
- Missing or invalid JWT returns `401`.
- Active authenticated non-Host returns `403`.
- Pending verification or suspended Host returns `401` from JWT validation.
- Invalid body returns `422` and no campsite, image, or audit row is created.
- Mid-transaction image or audit failure propagates and the transaction rolls back.
- Idempotency/retry: no external integration is called in this flow, so retry backoff is not applicable. Duplicate client retries can create separate drafts until a future idempotency-key store is introduced.

### Business Rules and Validation Rules
- BR-027: request requires name, description, coordinates, province/city, policies, operating hours, and initial images.
- BR-028 / BR-211: new campsite is always created in `draft`; client cannot submit a status.
- BR-200: `campsite.created` audit log is written in the transaction.
- BR-201 / BR-202: JWT strategy only accepts active accounts.
- BR-204 / BR-243: campsite ownership is set from the authenticated Host id, never from client input; rejected callers create no side effects.
- BR-205 / BR-231: DTO validation covers required fields, type, length, URL format, coordinate range, image count, duplicate image display order, and `operatingHours` `HH:mm-HH:mm` with start earlier than end; validation errors return `422`.
- BR-210: campsite, image, and audit writes are wrapped in one transaction.
- BR-214: child image rows are created only after the parent campsite exists in the same transaction.
- BR-220: operating hour start time must be earlier than end time.
- BR-235: image URL and metadata are stored for each initial image; only HTTP/HTTPS URLs are accepted.
- BR-234: create returns a draft, but public search remains active-only so drafts are not exposed in public campsite lists.
- BR-026, BR-218, BR-219: not directly applicable to create campsite; no health data or timestamp input is accepted by this API.
- BR-215: not directly applicable; create campsite accepts no email or phone input.
- BR-230 / BR-242: no external retry or concurrent resource update is performed by this create flow.

### API Contract
- Method/path: `POST /api/campsites`
- Auth: Bearer JWT, role `host`.
- Success: `201 Created`

Request:
```json
{
  "name": "Da Lat Pine Camp",
  "description": "A quiet campsite prepared for guided trekking stays.",
  "latitude": 11.940419,
  "longitude": 108.458313,
  "province": "Lam Dong",
  "city": "Da Lat",
  "policies": "No campfires after 21:00. Pack out all trash.",
  "operatingHours": "08:00-18:00",
  "initialImages": [
    {
      "url": "https://example.com/campsites/pine-cover.jpg",
      "type": "photo",
      "displayOrder": 1
    }
  ]
}
```

Response:
```json
{
  "id": "uuid",
  "hostId": "uuid",
  "name": "Da Lat Pine Camp",
  "description": "A quiet campsite prepared for guided trekking stays.",
  "latitude": 11.940419,
  "longitude": 108.458313,
  "province": "Lam Dong",
  "city": "Da Lat",
  "policies": "No campfires after 21:00. Pack out all trash.",
  "operatingHours": "08:00-18:00",
  "status": "draft",
  "images": [
    {
      "id": "uuid",
      "url": "https://example.com/campsites/pine-cover.jpg",
      "type": "photo",
      "displayOrder": 1
    }
  ],
  "createdAt": "2026-08-19T00:00:00.000Z",
  "updatedAt": "2026-08-19T00:00:00.000Z"
}
```

### Data Mapping
| Request field | Storage field |
| --- | --- |
| Authenticated user id | `campsites.host_id` |
| `name` | `campsites.name` |
| `description` | `campsites.description` |
| `latitude` | `campsites.latitude` as numeric string with 6 decimals |
| `longitude` | `campsites.longitude` as numeric string with 6 decimals |
| `province` | `campsites.province` |
| `city` | `campsites.city` |
| `policies` | `campsites.policies` |
| `operatingHours` | `campsites.operating_hours` |
| Server rule | `campsites.status = draft` |
| `initialImages[].url` | `campsite_images.url` |
| `initialImages[].type` | `campsite_images.type` |
| `initialImages[].displayOrder` | `campsite_images.display_order` |

### Test Evidence
- Unit: `npm --prefix services/api test -- campsites.service.spec.ts --runInBand` passed on 2026-08-19 with 13 tests, including create happy path, audit, image defaults, create failure rollback, audit failure rollback, and existing search regression coverage.
- Build: `npm --prefix services/api run build` passed on 2026-08-19.
- Lint: `npm --prefix services/api run lint` passed on 2026-08-19.
- API integration test added: `services/api/test/campsites.create.integration-spec.ts` covers happy path persistence/audit, invalid data no side effects, unauthenticated 401, non-Host 403, and inactive Host 401.
- API integration execution note: local run on 2026-08-19 was blocked by the current Postgres/TypeORM environment (`this.postgres.Pool is not a constructor` during app bootstrap), before API assertions executed.

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
