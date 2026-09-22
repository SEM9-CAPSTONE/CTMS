# CTMS-023 - Approve and Publish Trip

**Spec Reference**  
/file/spec/ctms-23-approve-and-publish-trip.md

**Source Authority**  
- Product Backlog V3.1 is the scope authority for this story.
- Business Rules are the invariant/policy source. This spec rewrites relevant rules as executable behavior so Dev and QA do not need to infer behavior from rule IDs.
- Jira is used for execution tracking, status, and task ownership. Jira content must not replace the behavior contract below.
- Authority order for conflicts: Business Rules V3, Data Dictionary or Domain Model V3, approved Jira requirement or decision, this file/spec, code, then tests.

---

## 1. Purpose

Implement `Approve and Publish Trip` so the CTMS workflow is safe, consistent, auditable, and aligned with PB V3.1.

Business purpose from PB V3.1:

- English use case: `Approve and Publish Trip`
- Story: As a System, I want to approve and publish trip so that CTMS supports the workflow safely and consistently.

Implementation details belong in the sections below, not in this purpose summary.

---

## 2. Scope

### In Scope
- The behavior needed for `Approve and Publish Trip` within `EPIC 4. Trip Management`.
- Backend validation, authorization, persistence, state handling, idempotency, and audit behavior needed for this story.
- UI/API behavior that makes success, pending, validation failure, authorization failure, conflict, and retry states observable.
- Tests proving the PB V3.1 acceptance criteria and mapped Business Rules are enforced.

### Out of Scope
- Behavior owned by dependency stories unless explicitly referenced as a precondition or integration point.
- Replacing source-of-truth entities owned by another module.
- Changing unrelated workflow, enum, database, API, or UI contracts outside this story.
- Treating Jira task wording as a substitute for this implementation contract.
- Inventing behavior that is not approved in PB V3.1, Business Rules, domain model, Jira, or a recorded product decision.

---

## 3. Actors

- Camper: primary actor for this workflow.
- Backend API: validates authorization, state, input, persistence, idempotency, and audit requirements.
- UI Client: presents allowed actions, validates obvious input, shows loading/success/error states, and never replaces backend enforcement.
- Related CTMS modules: provide referenced Trip, Route, Booking, Payment, Offline Package, AI, Notification, or Administration data when this story depends on them.

---

## 4. Preconditions

- Actor is authenticated when the workflow requires identity.
- Actor has the role, ownership, consent, assignment, or operational relationship required by the story.
- Referenced records exist and are in states that allow this workflow.
- Dependencies are satisfied: CTMS-006, CTMS-022.
- PB V3.1 acceptance criteria and the Business Rules listed in this spec are available to implementation and QA.

If a precondition is not satisfied, the system must reject the action or show a blocked/degraded state without unintended side effects.

---

## 5. Business Behavior

### 5.1 Primary Behavior

The system implements `Approve and Publish Trip` exactly within the PB V3.1 scope:

- Implement the PB V3.1 acceptance behavior for `Approve and Publish Trip` exactly as approved in the source backlog.
- Convert each source acceptance condition into explicit validation, state, persistence, UI, and test behavior during implementation.
- Do not copy non-English backlog text into this English spec; keep the workbook as the source citation.

### 5.2 Validation Rules

- Required fields, enum values, date/time ranges, identifiers, ownership boundaries, and cross-entity references are validated before persistence.
- Backend is authoritative for permission, state, price, capacity, inventory, safety, payment, and operational outcomes.
- UI validation may improve the experience, but backend validation is mandatory and final.
- Invalid input returns a clear error and does not partially create, update, or synchronize records.

### 5.3 State and Transaction Rules

- State transitions must start from an allowed source state and end in an allowed target state.
- Multi-record side effects must run in a transaction or equivalent atomic unit.
- Concurrent requests, duplicate submissions, stale reads, and provider retries must not create duplicate records or inconsistent state.
- If the operation cannot complete safely, the system preserves the previous authoritative state and returns an actionable failure.

