# CTMS-20 - Create Checkpoint on Route

**Spec Reference**  
/file/spec/ctms-20-create-checkpoint-on-route.md

**Story Title**  
Create Checkpoint on Route

**Status**  
To Do

**Story**  
As a Host, I want to create Checkpoint on Route so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [ ] Each checkpoint belongs to exactly one Trekking Route through `route_id`.
- [ ] Coordinates, name, radius, type, expected arrival offset, instructions, and nearby-water-or-shelter metadata are validated.
- [ ] Valid checkpoints are returned in the canonical direction of the parent route.

## Approved CTMS-53 Implementation Contract

### Ownership and lifecycle

- Checkpoints are stored in `checkpoints` and reference `trekking_routes.id` through `route_id ON DELETE RESTRICT`.
- `host_id` and `campsite_id` are not duplicated. Ownership is derived through checkpoint -> route -> campsite -> authenticated Host.
- Only an authenticated active user with the `host` role may create or list checkpoints. There is no Admin bypass.
- Creation is allowed only when the parent route has status `draft`. `pending_approval`, `active`, and `closed` return `409 Conflict`; listing remains available to the owning Host.
- The route is protected with a transaction lock while creation, spatial validation, insertion, and audit logging execute.

### Fields and validation

- `name`: required, trimmed, non-empty string, maximum 150 characters.
- `location`: required GeoJSON Point `{ "type": "Point", "coordinates": [longitude, latitude] }`; exactly two finite coordinates; longitude `[-180, 180]`; latitude `[-90, 90]`.
- `radiusMeters` / `radius_m`: required integer meters in the inclusive range `10..500`.
- `type`: exactly `start | rest | water | dangerous | emergency_shelter | finish`.
- `expectedArrivalOffset` / `expected_arrival_offset`: required integer elapsed minutes from the reusable route start, `>= 0` and `<= trekking_routes.expected_duration_minutes`.
- `instructions`: required, trimmed, non-empty, maximum 1000 characters.
- `nearbyWaterOrShelter` / `nearby_water_or_shelter`: required boolean only; it creates no water or shelter entity.
- Client requests may not control `id`, `routeId`, `hostId`, `campsiteId`, `routePosition`, `createdAt`, or `updatedAt`.

### PostGIS proximity and route order

- Locations are stored unchanged as `geography(Point,4326)` with `[longitude, latitude]` order.
- PostgreSQL/PostGIS authoritatively measures `ST_Distance(checkpoint.location, trekking_routes.route_geom)` using geography meters. Distance `<= 50` meters is valid; a greater distance returns `422 Unprocessable Entity`. The server never snaps the selected Point.
- The server calculates and stores `route_position` with `ST_LineLocatePoint(route_geom::geometry, checkpoint_point::geometry)`.
- `route_position` is constrained to `[0,1]`, is not unique, and is never client-controlled.
- GET results use deterministic order: `route_position ASC, created_at ASC, id ASC`.

### API and Web flow

- `POST /api/trekking-routes/:routeId/checkpoints` creates one checkpoint and returns the canonical checkpoint response.
- `GET /api/trekking-routes/:routeId/checkpoints` returns only the requested owned route's checkpoints in server-authoritative order; no rows returns `[]`.
- Errors follow CTMS conventions: `401` invalid authentication, `403` insufficient role/ownership, `404` missing route, `409` ineligible route state, and `422` invalid checkpoint data/spatial relationship.
- Web flow: Host Dashboard -> View Routes -> select campsite -> select route -> manage checkpoints -> click the read-only route map -> enter metadata -> save -> reload ordered checkpoints from GET.
- The map displays the route, numbered existing checkpoints, proposed Point, and a meter-based radius preview. Non-draft routes remain viewable but creation controls are disabled.

### Transaction and audit

- Checkpoint insertion and audit insertion occur in one transaction. Any failure rolls both back.
- Audit values are `action=trekking_route_checkpoint.created`, `target_type=trekking_route_checkpoint`, `reason=host_create_trekking_route_checkpoint`, authenticated Host actor, `before=null`, and an `after` checkpoint snapshot without the parent LineString coordinates.
- Checkpoint creation emits no notification.

### Scope exclusions

