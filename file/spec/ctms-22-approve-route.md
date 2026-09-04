# CTMS-22 - Approve Route

**Spec Reference**  
/file/spec/ctms-22-approve-route.md

**Story Title**  
Approve Route

**Jira Mapping**
Jira parent `CTMS-55` implements backlog/spec story `CTMS-22`; Jira `CTMS-87` implements backend subtask `CTMS-22-T01` (preparation, logic, and tests), and Jira `CTMS-88` implements UI subtask `CTMS-22-T02` (UI and tests). The separate backlog story also numbered CTMS-55 for equipment handling is unrelated to these Jira tasks.

**Status**  
Core Route review API, Admin Web flow, audit, locking, and tests implemented. Host Route submission (`draft -> pending_approval`) is implemented by CTMS-81 / CTMS-19. Operational notifications remain dependency-blocked because no canonical notification infrastructure exists.

**Story**  
As an Admin, I want to approve Route so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [x] Admin review validates authoritative stored geometry, difficulty, and every existing checkpoint for a `pending_approval` Route before approval.
- [x] Approval changes `pending_approval -> active`; decline changes `pending_approval -> draft` for Host edits.
- [x] An explicit non-operable decision changes `pending_approval -> closed`.
- [x] Decline and non-operable reasons are trimmed, required, limited to 255 characters, and stored in `audit_logs`.
- [x] No `rejected` status or arbitrary client-controlled status is used.
- [x] Draft submission validation and `draft -> pending_approval` are provided by CTMS-19 / Jira CTMS-81. CTMS-22 consumes the resulting `pending_approval` Route and does not duplicate the Host action.
- [ ] Related Camper/Porter and Host operational notifications. **Blocked by the absence of a Route-linked Trip/participant recipient model and operational notification persistence/service.**

## Backend Preparation, Logic, and Tests

CTMS-87 / CTMS-22-T01 re-verifies the existing CTMS-55 backend implementation and test evidence against the following approved contract. It does not introduce a second review API or change already-correct production behavior.

### Actors, authorization, and discovery

- Only an authenticated active `admin` may list or review Routes through the CTMS-22 endpoints. Host, Camper, and Porter receive `403`; unauthenticated or inactive accounts receive `401` through the canonical JWT strategy.
- `GET /api/trekking-routes/pending-review` returns only `pending_approval` Routes and includes Route identity, campsite name, GeoJSON LineString, authoritative length, difficulty, expected duration, status, and ordered checkpoints.
- The Admin Web entry point is `/admin/trekking-routes`, protected by the existing Admin role guard and linked from the existing Admin sidebar.
- Existing Host create/list/checkpoint authorization remains unchanged; Admin is not introduced as a global Route ownership bypass.

### Lifecycle and API

The canonical review state machine is:

```text
pending_approval --approve-------> active
pending_approval --decline-------> draft
pending_approval --non_operable--> closed
```

`PATCH /api/trekking-routes/:routeId/review` accepts only:

```json
{ "action": "approve" }
```

```json
{ "action": "decline", "reason": "Checkpoint instructions need revision." }
```

```json
{ "action": "non_operable", "reason": "Operation is prohibited in this protected area." }
```

- `reason` is required for `decline` and `non_operable`, trimmed, nonblank, and at most 255 characters. Approval does not require or persist a reason.
- Clients cannot supply a target status, geometry, difficulty, checkpoints, previous status, or lifecycle timestamp.
- Every source state other than `pending_approval`, including repeated/concurrent decisions, returns `409` with no side effects.
- Jira/spec wording that mentions draft-or-pending validation does not authorize direct `draft -> active`. Draft validation and Host submission belong to CTMS-19 / Jira CTMS-81 through `PATCH /api/trekking-routes/:routeId/submit-for-approval`; CTMS-22 does not duplicate that endpoint.
- CTMS-21 compatibility is `active -> closed -> pending_approval`; a reopened Route is reviewed through the same pending-only CTMS-22 path.

### Server-authoritative approval validation