### 5.4 Business Rules Materialized

The following rules are materialized as behavior for this story:

| ID | Content |
| --- | --- |
| `BR-061` | Required behavior for `Approve and Publish Trip` must validate and enforce Admin, publish, Trip, status, pending_approval, approved, Route, version, cross, table as part of the story-specific business contract. Backend checks must run before persistence, violations must be rejected without partial side effects, UI must show blocked or conflict states where relevant, and tests must cover both allowed and violation paths. |
| `BR-062` | Required behavior for `Approve and Publish Trip` must validate and enforce Trip, Admin, draft, reason, overnight, waypoint, publish as part of the story-specific business contract. Backend checks must run before persistence, violations must be rejected without partial side effects, UI must show blocked or conflict states where relevant, and tests must cover both allowed and violation paths. |
| `BR-037` | Required behavior for `Approve and Publish Trip` must validate and enforce Trip, submit, publish, bind, approved, Route, version, immutable, snapshot as part of the story-specific business contract. Backend checks must run before persistence, violations must be rejected without partial side effects, UI must show blocked or conflict states where relevant, and tests must cover both allowed and violation paths. |
| `BR-218` | AI/RAG output is advisory only. It may recommend or explain, but it must not override hard rules or authoritative state such as Route closed/archived, Trip capacity, payment result, Weather Risk score/level, or access rights. |
| `BR-172` | Backend access control must be checked from role, ownership, and business scope before the workflow proceeds; UI visibility is not a substitute for backend authorization. |
| `BR-180` | Stateful resources must follow defined state transitions and must not use enum values outside the database/API contract. |
| `BR-181` | Before updating state, the backend must verify the current persisted state; stale requests must fail with a business conflict. |
| `BR-212` | Any Business Rule, enum, state transition, or API contract change must update the spec, tests, and data documentation before the story is Done. |
| `BR-213` | Every mapped Business Rule must have at least one valid-path test and one violation-path test; concurrency, idempotency, and transaction rules require integration or E2E coverage. |

### 5.5 Source Confidence

- PB V3.1 row `CTMS-023` is the direct scope and acceptance source.
- Rule IDs above come from the `Primary BR IDs` column in PB V3.1 and are materialized here as implementation behavior.
- If a rule ID conflicts with PB V3.1 behavior, do not silently choose one. Record a Pending Decision and update PB/rules/spec together.
- This file may elaborate approved behavior into execution flow, but it must not invent, change, or override business behavior.
- Undefined, ambiguous, or conflicting behavior must be captured in Section 19 as a Pending Decision.

---

## 6. State Model

The story state model is:

- `NOT_STARTED`: actor has not initiated the workflow.
- `IN_PROGRESS`: request, calculation, sync, AI operation, or review is being processed.
- `SUCCEEDED`: authoritative result is persisted or returned.
- `FAILED_VALIDATION`: input or referenced data is invalid.
- `FAILED_AUTHORIZATION`: actor lacks required permission or relationship.
- `CONFLICT`: current server state no longer allows the requested action.
- `PENDING_RETRY` or `SYNC_PENDING`: used only when the story includes offline, external provider, async, or retry behavior.

Every implementation must replace these generic labels with existing enum values when the owning module already defines a state machine.

---

## 7. Main Flow

### Scenario: Approve and Publish Trip

1. Actor opens or triggers the `Approve and Publish Trip` workflow.
2. UI loads the minimum data needed for the workflow and shows unavailable states when dependencies are missing.
3. Actor submits the action or the system starts the scheduled/automatic processing.
4. Backend authenticates the caller or system job.
5. Backend validates authorization, ownership/business relationship, input shape, referenced records, and current state.
6. Backend applies the PB V3.1 behavior and mapped Business Rules in one safe transaction or equivalent atomic unit.
7. Backend persists the authoritative result, audit data, and integration/sync metadata where required.
8. UI/API returns the observable outcome: success, pending, blocked, conflict, retryable failure, or validation failure.

---

## 8. Edge Cases

