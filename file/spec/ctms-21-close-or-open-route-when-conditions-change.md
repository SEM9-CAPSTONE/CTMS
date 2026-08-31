# CTMS-21 - Close or Reopen Route when Conditions Change

**Spec Reference**
`/file/spec/ctms-21-close-or-open-route-when-conditions-change.md`

**Jira Mapping**
Jira parent `CTMS-54` and backend preparation subtask `CTMS-85` implement backlog/spec story `CTMS-21`. Backlog `CTMS-54` equipment handover is unrelated and is not part of this implementation.

**Status**
Route lifecycle slice implemented. Trip enforcement, affected-Trip handling, and participant notifications remain dependency-blocked as documented below.

## Story

As an owning Host or authorized Admin, I want to close or reopen an internal Trekking Route with a reason when operating conditions change, so unsafe or unapproved Routes cannot enter new Trip workflows and every lifecycle decision is auditable.

## Baseline v2 Domain Boundary

- Campsite -> Route -> Trip -> Booking is the active domain chain.
- A Route is an internal reusable geospatial and safety resource. Campers do not browse, register for, pay for, or book Routes directly.
- Camper participation belongs to a published Trip and its Booking/registration workflow.
- This story does not add Route editing/deletion, automatic weather closure, hazard management, Trip creation/publication, Trip cancellation, direct Route booking, or a notification platform.

## Actors and Authorization

- An authenticated active `host` may close or reopen a Route only when ownership resolves through `trekking_routes.campsite_id -> campsites.host_id` to that Host.
- A foreign Host receives `403` and no Route or audit mutation occurs.
- An authenticated active `admin` is explicitly authorized for the close/reopen lifecycle endpoints and is not treated as an implicit ownership bypass.
- Camper, Porter, and every other authenticated role receive `403`.
- Missing, invalid, expired, suspended, pending-verification, or deleted authentication receives `401` through the canonical JWT strategy.
- A missing Route receives `404`.
- Existing Host-only create/list/checkpoint authorization is unchanged.

## Status Model and State Machine

The canonical Route statuses remain exactly:

- `draft`
- `pending_approval`
- `active`
- `closed`

CTMS-21 exposes only two server-controlled transitions:

```text
active --close--> closed --reopen--> pending_approval
                                      |
                                      +-- CTMS-22 approval --> active
```

- Close accepts only `active -> closed`.
- Reopen accepts only `closed -> pending_approval`.
- Every other source state, including a repeated close or reopen, returns `409 Conflict`.
- Reopen never restores an arbitrary previous status and never transitions directly to `active`.
- CTMS-22 owns validation/approval from `pending_approval -> active`; CTMS-21 does not duplicate or bypass Admin approval.
- Clients cannot submit a target `status`, `previousStatus`, timestamp, or other lifecycle/system field.

## Reason Contract

Both lifecycle endpoints require this request body:

```json
{
  "reason": "Route temporarily unsafe due to operating conditions."
}
```

- `reason` is required, must be a string, is trimmed, must remain non-empty, and has a maximum length of 255 characters.
- Extra client-controlled lifecycle/system properties are rejected by the global whitelist with `422`.
- The trimmed reason is stored only in `audit_logs.reason`.
- No close/reopen reason, previous-status, or lifecycle timestamp column is added to `trekking_routes`.

## API Contract

```text
PATCH /api/trekking-routes/:routeId/close
PATCH /api/trekking-routes/:routeId/reopen
```

Both endpoints use `JwtAuthGuard`, `RolesGuard`, and explicit `@Roles(UserRole.HOST, UserRole.ADMIN)`. They return the authoritative updated Trekking Route using the existing response mapping, including GeoJSON geometry and authoritative numeric values. There is no arbitrary `PATCH /trekking-routes/:routeId` status API.

HTTP semantics:

- `401`: authentication failure or inactive account.
- `403`: role denial or foreign Host ownership.
- `404`: Route not found.
- `409`: invalid current-state transition, concurrent/repeated transition, or failed canonical stored-data integrity required for reopen.
- `422`: malformed body, missing/blank/overlong reason, forbidden client properties, or invalid route-id format.

