# CTMS-19 - Create Trekking Route on Map

**Spec Reference**  
/file/spec/ctms-19-create-trekking-route-on-map.md

**Story Title**  
Create Trekking Route on Map

**Jira Mapping**
Jira `CTMS-52` implements backlog/spec story `CTMS-19`. Jira `CTMS-81` is the backend
preparation/logic subtask; Jira `CTMS-82` owns the Web submission UI.

**Status**  
Implemented; validation evidence recorded below.

**Story**  
As a Host, I want to create Trekking Route on Map so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [x] The Host can draw a route or import GPX/GeoJSON.
- [x] Route geometry and required route data are validated.
- [x] Length, difficulty, expected duration, and status are saved.
- [x] The owning Host can submit a prepared draft Route for Admin review after checkpoint completeness is validated authoritatively.

## Approved CTMS-52 Implementation Contract

### Route domain and ownership

- A Route is reusable geographic and operational data. It is not a Trip and contains no departure, booking, participant, hazard, navigation, capacity, porter, or elevation-profile data. Checkpoints remain separate CTMS-20 records related through `checkpoints.route_id`.
- Only an authenticated active `host` may call `POST /api/trekking-routes` or campsite-scoped `GET /api/trekking-routes?campsiteId=<uuid>`.
- `campsiteId` must identify an existing campsite owned by the authenticated Host. A missing campsite returns `404`; a campsite owned by another Host returns `403`.
- Campsite status does not affect route creation. Draft, pending, active, or otherwise non-deleted owned campsites are eligible.
- Ownership is derived through `trekking_routes.campsite_id -> campsites.host_id`; route rows do not duplicate `host_id`.

### Enums and initial state

- Difficulty is exactly `easy | moderate | hard | expert`.
- Status is exactly `draft | pending_approval | active | closed`.
- CTMS-19 creation always assigns `draft` on the backend. The create request does not accept `status`.
- CTMS-81 adds the server-controlled Host preparation transition `draft -> pending_approval`. CTMS-22 remains the only review path from `pending_approval` to `active`, `draft`, or `closed`; CTMS-21 retains `active -> closed -> pending_approval`.

### Metadata and geometry

- Required request fields: `campsiteId`, trimmed `name` (1-150 characters), `geometry`, `difficulty`, and positive integer `expectedDurationMinutes`.
- `description` is optional and trimmed when present. Duration is stored as integer minutes.
- Canonical geometry is GeoJSON `{ "type": "LineString", "coordinates": [[longitude, latitude], ...] }` with at least two positions, finite numbers, longitude `[-180, 180]`, latitude `[-90, 90]`, and preserved vertex order.
- PostgreSQL stores `route_geom` as `geography(LineString,4326)`. Start/end are derived from the first/last position. No route-points or duplicate start/end columns exist.
- `length_meters` is `double precision`, must be greater than zero, and is calculated authoritatively by PostgreSQL/PostGIS using `ST_Length(route_geom)`. A Web preview is advisory only.
- The database has a GiST index on `route_geom`, normal indexes on `campsite_id` and `status`, and a RESTRICT foreign key to `campsites.id`.

### API contract

`POST /api/trekking-routes` uses `JwtAuthGuard`, `RolesGuard`, and `@Roles(UserRole.HOST)`.

Request:

```json
{
  "campsiteId": "uuid",
  "name": "Pine Ridge Traverse",
  "description": "Optional description",
  "geometry": {
    "type": "LineString",
    "coordinates": [[108.458313, 11.940419], [108.4668, 11.9465]]
  },
  "difficulty": "moderate",
  "expectedDurationMinutes": 120
}
```

The response contains `id`, `campsiteId`, `name`, nullable `description`, canonical `geometry`, authoritative `lengthMeters`, `difficulty`, `expectedDurationMinutes`, backend-assigned `status`, `createdAt`, and `updatedAt`. `hostId`, `status`, and `lengthMeters` are forbidden request properties through global whitelist validation.

`GET /api/trekking-routes?campsiteId=<uuid>` uses the same Host guards and returns an array with the canonical route response fields. The backend first verifies that the campsite exists and belongs to the authenticated Host; missing campsites return `404`, non-owned campsites return `403`, and no routes returns an empty array. The operation is read-only and does not create an audit entry.

### Host preparation and submission