- No checkpoint update, delete, bulk create, manual reorder, arrival/check-in, visit, QR, GPS, offline, SOS, notification, Trip, route approval, route close/reopen, danger-zone, or separate shelter-management behavior is included.

## Business Rules Checklist
- [ ] BR-052: The system must store route length, difficulty, estimated duration, and status.
- [ ] BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.
- [ ] BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.
- [ ] BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.
- [ ] BR-218: Access to health data must be based on consent and the relationship to the Trip; when consent is withdrawn, access must end immediately.
- [ ] BR-219: All times must be stored as timestamptz and displayed using the configured user or location time zone.
- [ ] BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.
- [ ] BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data.
- [ ] BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.
- [ ] BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.
- [ ] BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.

## Dev Notes
- Jira status on 2026-08-04: `To Do`.
- Priority: `Must Have`; Story points: `5`; Commitment: `Committed`.
- Epic: `EPIC 3. Trekking Route`.
- Sprint: `Sprint 2`; planned window: `2026-08-09` to `2026-08-22`.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks
- CTMS-20-T01 [BE / Shared Logic] Implement `Create Checkpoint on Route` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-218, BR-219, BR-052, BR-206, BR-207. Ref: /file/spec/ctms-20-create-checkpoint-on-route.md#backend-preparation-logic-and-tests
- CTMS-20-T02 [UI Web/Mobile/Consumer] Implement `Create Checkpoint on Route` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-240, BR-241, BR-242, BR-052. Ref: /file/spec/ctms-20-create-checkpoint-on-route.md#ui-and-tests

## Task to Acceptance Criteria Traceability
| Acceptance criterion / BR | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: Each checkpoint has coordinates, radius, type, estimated time, and instructions | CTMS-20-T01, CTMS-20-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. | CTMS-20-T01, CTMS-20-T02 | Tests and review evidence must prove this exact rule is enforced: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. |
| BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data. | CTMS-20-T01, CTMS-20-T02 | Tests and review evidence must prove this exact rule is enforced: Users may only view or change data they own unless their role and business relationship allow access to another user's data. |
| BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. | CTMS-20-T01, CTMS-20-T02 | Tests and review evidence must prove this exact rule is enforced: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. |
| BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. | CTMS-20-T01, CTMS-20-T02 | Tests and review evidence must prove this exact rule is enforced: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. |
| BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. | CTMS-20-T01, CTMS-20-T02 | Tests and review evidence must prove this exact rule is enforced: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. | CTMS-20-T01, CTMS-20-T02 | Tests and review evidence must prove this exact rule is enforced: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. |
| BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect. | CTMS-20-T01 | Tests and review evidence must prove this exact rule is enforced: Cases with insufficient permission or unmet business conditions must not create any side effect. |
| BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. | CTMS-20-T01 | Tests and review evidence must prove this exact rule is enforced: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. |
| BR-218: Access to health data must be based on consent and the relationship to the Trip; when consent is withdrawn, access must end immediately. | CTMS-20-T01 | Tests and review evidence must prove this exact rule is enforced: Access to health data must be based on consent and the relationship to the Trip; when consent is withdrawn, access must end immediately. |
| BR-219: All times must be stored as timestamptz and displayed using the configured user or location time zone. | CTMS-20-T01 | Tests and review evidence must prove this exact rule is enforced: All times must be stored as timestamptz and displayed using the configured user or location time zone. |
| BR-052: The system must store route length, difficulty, estimated duration, and status. | CTMS-20-T01, CTMS-20-T02 | Tests and review evidence must prove this exact rule is enforced: The system must store route length, difficulty, estimated duration, and status. |

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped BR missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements
- Implement the `Create Checkpoint on Route` workflow exactly within `EPIC 3. Trekking Route`.
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
- Story ID: `CTMS-20`
- Epic: `EPIC 3. Trekking Route`
- Sprint: `Sprint 2`
- Dependencies: `CTMS-19`
- Linked items: `Blocked by: CTMS-19

Blocks: CTMS-24, CTMS-67, CTMS-71, CTMS-76, CTMS-104`
- Spec Reference: `/file/spec/ctms-20-create-checkpoint-on-route.md`
- Business Rules workbook: `C:/Users/admin/Downloads/CTMS_Global_Business_Rules_Sprint_1-3.xlsx`
- Story-level BRs: `BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-218, BR-219, BR-052`