Approval reads only stored PostgreSQL/PostGIS data after locking the Route row:

- Geometry must be a non-empty, valid `LineString` with SRID 4326, at least two vertices, positive PostGIS length, and positive stored server-computed length.
- Difficulty must be one of the existing enum values `easy | moderate | hard | expert`.
- Every existing checkpoint must satisfy the existing CTMS-20 integrity contract: nonblank metadata, `Point` SRID 4326 geometry, radius `10..500`, an existing checkpoint enum type, arrival offset within Route duration, route position `[0,1]`, and location within 50 metres of the Route.
- CTMS-22 validates every existing checkpoint but does not duplicate submission completeness. CTMS-19 / Jira CTMS-81 requires exactly one `start`, exactly one `finish`, and start-before-finish when a draft Route is submitted. Routes reaching `pending_approval` through another supported lifecycle action remain subject to CTMS-22's existing stored-integrity validation.
- Failed stored-data validation returns `422`, names the failing integrity area, and does not update status or write an approval audit.

### Transaction, locking, concurrency, and audit

Each review executes in one TypeORM/PostgreSQL transaction:

```text
BEGIN
-> SELECT Route and campsite context FOR UPDATE
-> verify existence and pending_approval state after the lock
-> for approval, validate stored Route/checkpoint integrity with PostGIS
-> update the server-selected status
-> insert audit_logs row
COMMIT
```

- Concurrent Admin decisions serialize on the Route row. The first valid decision commits; a stale second decision receives `409`.
- Audit actions are `trekking_route.approved`, `trekking_route.declined`, and `trekking_route.closed`, with `target_type=trekking_route`, authenticated Admin actor, status-only before/after snapshots, and the required reason where applicable.
- Route update and audit insertion are atomic. Audit failure rolls the status change back.
- `audit_logs.reason varchar(255)` and the existing Route status/difficulty/checkpoint enums already satisfy persistence requirements. No migration is required.

## UI and Tests

CTMS-88 / CTMS-22-T02 re-verifies the existing CTMS-55 Admin Web implementation and test evidence against the approved backend contract. It adds no second review flow and does not change already-correct production behavior.

### Admin Web behavior

- The pending review page provides loading, error/retry, empty, and populated states.
- Admin can select a Route and inspect campsite context, status, difficulty, length, duration, the reused read-only MapLibre/fallback Route preview, and the reused ordered checkpoint list.
- The review dialog makes approve, return-to-draft, and non-operable decisions explicit. Admin never types a raw status.
- Required reason and 255-character validation run in the UI and backend. Failure keeps the dialog open and preserves entered reason; duplicate submission is prevented.
- Success reloads the authoritative pending list. The client does not patch Route status as a source of truth.
- Host and other roles are denied by both the Web role guard and backend guards.

### Notification dependency

The repository has OTP delivery and an emergency WebSocket broadcast, but no operational notification table, recipient model, outbox/event contract, or Route-linked canonical Trip participants. Those mechanisms are not reused as fake Route review notifications. CTMS-55 therefore implements the required audit reason but does not claim notification delivery complete. Once the Route-linked Trip/participant and notification contracts exist, notification creation/delivery must occur only after the business change commits and delivery failure must not undo the Route decision, consistent with BR-226.

### Test evidence and scope exclusions

- Backend unit tests cover decision validation, pending-only lifecycle, all three targets, authoritative integrity failures, status-only audits, and audit failure propagation.
- Real PostgreSQL/PostGIS integration covers Admin discovery, LineString/checkpoint read-back, all transitions, role and active-account authorization, `404/409/422`, forbidden fields, invalid stored checkpoint integrity, concurrent conflicting decisions, audit persistence, and audit rollback.
- Web tests cover loading and error/retry recovery, discovery states, `401/403/404/409/422` mapping, structured validation details, geometry/difficulty/status/checkpoint display, approval reload, duplicate prevention, blank/255-character reason rules, failure preservation, and explicit non-operable behavior under the repository's `isolate:false` Vitest configuration.
- Playwright covers Admin inspection/approval, decline, non-operable, stale/invalid failure behavior, and Host denial.
- Excluded: CTMS-21 close/reopen endpoints, Route edit/delete, CTMS-23 hazards, weather automation, Trip architecture/publication, booking/payment/refund, Porter assignment, Camper Route booking, Mobile, and notification-platform design.