- A newly created Route remains `draft` while the owning Host adds checkpoints through CTMS-20. Checkpoint creation remains draft-only.
- `PATCH /api/trekking-routes/:routeId/submit-for-approval` uses `JwtAuthGuard`, `RolesGuard`, and `@Roles(UserRole.HOST)`. It has no request DTO or client-controlled target status.
- Only the authenticated active owning Host may submit. Admin, Camper, Porter, and foreign Hosts receive `403`; missing/invalid/inactive authentication receives `401`; a missing Route receives `404`.
- Only `draft -> pending_approval` succeeds. `pending_approval`, `active`, and `closed` source states return `409`; repeated submission is not idempotently successful.
- The backend locks and reads the stored Route. Canonical Route integrity requires a nonblank name, existing campsite/Host relationship, valid nonempty SRID-4326 LineString with at least two vertices, positive spatial and stored length, positive expected duration, and an allowed difficulty.
- Every existing checkpoint must pass the CTMS-20 stored integrity contract: nonblank metadata, valid nonempty SRID-4326 Point, radius `10..500`, allowed type, arrival offset within Route duration, route position `[0,1]`, and location within 50 metres of the Route.
- Submission completeness requires exactly one `start`, exactly one `finish`, and authoritative `start.route_position < finish.route_position`. `rest`, `water`, `dangerous`, and `emergency_shelter` are optional with no minimum count. Client ordering is never trusted; canonical checkpoint ordering remains `route_position`, `created_at`, then `id`, all ascending.
- Failed stored Route/checkpoint integrity or completeness returns `422` without mutation. The Host does not resend Route or checkpoint data for submission.
- The response uses the normal authoritative Trekking Route response shape and reports persisted status `pending_approval`. The existing Admin `GET /api/trekking-routes/pending-review` discovers the submitted Route without special-case duplication.

### Web drawing and import

- Host page: `/host/trekking-routes/create`, linked from the current `RoleLandingPage` Host dashboard and protected by the existing Host UI guard.
- Host read-back page: `/host/trekking-routes?campsiteId=<uuid>`, linked by `Xem tuyến đường` on each owned Campsite card. The page validates the query value against `GET /api/campsites/my`, lists route metadata, and lets the Host select a route for a read-only MapLibre geometry preview with the existing no-key fallback.
- Campsites are loaded from existing `GET /api/campsites/my`, with loading, error/retry, empty, and success states.
- The route-specific MapLibre editor supports click-to-add, rendered line/vertices, draggable vertices, selected-vertex removal, last-vertex removal, clear/redraw, start/end markers, geometry preview, and approximate length. It preserves the current no-MapTiler-key fallback behavior.
- GeoJSON is parsed in Web and accepts a raw LineString, a Feature containing a LineString, or a FeatureCollection resolving to exactly one LineString. Other/empty/malformed/ambiguous geometry is rejected.
- GPX is parsed in Web and accepts exactly one track or exactly one route. Multiple or mixed tracks/routes are rejected; elevation is ignored. Import files are limited to 5 MB.
- The Web sends only the canonical create DTO, prevents duplicate submission, preserves form/geometry after failure, maps `401/403/404/409/422`, and shows server-returned length and status after success.
- CTMS-81 adds no production Web submission control. CTMS-82 implements the Host submission button, mutation hook, loading/error behavior, and UI/E2E evidence described below.

### UI and tests

- The existing Host Route management page at `/host/trekking-routes?campsiteId=<uuid>` owns the submission action; CTMS-82 does not introduce another Route page. The selected draft Route's existing checkpoint panel shows preparation readiness and `Gửi duyệt` alongside the existing checkpoint-management flow.
- Readiness guidance uses the already loaded authoritative checkpoint response and checks only exactly one `start`, exactly one `finish`, and `start.route_position < finish.route_position`. Missing, duplicate, equal-position, and reversed-position cases disable submission with a specific explanation. `rest`, `water`, `dangerous`, and `emergency_shelter` remain optional. This client calculation is guidance only; the backend repeats all canonical Route/checkpoint validation.
- The Web calls `PATCH /api/trekking-routes/:routeId/submit-for-approval` without a request body or client-selected status. A pending request disables the action and the hook rejects duplicate clicks. No optimistic status change occurs.
- Checkpoint-list loading and failure prevent a readiness claim. Submit failures map `401/403/404/409/422`; structured backend `422` details remain visible, and a missing Route triggers a Route-list reload. Existing no-campsite, no-Route, and no-checkpoint states remain unchanged.
- Success waits for the authoritative submission response and Route-list reload. The selected Route renders `Chờ duyệt`, the submit action disappears, and the existing CTMS-20 draft-only checkpoint form becomes read-only. The Host is not redirected to CTMS-22 Admin review; the existing pending-review query discovers the submitted Route.
- Focused Vitest evidence covers readiness, optional checkpoint types, submission visibility by lifecycle state, loading/error/success states, duplicate prevention, the no-body service contract, refetch, and `403/409/422` feedback. Playwright extends the CTMS-19 Host journey from UI Route creation through Start/Finish preparation and submission, plus incomplete and unauthorized non-mutating flows.