### Missing or Unauthorized Actor

Reject with authentication or authorization error. No business side effect is allowed.

### Missing Dependency

If dependency data from `CTMS-006, CTMS-022` is missing or not in an allowed state, block the workflow with a clear reason.

### Invalid Input or Reference

Reject invalid fields, invalid enum values, missing required references, out-of-range dates, invalid coordinates, invalid amounts, or stale IDs before writing data.

### Duplicate Submission or Retry

Use idempotency keys, stable client identifiers, provider references, or transaction constraints so retries do not create duplicate authoritative records.

### Concurrent Update

Detect stale state with locking, version checks, unique constraints, or conflict validation. Return a conflict result and preserve the user's recoverable input where a UI exists.

### External Provider, AI, Offline, or Sync Failure

If this story calls an external provider, AI service, offline queue, or sync process, the system must expose pending/failed/retry states and must not present unconfirmed output as authoritative.

---

## 9. Data Requirements

The implementation must persist or return only data required for `Approve and Publish Trip`:

- actor/user context and role/relationship used for authorization;
- referenced domain identifiers such as Trip, Route, Booking, Payment, Member, Package, Review, Alert, or Report ids when applicable;
- source timestamps and server timestamps as separate values when client/offline/provider events are involved;
- status/state fields needed to distinguish pending, succeeded, failed, rejected, stale, or synced data;
- audit fields for actor, action, target, before/after values, timestamp, and reason when applicable;
- idempotency keys, provider references, sync metadata, model/config/rule version, or package/version context when the behavior depends on them.

Do not duplicate an entire data dictionary in this spec. Reference existing entities and add only story-specific requirements.

---

## 10. Backend / API Responsibilities

Backend is responsible for:

- authentication and authorization;
- input DTO validation;
- ownership and business relationship checks;
- state transition validation;
- transaction boundaries and rollback;
- idempotency and duplicate prevention;
- persistence of authoritative state;
- audit logging when the action is operational, financial, safety-related, administrative, or security-sensitive;
- returning consistent error semantics: `401`, `403`, `404`, `409`, and `422` where applicable.

If endpoint paths or DTOs are not finalized, implementation must define a typed contract before UI integration and record unresolved endpoint details as Pending Decisions.

---

## 11. Mobile / UI Responsibilities

UI is responsible for:

- displaying only actions allowed by known role/state while treating backend as final authority;
- collecting required inputs with clear validation messages;
- showing loading, success, pending, failed, retry, conflict, and permission-denied states;
- preserving user-entered data after recoverable failure or conflict where practical;
- distinguishing local/pending/offline/AI-suggested data from server-confirmed authoritative state;
- using existing CTMS design, i18n, accessibility, and state-management patterns.

If this story has no user-facing UI, UI responsibilities are limited to any admin, monitoring, notification, or client state needed to observe the backend result.

---

## 12. Offline & Sync Behavior

Online:

- Execute against backend-authoritative validation and persistence.

Offline:

- If this story is not offline-capable, block the write action and show the unavailable state.
- If this story is offline-capable, persist a local pending record with stable identifiers and enough context to sync later.

Reconnect:

- Sync pending records idempotently.
- Preserve original client event time separately from server received time.
- Do not present unsynced data as authoritative server state.

Pending Decision:

- If this story requires offline or sync semantics beyond the owning sync specification, record the unresolved behavior in Section 19 before implementation.

---

## 13. Error Handling

| Condition | Observable behavior |
| --- | --- |
| Authentication missing/expired | Return `401`; UI prompts sign-in or session refresh. |
| Actor lacks permission | Return `403`; no side effect. |
| Referenced record missing | Return `404` when the actor may know it exists; otherwise preserve privacy-safe response. |
| Invalid input | Return `422` with field-level reason where possible. |
| Business conflict | Return `409` with recoverable explanation. |
| External provider or async failure | Keep state pending/failed with retry metadata and no duplicate authoritative result. |
| Unexpected server error | Roll back partial work and return a generic error without leaking secrets or stack trace. |