## Business Rules Checklist
- [ ] BR-055: Related Campers and Porters must receive notifications.
- [ ] BR-056: Routes with status = draft or pending_approval must be validated for geometry, difficulty, and checkpoints.
- [ ] BR-057: Approval changes status to active. Rejection returns the route to draft so the Host can edit it.
- [ ] BR-058: If the route is not allowed to operate, set status = closed. The reason must be stored in audit_logs/notifications.
- [ ] BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.
- [ ] BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.
- [ ] BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.
- [ ] BR-210: When concurrent requests change the same resource, the system must use transactions, locking, or version control to prevent overwrites and business limit violations.
- [ ] BR-211: Every stateful resource must follow the defined state transitions and must not use values outside the database enum.
- [ ] BR-221: OTP TTL, token TTL, retry count, rate limit, booking hold duration, and retry deadline must be configurable and not hard-coded in logic.
- [ ] BR-222: Important actions must be written to the audit log with actor, action, target, timestamp, before/after data, or change reason.
- [ ] BR-223: Audit logs are append-only; users and Admins must not edit or delete audit logs through normal business functions.
- [ ] BR-224: Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data.
- [ ] BR-225: Automated actions must record actor_id = NULL or a system actor and include a clear execution reason.
- [ ] BR-226: Notifications may only be emitted after the business change succeeds; notification delivery failure must not undo the main transaction result.
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
- CTMS-22-T01 [BE / Shared Logic] Implement `Approve Route` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-210, BR-211, BR-221, BR-222, BR-223, BR-224, BR-225, BR-226, BR-055, BR-056, BR-057, BR-058, BR-206, BR-207. Ref: /file/spec/ctms-22-approve-route.md#backend-preparation-logic-and-tests
- CTMS-22-T02 [UI Web/Mobile/Consumer] Implement `Approve Route` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-240, BR-241, BR-242, BR-055, BR-056, BR-057, BR-058. Ref: /file/spec/ctms-22-approve-route.md#ui-and-tests