### Transaction, audit, and exclusions

- Route creation, authoritative PostGIS length calculation, and audit insertion occur in one database transaction. An audit failure rolls the route insert back.
- Audit values are `action=trekking_route.created`, `target_type=trekking_route`, `reason=host_create_trekking_route`, actor from the authenticated Host, and `before=null`.
- Audit `after` contains authoritative route metadata and a geometry summary (`type`, vertex count, start, end, length, bounding box), not the complete coordinate array.
- Submission executes in one transaction: lock Route `FOR UPDATE`, verify ownership and draft state, validate stored Route/checkpoints and completeness, update to `pending_approval`, and insert the audit. Concurrent submissions serialize; the stale request returns `409`.
- Submission audit values are `action=trekking_route.submitted_for_approval`, `target_type=trekking_route`, `reason=host_submit_trekking_route_for_approval`, authenticated owning Host actor, and status-only `draft` before / `pending_approval` after snapshots. Audit failure rolls the status update back.
- No migration is required because `pending_approval` already exists. No Admin notification is emitted: the repository has no canonical operational notification recipient/outbox contract, and OTP or emergency WebSocket delivery must not be reused.
- CTMS-19/CTMS-81 makes no Mobile changes. Excluded: CTMS-82 production submission UI, checkpoint update/delete, CTMS-21 close/reopen changes, CTMS-22 Admin review changes, CTMS-23 hazards/shelters, Trips, navigation/offline maps, elevation profiles, capacity, porter requirements, recommendations, and Campsite approval.

## Test Evidence

- Backend unit: DTO validation and forbidden fields; PostGIS repository SQL/zero length and campsite-filtered read serialization; campsite missing/ownership; draft assignment; audit summary; audit rollback propagation.
- Real PostgreSQL/PostGIS integration: LineString geography, SRID 4326, geometry type, vertex order, start/end, GeoJSON round trip, authoritative length, campsite-filtered read-back and empty list, RESTRICT FK, authentication, Host role, ownership, validation, audit and transaction rollback.
- CTMS-81 backend unit: owning-Host submission, strict draft lifecycle, stored Route/checkpoint validation, exact start/finish counts and order, exact audit, and audit failure propagation.
- CTMS-81 real PostgreSQL/PostGIS integration: successful persistence and Admin discovery; missing/duplicate start or finish; reversed order; invalid stored Route/checkpoint data; authentication, role, and ownership; stale states; concurrent submission; audit persistence and rollback.
- Web unit/component: selector states, schema/payload, geometry operations, preview, GeoJSON/GPX inputs and failures, 5 MB limit, duplicate-submit prevention, API error mapping, state preservation, authoritative success display, dashboard read navigation, route-list empty state, metadata selection, read-only geometry rendering, submission readiness, lifecycle visibility, and authoritative submission reload.
- Playwright acceptance: manual drawing, GeoJSON import, invalid geometry with no side effect, complete Host preparation and submission, incomplete preparation, Camper page denial, and non-owning Host API denial with unchanged Route data.

## Business Rules Checklist
- [ ] BR-050: Do not display slots because the system manages campsite capacity by zone.
- [ ] BR-051: The system must allow drawing a route or importing GPX/GeoJSON.
- [ ] BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.
- [ ] BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.
- [ ] BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.
- [ ] BR-210: When concurrent requests change the same resource, the system must use transactions, locking, or version control to prevent overwrites and business limit violations.
- [ ] BR-211: Every stateful resource must follow the defined state transitions and must not use values outside the database enum.
- [ ] BR-218: Access to health data must be based on consent and the relationship to the Trip; when consent is withdrawn, access must end immediately.
- [ ] BR-219: All times must be stored as timestamptz and displayed using the configured user or location time zone.
- [ ] BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.
- [ ] BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data.
- [ ] BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.
- [ ] BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.
- [ ] BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.

## Dev Notes
- Jira parent: `CTMS-52`; backend subtask: `CTMS-81`; Web subtask: `CTMS-82`; backlog/spec key: `CTMS-19`.
- Priority: `Must Have`; Story points: `8`; Commitment: `Committed`.
- Epic: `EPIC 3. Trekking Route`.
- Sprint: `Sprint 2`; planned window: `2026-08-09` to `2026-08-22`.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks
- CTMS-19-T01 / Jira CTMS-81 [BE / Shared Logic] Implement creation preparation, authoritative validation, and Host submission to Admin review; enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-210, BR-211, BR-218, BR-219, BR-050, BR-051, BR-206, BR-207. Ref: /file/spec/ctms-19-create-trekking-route-on-map.md#backend-preparation-logic-and-tests
- CTMS-19-T02 / Jira CTMS-82 [Web UI] Implement the Host submission UI without changing the server-controlled lifecycle contract. Ref: /file/spec/ctms-19-create-trekking-route-on-map.md#ui-and-tests