Failed requests create no Route update or audit record.

## Transaction, Locking, and Audit

Each lifecycle action runs in one PostgreSQL transaction:

```text
BEGIN
-> SELECT authoritative Route and owning Host FOR UPDATE
-> verify actor role and Host ownership
-> verify current status after the lock
-> on reopen, verify canonical stored Route integrity
-> update the server-selected status
-> insert audit log
COMMIT
```

- The Route state is checked only after a pessimistic write lock is acquired.
- Concurrent/repeated requests serialize on the Route row; only the request observing the required source state can succeed.
- Close writes `action=trekking_route.closed`, `target_type=trekking_route`, actor ID, `before={status: active}`, `after={status: closed}`, and the trimmed reason.
- Reopen writes `action=trekking_route.reopened`, the same target/actor contract, `before={status: closed}`, `after={status: pending_approval}`, and the trimmed reason.
- Route update and audit insertion share the transaction. Audit insertion failure rolls the Route status update back.
- Existing `trekking_route_status` enum values and `audit_logs.reason varchar(255)` already satisfy this story; no migration is required.

## Reopen Validity

Reopen validates only canonical Route integrity already represented by current Route/database rules:

- a non-blank required name and valid ownership relation exist;
- geometry is a non-empty valid SRID 4326 LineString with at least two vertices and positive calculated length;
- stored length and expected duration are positive;
- difficulty is one of `easy | moderate | hard | expert`.

Failure returns `409` and leaves the Route closed. Reopen does not require a start/finish checkpoint, arbitrary checkpoint count, weather result, hazard polygon, absence of dangerous checkpoints, or full CTMS-22 approval checks.

## Route Eligibility and Trip Hard Constraint

The authoritative backend eligibility concept is:

```text
Route is eligible for new Trip association, submission, or publication
if and only if route.status === active.
```

Therefore `draft`, `pending_approval`, and `closed` are all ineligible. This rule is exposed as the reusable backend domain function `isRouteEligibleForNewTrip`; it is not a client-writable boolean.

The current repository still has no canonical CTMS-32 Trip create/association workflow and no CTMS-34 Trip submit/publish workflow. The lightweight profile mock Trip entities are not a real Route-linked Trip lifecycle and must not be expanded by CTMS-21. Consequently:

- there is no real Trip write path in which to enforce the helper yet;
- no fake `route_id`, Trip endpoint, status enum, or Trip test is introduced;
- backend enforcement at every future Trip association/submit/publish transaction remains blocked by CTMS-32/CTMS-34 and must require an authoritative locked Route with `status=active` when those paths exist.

## Affected Trips and Notifications

The reviewed Product Backlog requires existing `published` and `ongoing` Trips on a newly closed Route to be identified for operational handling, and their related Campers and Porters to be notified after a successful close. Reopen creates no participant notification.

The current repository does not contain:

- a canonical Route-linked Trip model with `published`/`ongoing` statuses and participant relationships; or
- an operational notification subsystem suitable for Route lifecycle events.

OTP delivery and emergency WebSocket behavior are not substitutes. CTMS-21 therefore does not fabricate affected Trips, recipients, notification records, or delivery success. This acceptance portion is dependency-blocked until CTMS-32/CTMS-34 and canonical participant/notification infrastructure exist. When available, affected-Trip lookup must be limited to `published` and `ongoing`; notification creation/delivery must occur only after successful close according to the canonical notification failure semantics and must not imply automatic cancellation, unpublish, refund, reschedule, or participant removal.

## Web Host Flow

- The existing Host page `/host/trekking-routes` remains the Route management entry point.
- A selected `active` Route shows **Đóng tuyến đường**.
- A selected `closed` Route shows **Mở lại tuyến đường**.
- `draft` and `pending_approval` Routes expose no executable CTMS-21 action.
- Each action opens a confirmation dialog with a required reason textarea, 255-character boundary, Cancel, loading feedback, and duplicate-submit prevention.
- API failures preserve the entered reason and keep the dialog usable while mapping `403/404/409/422` errors.
- Success does not manually patch local Route status. The page reloads the authoritative campsite Route list and renders the server-returned state (`closed` or `pending_approval`).
- The Admin Web has the separate CTMS-22 pending-review screen, but it is not an active/closed Route lifecycle management screen. Admin close/reopen remains API-authorized without inventing new CTMS-21 Admin navigation.