## Task to Acceptance Criteria Traceability
| Acceptance criterion / BR | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: Routes with status = draft or pending_approval are checked for geometry, difficulty, and checkpoints | CTMS-22-T01, CTMS-22-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC2: approval changes status to active. If not approved, status returns to draft for Host edits | CTMS-22-T01, CTMS-22-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC3: if the route cannot operate, status becomes closed. Reasons are saved in audit_logs/notifications | CTMS-22-T01, CTMS-22-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC4: do not use rejected | CTMS-22-T01, CTMS-22-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. | CTMS-22-T01, CTMS-22-T02 | Tests and review evidence must prove this exact rule is enforced: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. |
| BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data. | CTMS-22-T01, CTMS-22-T02 | Tests and review evidence must prove this exact rule is enforced: Users may only view or change data they own unless their role and business relationship allow access to another user's data. |
| BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. | CTMS-22-T01, CTMS-22-T02 | Tests and review evidence must prove this exact rule is enforced: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. |
| BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. | CTMS-22-T01, CTMS-22-T02 | Tests and review evidence must prove this exact rule is enforced: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. |
| BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. | CTMS-22-T01, CTMS-22-T02 | Tests and review evidence must prove this exact rule is enforced: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. | CTMS-22-T01, CTMS-22-T02 | Tests and review evidence must prove this exact rule is enforced: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. |
| BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect. | CTMS-22-T01 | Tests and review evidence must prove this exact rule is enforced: Cases with insufficient permission or unmet business conditions must not create any side effect. |
| BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. | CTMS-22-T01 | Tests and review evidence must prove this exact rule is enforced: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. |
| BR-210: When concurrent requests change the same resource, the system must use transactions, locking, or version control to prevent overwrites and business limit violations. | CTMS-22-T01 | Tests and review evidence must prove this exact rule is enforced: When concurrent requests change the same resource, the system must use transactions, locking, or version control to prevent overwrites and business limit violations. |
| BR-211: Every stateful resource must follow the defined state transitions and must not use values outside the database enum. | CTMS-22-T01 | Tests and review evidence must prove this exact rule is enforced: Every stateful resource must follow the defined state transitions and must not use values outside the database enum. |
| BR-221: OTP TTL, token TTL, retry count, rate limit, booking hold duration, and retry deadline must be configurable and not hard-coded in logic. | CTMS-22-T01 | Tests and review evidence must prove this exact rule is enforced: OTP TTL, token TTL, retry count, rate limit, booking hold duration, and retry deadline must be configurable and not hard-coded in logic. |
| BR-222: Important actions must be written to the audit log with actor, action, target, timestamp, before/after data, or change reason. | CTMS-22-T01 | Tests and review evidence must prove this exact rule is enforced: Important actions must be written to the audit log with actor, action, target, timestamp, before/after data, or change reason. |
| BR-223: Audit logs are append-only; users and Admins must not edit or delete audit logs through normal business functions. | CTMS-22-T01 | Tests and review evidence must prove this exact rule is enforced: Audit logs are append-only; users and Admins must not edit or delete audit logs through normal business functions. |
| BR-224: Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data. | CTMS-22-T01 | Tests and review evidence must prove this exact rule is enforced: Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data. |
| BR-225: Automated actions must record actor_id = NULL or a system actor and include a clear execution reason. | CTMS-22-T01 | Tests and review evidence must prove this exact rule is enforced: Automated actions must record actor_id = NULL or a system actor and include a clear execution reason. |
| BR-226: Notifications may only be emitted after the business change succeeds; notification delivery failure must not undo the main transaction result. | CTMS-22-T01 | Tests and review evidence must prove this exact rule is enforced: Notifications may only be emitted after the business change succeeds; notification delivery failure must not undo the main transaction result. |
| BR-055: Related Campers and Porters must receive notifications. | CTMS-22-T01, CTMS-22-T02 | Tests and review evidence must prove this exact rule is enforced: Related Campers and Porters must receive notifications. |
| BR-056: Routes with status = draft or pending_approval must be validated for geometry, difficulty, and checkpoints. | CTMS-22-T01, CTMS-22-T02 | Tests and review evidence must prove this exact rule is enforced: Routes with status = draft or pending_approval must be validated for geometry, difficulty, and checkpoints. |
| BR-057: Approval changes status to active. Rejection returns the route to draft so the Host can edit it. | CTMS-22-T01, CTMS-22-T02 | Tests and review evidence must prove this exact rule is enforced: Approval changes status to active. Rejection returns the route to draft so the Host can edit it. |
| BR-058: If the route is not allowed to operate, set status = closed. The reason must be stored in audit_logs/notifications. | CTMS-22-T01, CTMS-22-T02 | Tests and review evidence must prove this exact rule is enforced: If the route is not allowed to operate, set status = closed. The reason must be stored in audit_logs/notifications. |

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped BR missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements
- Implement the `Approve Route` workflow exactly within `EPIC 3. Trekking Route`.
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
- Story ID: `CTMS-22`
- Epic: `EPIC 3. Trekking Route`
- Sprint: `Sprint 2`
- Dependencies: `CTMS-06, CTMS-19`
- Linked items: `Blocked by: CTMS-06, CTMS-19

Blocks: CTMS-61`
- Spec Reference: `/file/spec/ctms-22-approve-route.md`
- Business Rules workbook: `C:/Users/admin/Downloads/CTMS_Global_Business_Rules_Sprint_1-3.xlsx`
- Story-level BRs: `BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-210, BR-211, BR-221, BR-222, BR-223, BR-224, BR-225, BR-226, BR-055, BR-056, BR-057, BR-058`