## Task to Acceptance Criteria Traceability
| Acceptance criterion / BR | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: The Host can draw a route or import GPX/GeoJSON | CTMS-19-T01, CTMS-19-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC2: length, difficulty, estimated duration, and status are saved | CTMS-19-T01, CTMS-19-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC3: The owning Host can submit a valid draft with exactly one ordered start/finish pair for Admin review | CTMS-19-T01 / Jira CTMS-81; Web control deferred to CTMS-19-T02 / Jira CTMS-82 | Backend unit and real PostgreSQL/PostGIS API evidence for lifecycle, authorization, integrity, completeness, concurrency, and audit |
| BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. | CTMS-19-T01, CTMS-19-T02 | Tests and review evidence must prove this exact rule is enforced: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. |
| BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data. | CTMS-19-T01, CTMS-19-T02 | Tests and review evidence must prove this exact rule is enforced: Users may only view or change data they own unless their role and business relationship allow access to another user's data. |
| BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. | CTMS-19-T01, CTMS-19-T02 | Tests and review evidence must prove this exact rule is enforced: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. |
| BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. | CTMS-19-T01, CTMS-19-T02 | Tests and review evidence must prove this exact rule is enforced: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. |
| BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. | CTMS-19-T01, CTMS-19-T02 | Tests and review evidence must prove this exact rule is enforced: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. | CTMS-19-T01, CTMS-19-T02 | Tests and review evidence must prove this exact rule is enforced: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. |
| BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect. | CTMS-19-T01 | Tests and review evidence must prove this exact rule is enforced: Cases with insufficient permission or unmet business conditions must not create any side effect. |
| BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. | CTMS-19-T01 | Tests and review evidence must prove this exact rule is enforced: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. |
| BR-210: When concurrent requests change the same resource, the system must use transactions, locking, or version control to prevent overwrites and business limit violations. | CTMS-19-T01 | Tests and review evidence must prove this exact rule is enforced: When concurrent requests change the same resource, the system must use transactions, locking, or version control to prevent overwrites and business limit violations. |
| BR-211: Every stateful resource must follow the defined state transitions and must not use values outside the database enum. | CTMS-19-T01 | Tests and review evidence must prove this exact rule is enforced: Every stateful resource must follow the defined state transitions and must not use values outside the database enum. |
| BR-218: Access to health data must be based on consent and the relationship to the Trip; when consent is withdrawn, access must end immediately. | CTMS-19-T01 | Tests and review evidence must prove this exact rule is enforced: Access to health data must be based on consent and the relationship to the Trip; when consent is withdrawn, access must end immediately. |
| BR-219: All times must be stored as timestamptz and displayed using the configured user or location time zone. | CTMS-19-T01 | Tests and review evidence must prove this exact rule is enforced: All times must be stored as timestamptz and displayed using the configured user or location time zone. |
| BR-050: Do not display slots because the system manages campsite capacity by zone. | CTMS-19-T01, CTMS-19-T02 | Tests and review evidence must prove this exact rule is enforced: Do not display slots because the system manages campsite capacity by zone. |
| BR-051: The system must allow drawing a route or importing GPX/GeoJSON. | CTMS-19-T01, CTMS-19-T02 | Tests and review evidence must prove this exact rule is enforced: The system must allow drawing a route or importing GPX/GeoJSON. |

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped BR missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements
- Implement the `Create Trekking Route on Map` workflow exactly within `EPIC 3. Trekking Route`.
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
- Story ID: `CTMS-19`
- Epic: `EPIC 3. Trekking Route`
- Sprint: `Sprint 2`
- Dependencies: `CTMS-10, CTMS-20`; Admin review continues in `CTMS-22`.
- Linked items: `Blocked by: CTMS-10

Blocks: CTMS-20, CTMS-21, CTMS-22, CTMS-23, CTMS-24, CTMS-25, CTMS-32, CTMS-56, CTMS-104`
- Spec Reference: `/file/spec/ctms-19-create-trekking-route-on-map.md`
- Business Rules workbook: `C:/Users/admin/Downloads/CTMS_Global_Business_Rules_Sprint_1-3.xlsx`
- Story-level BRs: `BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-210, BR-211, BR-218, BR-219, BR-050, BR-051`