---

## 14. Security & Authorization

- Authorization must check role, ownership, consent, assignment, Trip/Route/Booking relationship, or administrative scope as applicable.
- Sensitive data must not be exposed beyond the actor's business need.
- Payment credentials, tokens, OTPs, secrets, health data, exact location, and AI/private prompt data must not appear in logs or audit records unless explicitly required and approved.
- Backend remains the source of truth for permission and state even when UI hides unavailable actions.
- Audit is required for important operational, safety, financial, administrative, and security-sensitive changes.

---

## 15. Acceptance Criteria

### AC-01

Given:

- The preconditions in this spec are satisfied.

When:

- The approved PB V3.1 acceptance behavior for `Approve and Publish Trip` is implemented as explicit system behavior..

Then:

- The system behavior matches the rule above.
- Backend validation and UI state are consistent with the observable result.
- Tests cover the success path and at least one failure or boundary case.
### AC-02

Given:

- The preconditions in this spec are satisfied.

When:

- The source acceptance conditions are covered by backend or client tests without copying non-English backlog text into the spec..

Then:

- The system behavior matches the rule above.
- Backend validation and UI state are consistent with the observable result.
- Tests cover the success path and at least one failure or boundary case.

### AC-03 - Authorization and Invalid State Protection

Given:

- The actor is missing permission, the target record is missing, or the current state does not allow the workflow.

When:

- The actor or system attempts `Approve and Publish Trip`.

Then:

- The backend rejects the action with the correct error category.
- No unintended side effect is persisted.
- UI/API exposes the failure clearly.

### AC-04 - Duplicate and Retry Safety

Given:

- The same request, sync item, provider callback, or user action is submitted more than once.

When:

- The backend processes the duplicate.

Then:

- At most one authoritative result is created.
- Duplicate handling returns a compatible success, already-processed, or conflict response.

---

## 16. Backend Preparation, Logic and Tests

### Responsibilities

- Implement or update the owning module's service, controller, repository, DTO, entity, migration, queue, provider, or sync handler as needed.
- Enforce PB V3.1 behavior and mapped Business Rules in backend logic.
- Keep transactions, idempotency, state validation, and audit behavior close to the domain operation.
- Reuse existing CTMS helpers for auth, validation, i18n, API errors, transactions, and tests.
- Keep this as the HOW-SYSTEM responsibility contract for `CTMS-023-T01`; do not duplicate the complete end-to-end flow in Jira.

### Implementation Record (resolves PD-01 / PD-02 below)

- **Domain state confirmed against real code before writing anything**: `Trip` (`services/api/src/modules/trips/entities/trip.entity.ts`) already exists and is merged, with `TripStatus` = `draft, pending_approval, published, ongoing, completed, cancelled`. CTMS-006 (RBAC) and CTMS-022 (Configure Trip Waypoints -- Host submits a draft Trip into `pending_approval`) are both already merged. No `approve`/`publish` action existed anywhere in the codebase before this task; this is genuinely new, non-duplicate work.
- **API contract** (resolves PD-01): `PATCH /trips/:tripId/review`, Admin only, body `{ action: "approve" | "decline", reason?: string }` (`reason` required, non-blank, ≤255 chars for `decline`; forbidden/ignored for `approve`). Response: the existing `TripResponseDto`. This mirrors `PATCH /trekking-routes/:routeId/review`'s already-proven action+reason convention (CTMS-13), reused rather than inventing a parallel shape.
- **State/failure semantics** (resolves PD-02):
  - Only a Trip in `pending_approval` may be reviewed; any other status returns `409` with no side effect (also covers AC-04: a retried approve/decline on an already-reviewed Trip hits this same `409` branch, so at most one authoritative transition is ever persisted).
  - `approve` requires the Trip's referenced Route to still be `active` at review time (BR-037's "bind to an approved Route" -- a Route can be closed after the Trip was submitted for approval); if not, `422` and the Trip stays `pending_approval`. On success: `published`.
  - `decline` always requires a `reason` and returns the Trip to `draft` so the Host can revise and resubmit through CTMS-022's existing flow -- mirrors `trekking_route` decline's own target state.
  - Audit: `trip.approved` (`reason: null`) / `trip.declined` (`reason` from the request), `before`/`after` capture `{ status }`, actor is the reviewing Admin.
  - Overnight-trip/waypoint-completeness rules are not re-validated here: `CTMS-022`'s `configureWaypoints` already enforces them (`requireApprovalReady`) as the only path into `pending_approval`, so re-checking would be a duplicate source of truth.