## UI and Tests

The CTMS-21 Host lifecycle UI is implemented at `/host/trekking-routes` using the existing campsite selector, Route list, selected geometry/detail area, and `RouteStatusActionDialog`. The action matrix is authoritative and intentionally narrow:

| Route status | Close | Reopen |
| --- | --- | --- |
| `active` | Available | Hidden |
| `closed` | Hidden | Available |
| `draft` | Hidden | Hidden |
| `pending_approval` | Hidden | Hidden |

- Close and reopen open the existing confirmation dialog and submit only `{ reason }` to the dedicated lifecycle endpoint for the captured Route ID.
- The reason is trimmed, required, non-blank, and limited to 255 characters through React Hook Form and Zod. Client validation is shown before any request.
- While a mutation is pending, dialog controls are disabled, action-specific loading copy is shown, and an in-flight guard prevents duplicate close/reopen requests.
- Successful close/reopen does not optimistically rewrite Route status. The page reloads the owned campsite Route list, then closes and resets the dialog. The refreshed state is `closed` after close and `pending_approval` after reopen; CTMS-22 approval remains required before `active`.
- Lifecycle failures keep the dialog open and preserve the entered reason. `403`, `404`, `409`, and `422` remain distinct; string and structured backend validation details are surfaced when present.
- A `409` also reloads authoritative Route data. The open dialog retains the originally captured action and Route ID, so a concurrent status change cannot silently convert Close into Reopen, target another selected Route, or imply success.
- Campsite/Route loading, retryable fetch errors, no-campsite, no-selection, and no-Route states remain owned by the Host Route page. Mutation errors remain inside the lifecycle dialog.
- `/host/trekking-routes` is protected for the Host role. Camper and Porter cannot mount usable lifecycle controls, while backend authorization remains authoritative for direct or stale requests.

UI evidence is maintained in the existing lifecycle test files:

- `schema/route-status-action.schema.test.ts` covers trimming, blank/whitespace rejection, and the 255-character boundary;
- `services/trekking-routes.service.test.ts` covers the exact endpoints and reason-only PATCH payload;
- `hooks/useRouteStatusAction.test.ts` covers endpoint selection, duplicate prevention, status/error mapping, structured `422` detail, and authoritative reload on `409`;
- `components/RouteStatusActionDialog.test.tsx` covers the status/action matrix, validation, pending controls, success reload, failure preservation, and stable action semantics across a conflict reload;
- `pages/TrekkingRoutesPage.test.tsx` covers Route loading, error/retry, empty, and rendered Route states;
- `routes/AppRoutes.trekking-route.test.tsx` covers Host navigation and Camper/Porter denial; and
- `tests/e2e/ctms-54-route-lifecycle.spec.ts` uses the real API/database path for close, reopen, client-invalid reason, stale `409` refresh, foreign Host denial, invalid lifecycle, and Admin API authorization.

No Trip creation/publication, Booking/registration, affected-Trip dashboard, or participant-notification UI is added. Those downstream interfaces remain dependency-blocked by their production modules and do not alter this lifecycle UI.

## Backend Preparation, Logic, and Tests

CTMS-85 preserves the existing production lifecycle implementation because it already satisfies the currently implementable backend contract:

- owning Host and globally authorized Admin lifecycle access;
- `active -> closed` and `closed -> pending_approval` transitions;
- required trimmed non-blank `reason` with a 255-character maximum;
- authoritative Route lookup, pessimistic row locking, validation under the lock, status update, and audit insertion in one transaction;
- rollback when required audit persistence fails; and
- active-only downstream eligibility through `isRouteEligibleForNewTrip`.

Successful duplicate lifecycle mutations are intentionally not idempotent. A repeated close or reopen observes a conflicting source state and returns `409`; database locking ensures only one concurrent request can perform the valid transition. Notification retry semantics are deferred to the future operational notification contract.