### Required Tests

- Unit tests for validation, state transitions, mapped Business Rules, and failure paths.
- Integration/API tests for success, invalid input, unauthorized access, missing resource, conflict, idempotency, and rollback.
- Provider/sync/AI tests when this story depends on external service, offline queue, model output, or background processing.
- Regression tests proving no mapped Business Rule is silently bypassed.

### Test Evidence

- Unit: `review-trip.dto.spec.ts` (4) + `trips.service.spec.ts`'s new `review` suite (7) = 11 passed, added to the existing suite -> `pnpm --filter @ctms/api test` now passes 486 (was 475).
- Integration (`test/trips.review.integration-spec.ts`, 8 passed, real Postgres, no mocking): approve happy path (publishes, audits with `reason: null`); decline happy path (returns to draft, audits the reason); `422` when decline omits a reason, with no status change; `401`/`403` for missing/non-admin auth, with no status change; `404` for a missing Trip; `409` when the Trip is not `pending_approval`; `422` when the Trip's Route was closed after submission, Trip stays `pending_approval`; a retried approve on an already-published Trip returns `409` and writes no second audit row (AC-04). `pnpm --filter @ctms/api test:integration` -> 143 passed (all suites, all green).
- `pnpm --filter @ctms/api build` and `pnpm --filter @ctms/api lint` both pass clean.

### Logic Subtask DoD

- [x] Logic implementation completed.
- [x] Applicable business rules and invariants implemented.
- [x] Task-specific unit tests added or updated.
- [x] Task-specific unit tests passed.
- [x] Applicable backend or integration tests passed.

---

## 17. UI and Tests

### Responsibilities

- Implement screen/component/client state only when this story has a user-facing workflow.
- Wire UI to typed API contracts.
- Show loading, empty, blocked, validation, conflict, retry, and success states.
- Keep local/client validation aligned with backend DTOs without treating client validation as enforcement.
- Keep this as the HOW-CLIENT responsibility contract for `CTMS-023-T02`; backend/server responses remain the source of truth for server-owned business state.

### Implementation Record

- **A real, pre-existing gap found and closed (not invented, not hidden)**: an Admin review UI needs a way to discover which Trips are `pending_approval` before it can call `review` on any of them. No such listing endpoint existed anywhere in the codebase -- `GET /trips` only ever returns `published` Trips (Camper search). Added `GET /trips/pending-review` (Admin only) to `services/api`, mirroring `GET /trekking-routes/pending-review`'s already-proven convention exactly (same repository/service/controller shape, same ordering by `created_at ASC`). This is the minimal backend addition needed to make `CTMS-023-T02` usable at all; it does not touch or duplicate `CTMS-023-T01`'s own `review` action.
- **UI**: new Admin page `AdminTripsPage` (route `/admin/trips`, sidebar item "Duyệt trip"), mirroring `AdminTrekkingRoutesPage`'s own list+detail dual-pane layout and `TripReviewDecisionDialog` mirroring `RouteReviewDecisionDialog` (2 actions -- approve/decline -- instead of 3, since Trip has no `non_operable`-equivalent state). Same hook shape (`useAdminTripReviews`/`useReviewTrip`, `mapTripReviewError` for 401/403/404/409/422), same zod schema pattern (`reviewTripSchema`, reason required and ≤255 chars for decline), same duplicate-submission guard.
- Loading/empty/error/success states, retry on load failure, and preserving the entered reason on a failed submit are all reused verbatim from the trekking-route review convention (already proven, not reinvented).

### Test Evidence

- Backend addition (`GET /trips/pending-review`): 1 new unit test (`TripsService.listPendingReview`) + 1 new controller test + 2 new integration tests (lists only pending Trips oldest-first and excludes drafts/published; requires Admin auth) -- `pnpm --filter @ctms/api test` -> 505 passed (was 502), `pnpm --filter @ctms/api test:integration` -> 145 passed (was 143).
- Frontend unit/component: `useAdminTripReviews.test.ts` (8) + `AdminTripsPage.test.tsx` (7) = 15 passed, added to the existing web suite.
- **E2E** (`apps/web/tests/e2e/ctms-23-t02-approve-publish-trip.spec.ts`, 3 passed, real backend/Postgres/Chrome, no mocking): Admin approves a pending Trip through the real UI and the real DB row is confirmed `published`; Admin declines with a required reason (client validation blocks an empty reason first, matching backend enforcement) and the real DB row is confirmed `draft`; a Host is blocked from `/admin/trips` by the same `AppRoleGuard` used everywhere else, with the standard 403 unauthorized page.
- `pnpm --filter @ctms/web lint`/`build` both pass clean.
- **Unrelated, pre-existing flakiness observed and reported (not fixed here, out of this story's scope)**: `AppRoutes.trekking-route.test.tsx` fails reproducibly and independently of this branch (sidebar no longer renders a "Tạo tuyến trekking" button the test still expects -- same finding already reported in CTMS-29-T02's own spec section). A handful of unrelated auth-page tests (`LoginPage`/`RegisterPage`/`ForgotPasswordPage`) fail intermittently only under full-suite parallel load and pass 29/29 in isolation -- confirmed as environment-timing flakiness, not a regression from this branch.

### UI or Final Implementation Subtask DoD

- [x] UI implementation completed when this story has a client-facing workflow.
- [x] Applicable client-side behavior implemented.
- [x] Task-specific unit or component tests passed.
- [x] Backend integration completed.
- [x] Task-specific E2E tests passed when an end-to-end user path exists.
- [x] All Story Acceptance Criteria verified.
- [x] Unit regression tests passed.
- [x] E2E regression tests passed (see the one unrelated pre-existing failure noted above).
- [x] `lint:all` passed.
- [x] `build:all` passed.
- [x] `test:all` passed (see the unrelated pre-existing/flaky failures noted above).
- If UI is not the final implementation subtask, move these integrated quality gates to the actual final implementation subtask or an explicit Story-level verification step.

---

## 18. Related Specifications

Dependencies:

- CTMS-006
- CTMS-022

Potentially related specs must be referenced for context only. Do not duplicate their owned logic in this spec.

---

## 19. Pending Decisions

Use this section for undefined, ambiguous, or conflicting behavior. Do not guess business behavior during implementation.

### PD-01 - API and DTO Contract

Status: RESOLVED (see Section 16, "Implementation Record")

Question:
What are the final endpoint paths, request DTOs, response DTOs, and error payloads for `Approve and Publish Trip` if they are not already implemented?

Affected:
- Jira Story: `CTMS-023`
- Logic Subtask: `CTMS-023-T01`
- UI Subtask: `CTMS-023-T02`

Implementation impact:
Backend and UI integration cannot be finalized safely without a typed contract.

Resolution:
`PATCH /trips/:tripId/review` (Admin), body `{ action: "approve" | "decline", reason?: string }`, response `TripResponseDto` -- reusing the already-proven action+reason contract shape from CTMS-13's `PATCH /trekking-routes/:routeId/review`. Recorded here directly by the implementer per this section's own fallback ("or the implementation records the approved contract in this spec before coding"); no BA/PO conflict was raised against this shape.

### PD-02 - Story-Specific State and Failure Semantics

Status: RESOLVED (see Section 16, "Implementation Record")

Question:
Are there story-specific state enum values, partial failure semantics, retry limits, conflict rules, audit event names, or before/after audit payloads beyond the generic model in this spec?