Current test evidence is maintained in:

- `src/modules/trekking-routes/dto/route-status-reason.dto.spec.ts` for required, trimmed, non-blank, maximum-length, and server-managed-field validation;
- `src/modules/trekking-routes/services/trekking-routes.service.spec.ts` for Host/Admin behavior, foreign Host and unsupported-role denial, lifecycle targets, exact audits, integrity rejection, missing Routes, invalid source states, and audit-failure propagation;
- `src/modules/trekking-routes/repositories/trekking-routes.repository.spec.ts` for the authoritative locked Route query and integrity mapping;
- `src/modules/trekking-routes/entities/trekking-route.entity.spec.ts` for eligibility of every canonical Route status; and
- `test/trekking-route-lifecycle.integration-spec.ts` for real PostgreSQL API persistence, authentication, authorization, validation, audit, rollback, and concurrent-transition behavior.

The closed-Route downstream contract is prepared but cannot yet be wired to nonexistent production entry points:

| Future entry point | Required authoritative rule | Current status |
| --- | --- | --- |
| Trip association/submission | Route must be `active` | Dependency-blocked by the missing canonical Route-linked Trip workflow |
| Trip publication | Route must be `active` | Dependency-blocked by the missing Trip publication workflow |
| Booking/registration creation | The associated Trip's Route must be `active`; no direct Route registration is introduced | Dependency-blocked by the missing operational Trip/Booking workflow |
| Route close operational handling | Identify only `published` and `ongoing` Trips; do not mutate Trip or participant state | Dependency-blocked by the missing canonical Route-linked Trip lifecycle |
| Close notifications | Notify relevant Camper bookings and Porter assignments; reopen sends none | Dependency-blocked by missing participant filtering and operational notification infrastructure |

Future notification integration must not infer booking or assignment status filters, deduplication keys, delivery channels, retry policy, or failure semantics. Those details require their downstream canonical contract; CTMS-85 does not fabricate delivery or tests that claim notification success.

## Acceptance Criteria

- [x] Owning Host can close an active Route with a required auditable reason.
- [x] Owning Host can reopen a closed, canonically valid Route into `pending_approval`.
- [x] Admin can explicitly close/reopen through the backend API.
- [x] Foreign Host and other roles are denied without side effects.
- [x] Invalid/repeated/concurrent transitions return `409` and do not create extra audit records.
- [x] Lifecycle update and audit are atomic under a pessimistic Route row lock.
- [x] Reopen checks current canonical Route integrity without performing CTMS-22 approval.
- [x] Active-only Trip eligibility is defined authoritatively for future Trip write paths.
- [x] Existing Host Web flow exposes only valid actions, validates/preserves reason, prevents duplicates, and reloads authoritative state.
- [ ] Real Trip association/submit/publish paths enforce active-only eligibility. **Blocked by CTMS-32/CTMS-34 implementation.**
- [ ] Closing identifies canonical `published`/`ongoing` Trips. **Blocked by missing real Route-linked Trip lifecycle.**
- [ ] Related Campers and Porters receive close notifications. **Blocked by missing Trip participant relationships and operational notification subsystem.**
- [ ] Admin Web offers lifecycle actions. **Blocked by missing CTMS-22/Admin Route management UI.**

## Implementation Scope Exclusions

- No CTMS-23 hazard/shelter work, weather/system automatic closure, Route edit/delete, checkpoint contract change, MapLibre change, Mobile change, Campsite closure propagation, Trip creation/publication/cancellation/refund/rescheduling, Camper direct Route booking, Porter workflow redesign, notification platform, or backlog CTMS-54 equipment handover.
- No entity column, enum, infrastructure, dependency, package, lockfile, environment, Docker, or migration change is required.

## References

- Jira key: `CTMS-54`
- Backlog/spec key: `CTMS-21`
- Dependency: `CTMS-22 - Approve Route`
- Trip dependencies: `CTMS-32 - Create Trip`, `CTMS-34 - Approve and Publish Trip`
- Epic: `EPIC 3. Trekking Route and Checkpoint Management`
- Baseline: reviewed Product Backlog + Jira Baseline v2