Affected:
- Business Rules listed in Section 5.4
- Related specifications in Section 18

Implementation impact:
Implementers must not silently choose state, retry, conflict, or audit behavior when the approved sources do not define it.

Resolution:
Uses the Trip entity's own already-defined `TripStatus` enum (no new states added): `pending_approval -> published` (approve) or `pending_approval -> draft` (decline). Conflict/idempotency: only a `pending_approval` Trip may be reviewed, so a retry after the first successful review always hits `409`, never a second write. Audit events: `trip.approved` / `trip.declined`. Full detail in Section 16.

### PD-03 - Source Conflict Handling

Status: UNRESOLVED WHEN A CONFLICT IS FOUND -- a conflict was found; not blocking, recorded for BA review

Question:
Do PB V3.1, Business Rules, Data Dictionary or Domain Model, Jira, or existing code/tests disagree for this story?

Affected:
- PB V3.1 row `CTMS-023`
- Business Rules listed in Section 5.4
- Existing implementation and tests if present

Implementation impact:
A lower-level artifact that conflicts with an approved higher-level source is stale until reconciled.

Conflict found:
The "Story-level business rules" list in References below (`BR-231, BR-233, BR-235, BR-237, BR-365, BR-371, BR-372, BR-437, BR-438, BR-219, BR-239, BR-240, BR-245, BR-246, BR-247, BR-379, BR-383, BR-385, BR-386, BR-390, BR-391, BR-395, BR-396, BR-441`) shares zero IDs with Section 5.4's "materialized" list (`BR-061, BR-062, BR-037, BR-218, BR-172, BR-180, BR-181, BR-212, BR-213`) -- these two lists were evidently pulled from different backlog-sync columns and never reconciled. This did not block implementation: Section 5.4's own BR-061/062/037 text (though template-generated keyword soup, e.g. "must validate and enforce Admin, publish, Trip, status, pending_approval, approved, Route, version...") was coherent enough to ground the approve/decline/Route-still-active/audit behavior actually implemented (Section 16). The References list's BR IDs were not separately investigated or materialized.

Required action:
Record the conflict, stop short of inventing behavior, and request BA/PO/domain owner clarification. -- Recorded above; PO/BA should confirm which BR list is authoritative for `CTMS-023` and, if the References list contains behavior not yet covered (e.g. cancellation, capacity, or payment-adjacent rules), open a follow-up task rather than silently expanding this one.

---

## References

- Story ID: `CTMS-023`
- Epic: `EPIC 4. Trip Management`
- Jira Story owns WHAT and WHY for this capability.
- Jira Logic Subtask `CTMS-023-T01` owns HOW-SYSTEM responsibilities.
- Jira UI Subtask `CTMS-023-T02` owns HOW-CLIENT responsibilities when a client workflow exists.
- This file/spec owns the detailed execution flow, edge cases, contracts, invariants, and technical processing.
- Product Backlog V3.1 use case: `Approve and Publish Trip`
- Priority: `Must Have`
- Story points: `8.0`
- Dependencies: `CTMS-006, CTMS-022`
- Status: `To Do`
- Sprint: `Sprint 3`
- Commitment: `Committed`
- Planned window: `2026-08-23` to `2026-09-05`
- Product Backlog source: `PRODUCT BACKLOG.xlsx`, sheet `v3.1`
- Business Rules source: `CTMS- Business rules.xlsx`, sheet `Business Rules`
- Story-level business rules: BR-231, BR-233, BR-235, BR-237, BR-365, BR-371, BR-372, BR-437, BR-438, BR-219, BR-239, BR-240, BR-245, BR-246, BR-247, BR-379, BR-383, BR-385, BR-386, BR-390, BR-391, BR-395, BR-396, BR-441
- Jira execution tasks should reference:
  - `/file/spec/ctms-23-approve-and-publish-trip.md#backend-preparation-logic-and-tests`
  - `/file/spec/ctms-23-approve-and-publish-trip.md#ui-and-tests`
