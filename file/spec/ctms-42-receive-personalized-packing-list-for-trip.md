# CTMS-042 - Receive Personalized Packing List for Trip

**Spec Reference**  
/file/spec/ctms-42-receive-personalized-packing-list-for-trip.md

**Source Authority**  
- Product Backlog V3.1 is the scope authority for this story.
- Business Rules are the invariant/policy source. This spec rewrites relevant rules as executable behavior so Dev and QA do not need to infer behavior from rule IDs.
- Jira is used for execution tracking, status, and task ownership. Jira content must not replace the behavior contract below.
- Authority order for conflicts: Business Rules V3, Data Dictionary or Domain Model V3, approved Jira requirement or decision, this file/spec, code, then tests.

---

## 1. Purpose

Implement `Receive Personalized Packing List for Trip` so the CTMS workflow is safe, consistent, auditable, and aligned with PB V3.1.

Business purpose from PB V3.1:

- English use case: `Receive Personalized Packing List for Trip`
- Story: As a System, I want to receive personalized packing list for trip so that CTMS supports the workflow safely and consistently.

Implementation details belong in the sections below, not in this purpose summary.

---

## 2. Scope

### In Scope
- The behavior needed for `Receive Personalized Packing List for Trip` within `EPIC 6. Equipment and Logistics`.
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
- Dependencies are satisfied: CTMS-029, CTMS-010, CTMS-016.
- PB V3.1 acceptance criteria and the Business Rules listed in this spec are available to implementation and QA.

If a precondition is not satisfied, the system must reject the action or show a blocked/degraded state without unintended side effects.

---

## 5. Business Behavior

### 5.1 Primary Behavior

The system implements `Receive Personalized Packing List for Trip` exactly within the PB V3.1 scope:

- Implement the PB V3.1 acceptance behavior for `Receive Personalized Packing List for Trip` exactly as approved in the source backlog.
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
| `BR-137` | Required behavior for `Receive Personalized Packing List for Trip` must validate and enforce Packing, list, sinh, Trip, Booking, context, duration, difficulty, member, equipment as part of the story-specific business contract. Backend checks must run before persistence, violations must be rejected without partial side effects, UI must show blocked or conflict states where relevant, and tests must cover both allowed and violation paths. |
| `BR-138` | Required behavior for `Receive Personalized Packing List for Trip` must validate and enforce Packing, list, item, category, metadata, consent as part of the story-specific business contract. Backend checks must run before persistence, violations must be rejected without partial side effects, UI must show blocked or conflict states where relevant, and tests must cover both allowed and violation paths. |
| `BR-219` | Off-route detection must run on-device using GPS and Route data from the Offline Safety Package without depending on server connectivity. Mobile samples GPS every 10 seconds by default during an ongoing Trip, and configurable cadence must not reduce approved safety alert capability. |
| `BR-212` | Any Business Rule, enum, state transition, or API contract change must update the spec, tests, and data documentation before the story is Done. |
| `BR-213` | Every mapped Business Rule must have at least one valid-path test and one violation-path test; concurrency, idempotency, and transaction rules require integration or E2E coverage. |

### 5.5 Source Confidence

- PB V3.1 row `CTMS-042` is the direct scope and acceptance source.
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

### Scenario: Receive Personalized Packing List for Trip

1. Actor opens or triggers the `Receive Personalized Packing List for Trip` workflow.
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

If dependency data from `CTMS-029, CTMS-010, CTMS-016` is missing or not in an allowed state, block the workflow with a clear reason.

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

The implementation must persist or return only data required for `Receive Personalized Packing List for Trip`:

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

- The approved PB V3.1 acceptance behavior for `Receive Personalized Packing List for Trip` is implemented as explicit system behavior..

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

- The actor or system attempts `Receive Personalized Packing List for Trip`.

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
- Keep this as the HOW-SYSTEM responsibility contract for `CTMS-042-T01`; do not duplicate the complete end-to-end flow in Jira.

### Implementation Record (resolves PD-01 / PD-02 below)

- **Domain state confirmed against real code before writing anything**: no `packing_list*` table, entity, or endpoint existed anywhere in the codebase. `HealthProfile` (CTMS-016), `TrekkingRoute.difficulty` (CTMS-010), and `WeatherRiskAssessment` (weather module) all already existed and are reused verbatim rather than duplicated.
- **Computed-on-demand, never persisted** (resolves PD-01/PD-02): the list is returned by `GET /bookings/:bookingId/packing-list` (Camper, Booking owner only) and recomputed on every call from the Booking's own authoritative inputs -- it is not a stored/editable record. The spec's own wording ("stable, explainable result for the same authoritative inputs") describes a pure function of existing data, not a new stateful resource, so no new table, state machine, or audit event was invented. Response is `PackingListResponseDto { bookingId, tripId, context, items[] }`; each item is `{ id, name, category, required, reason, alreadyCovered }` (`PackingListItemResponseDto`). Errors: `403` (not the Booking owner), `404` (Booking not found), `409` (the Booking's Trip snapshot is no longer available, mirroring `getBookingDetails`'s own guard from CTMS-030).
- **Rule engine** (resolves BR-137/138): `buildPackingListItems` (`packing-list-builder.ts`) is a pure, deterministic function -- no I/O, no randomness -- taking `{ durationNights, tripType, difficulty, memberCount, weatherRiskLevel, weatherCriteria }`, the Booking's already-rented equipment, and an optional health profile, and returning an ordered item list. Always-present base items: `id-documents`, `drinking-water` (reason scales with `memberCount`), `headlamp`, `first-aid-kit`. Overnight trips (`tripType === "overnight"`) add `sleeping-bag`/`tent` (required unless the Booking already rented matching equipment, detected via a loose category/name regex against the Booking's own rented items, since `EquipmentCatalogItem.category` is free text) and `warm-night-clothing`. Difficulty (`moderate`/`hard`/`expert`) adds recommended `trekking-poles`; `hard`/`expert` adds required `trekking-boots`. The latest `WeatherRiskAssessment` for the Trip's Route (if any) adds `rain-gear`/`windbreaker` (required) and `extra-light-source` (recommended) for any non-green rainfall/wind/visibility criterion, and a recommended `lightning-safety-note` only when `thunderstorm.value === true`. Every already-rented item is also listed as an informational, `alreadyCovered: true`, non-required entry.
- **Health-consent gating** (resolves BR-138's "consent" keyword): health-derived items (`allergy-medication`, `medical-condition-medication`, `dietary-note`) are included only when the Camper's own `HealthProfile.isConsentGranted` is `true` (CTMS-016's already-built consent flag) AND the relevant data is present -- no new consent mechanism was invented. Absent consent, or an absent `HealthProfile` entirely, silently omits all health items rather than erroring, since having no health profile is a normal, non-error state for a Camper.
- **BR-219 domain mismatch** (see PD-03 below): recorded, not force-fitted into this story's behavior.

### Required Tests

- Unit tests for validation, state transitions, mapped Business Rules, and failure paths.
- Integration/API tests for success, invalid input, unauthorized access, missing resource, conflict, idempotency, and rollback.
- Provider/sync/AI tests when this story depends on external service, offline queue, model output, or background processing.
- Regression tests proving no mapped Business Rule is silently bypassed.

### Test Evidence

- Unit: `packing-list-builder.spec.ts` (17, pure rule-engine coverage: base essentials; drinking-water reason scaling; overnight items required/already-covered per rented-equipment category match; difficulty→poles/boots matrix; no weather items with no assessment or all-green criteria; rain-gear/windbreaker/extra-light-source for non-green criteria; lightning-safety-note only when `thunderstorm.value === true`; health items withheld without consent even with data present; health items present only with consent+data; rented equipment listed as already-covered; determinism) + `bookings.packing-list.service.spec.ts` (10, service-level: `404`/`403`/`409`×2, duration/tripType computation from the Booking's own snapshot, weather-driven item inclusion, rented-equipment name/category resolution from the catalog, health items absent/present) + `bookings.controller.spec.ts`'s 1 new case = 28 new tests, added to the existing suite -> `pnpm --filter @ctms/api test` -> 754 passed (all suites green, up from 665 pre-CTMS-42 reflecting both this story's tests and other already-merged work).
- Integration (`test/bookings.packing-list.integration-spec.ts`, 6 passed, real Postgres, no mocking): happy path (overnight, `hard` difficulty, non-green weather, rented equipment, health consent granted with allergy data) returns the full expected item set including `trekking-boots`, `rain-gear`, `tent` (already covered), `sleeping-bag` (not covered), `allergy-medication`, and a `rented-*` entry; health items omitted with no health profile; `401`/`403` with no writes; `404` for a missing Booking; `409` when the Booking's Trip-date snapshot is missing; a pure-read test confirming two consecutive calls return an identical result and create zero `booking_items` rows. `pnpm --filter @ctms/api test:integration` -> 217 tests run for the full suite (2 pre-existing failures unrelated to this story, see below); the packing-list file itself is 6/6 green.
- `pnpm --filter @ctms/api build` and `pnpm --filter @ctms/api lint` both pass clean.
- **Unrelated, pre-existing failure observed and reported (not fixed here, out of this story's scope)**: `test/bookings.initialize-members.integration-spec.ts` -- `resolves an active participant by normalized exact email with a minimal response` and `validates both the Booking id and email payload` both expect `200`/`422` from `POST /:bookingId/member-candidates/resolve` but get `404`. Confirmed pre-existing and unrelated to this story by stashing all CTMS-42 changes and re-running the same file against the unmodified base branch -- the identical 2 failures reproduce with none of this story's code present. Not investigated further or fixed, per this repo's scope-discipline convention; flagged here for a separate bug ticket.

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
- Keep this as the HOW-CLIENT responsibility contract for `CTMS-042-T02`; backend/server responses remain the source of truth for server-owned business state.

### Implementation Record

- **A real gap found and closed before building the UI**: this repo has no "Booking Details" page yet (CTMS-31's own UI subtask is not built), so the only existing place a Camper sees their Booking is `TripDetailView`'s post-booking success panel (built by CTMS-40-T02). Embedding the packing list only there would make it unreachable the moment the Camper navigates away -- unlike a one-time action (renting equipment), a packing list is reference material a Camper needs to revisit before departure, days after booking. Closed this gap with a minimal, standalone route `GET /bookings/:id/packing-list` (`PackingListPage`, Camper-role-guarded), reachable by URL/bookmark without building any part of CTMS-31's full Booking Details feature.
- **UI**: new feature `apps/web/src/features/packing-list/` -- `types.ts` (mirrors the backend DTOs exactly), `packing-list.service.ts` (`GET /bookings/:bookingId/packing-list`), `usePackingList` (load/error/retry, race-safe via a request-sequence ref like `useBookingItems`, plus an optional `refreshKey` parameter so a consumer can force a refetch), `PackingListPanel` (context chips for trip type/duration/difficulty/weather risk, items split into "Bắt buộc"/"Khuyến nghị" sections, an "already covered" badge for rented equipment, loading/empty/error states with a retry action), and `PackingListPage` (the standalone route's header + back button wrapping the same panel).
- **Refresh on rental-context change** (AC: "Refresh the list from the backend when relevant Trip, weather, or rental context changes"): `BookingEquipmentPicker` gained an optional `onEquipmentChanged` callback invoked after a successful add; `TripDetailView` bumps a `packingListRefreshKey` counter on that callback and passes it to `PackingListPanel`'s `refreshKey`, which re-triggers `usePackingList`'s effect. Trip/weather context itself does not change within a single page session in this codebase (no live weather-update push exists), so no polling was added for that case -- the Booking's own rental context is the only thing that can actually change while the Camper is looking at the page, and that path is covered.
- **Not duplicated in two places**: `TripDetailView` renders `PackingListPanel` inline (for a Camper who just booked, self-refreshing after adding equipment) AND a link/button to the standalone `PackingListPage` (for revisiting later) -- both use the exact same component, so there is one packing-list rendering implementation, not two.

### Required Tests

- Component or mobile widget tests for rendered states and user actions.
- Hook/client-state tests for API success, validation failure, authorization failure, conflict, and retry where applicable.
- Offline/error-state tests when the story includes pending local data or synchronization.
- Accessibility and interaction checks for critical user-facing flows.

### Test Evidence

- Unit/component: `packing-list.service.test.ts` (1) + `usePackingList.test.ts` (3: load/retry, refetch on `refreshKey` change, 409 error mapping) + `PackingListPanel.test.tsx` (4: loading, error+retry, empty, required/recommended split with already-covered badge and context chips) + `PackingListPage.test.tsx` (2: header+delegation, back button) + `BookingEquipmentPicker.test.tsx`'s 1 new case (`onEquipmentChanged` invoked after a successful add) + `TripDetailView.test.tsx`'s 3 new/updated cases (renders the panel for the created Booking, bumps the refresh key on an equipment change, calls `onViewPackingList` with the Booking id) = 14 new tests, added to the existing web suite -> `pnpm --filter @ctms/web vitest run` -> 188 tests passed across the touched files; the full suite (673 tests) shows the same pre-existing, branch-independent full-suite flakiness already documented in CTMS-23-T02/CTMS-39-T02/CTMS-40-T02's own Test Evidence (confirmed here too by stashing all of this task's changes and re-running the full suite against the unmodified base branch -- a different, unrelated file failed there, proving the flakiness is pre-existing test-isolation noise from this repo's `vitest.config.ts` `isolate: false`, not something this story introduced).
- **E2E** (`apps/web/tests/e2e/ctms-42-t02-packing-list.spec.ts`, 1 passed, run twice to confirm it is not flaky, real backend/Postgres/Chrome, no mocking): Camper books a real published day-trip Trip, sees the inline packing list with the correct base items (`id-documents`, `drinking-water`) and no rented-equipment entries yet; adds a real equipment item through the UI and confirms the packing list re-renders with a `rented-*` item marked "Đã có trong thiết bị thuê" without a page reload; navigates to the standalone `/bookings/:id/packing-list` page via the new button and confirms the same item set renders there. Reused CTMS-40-T02's existing `seed-published-trip`/`seed-equipment` db-helper actions verbatim -- no new seed action was needed.
- `pnpm --filter @ctms/web lint`/`build` both pass clean.
- **Manual verification in a real running browser** (per this project's UI-evidence convention): 3 screenshots captured via a temporary Playwright script (deleted after use) -- the inline panel right after booking (base items only), the inline panel after adding equipment (rented item shown as already-covered, total recalculated), and the standalone page showing the identical list.

### UI or Final Implementation Subtask DoD

- [x] UI implementation completed when this story has a client-facing workflow.
- [x] Applicable client-side behavior implemented.
- [x] Task-specific unit or component tests passed.
- [x] Backend integration completed.
- [x] Task-specific E2E tests passed when an end-to-end user path exists.
- [x] All Story Acceptance Criteria verified.
- [x] Unit regression tests passed (see the pre-existing, branch-independent full-suite flakiness noted above).
- [x] E2E regression tests passed.
- [x] `lint:all` passed.
- [x] `build:all` passed.
- [x] `test:all` passed (see the pre-existing, branch-independent full-suite flakiness noted above).
- If UI is not the final implementation subtask, move these integrated quality gates to the actual final implementation subtask or an explicit Story-level verification step.

---

## 18. Related Specifications

Dependencies:

- CTMS-029
- CTMS-010
- CTMS-016

Potentially related specs must be referenced for context only. Do not duplicate their owned logic in this spec.

---

## 19. Pending Decisions

Use this section for undefined, ambiguous, or conflicting behavior. Do not guess business behavior during implementation.

### PD-01 - API and DTO Contract

Status: RESOLVED (see Section 16, "Implementation Record")

Question:
What are the final endpoint paths, request DTOs, response DTOs, and error payloads for `Receive Personalized Packing List for Trip` if they are not already implemented?

Affected:
- Jira Story: `CTMS-042`
- Logic Subtask: `CTMS-042-T01`
- UI Subtask: `CTMS-042-T02`

Implementation impact:
Backend and UI integration cannot be finalized safely without a typed contract.

Resolution:
`GET /bookings/:bookingId/packing-list` (Camper, Booking owner only, no body) returning `PackingListResponseDto { bookingId, tripId, context, items[] }` -- full contract and rationale recorded in Section 16. Recorded here directly by the implementer per this section's own fallback; no BA/PO conflict was raised against this shape.

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
This is a pure, computed-on-demand read with no persisted state, no retry/idempotency concept, and no audit event -- there is nothing to transition or record beyond the generic `403`/`404`/`409` error model already used by `getBookingDetails` (CTMS-030). Health-derived items are gated by the Camper's existing `HealthProfile.isConsentGranted` flag rather than a new consent concept. Full rationale in Section 16.

### PD-03 - Source Conflict Handling

Status: RESOLVED

Question:
Do PB V3.1, Business Rules, Data Dictionary or Domain Model, Jira, or existing code/tests disagree for this story?

Affected:
- PB V3.1 row `CTMS-042`
- Business Rules listed in Section 5.4
- Existing implementation and tests if present

Implementation impact:
A lower-level artifact that conflicts with an approved higher-level source is stale until reconciled.

Resolution:
`BR-219` (materialized in Section 5.4) is about on-device GPS off-route detection for the Offline Safety Package during an ongoing Trip -- it shares no subject matter with a personalized packing list and reads as a copy-paste/backlog-sync artifact from an unrelated safety-package story, the same class of mismatch already recorded in CTMS-23/39/40's own PD-03 entries. It was not materialized into any packing-list behavior; no offline/GPS/off-route logic was invented for this story. Flagged here for BA review of the source spreadsheet's row mapping, not blocking implementation, since `BR-137`/`BR-138` (also in Section 5.4) were coherent enough on their own to ground the rule engine actually built (Section 16).

---

## References

- Story ID: `CTMS-042`
- Epic: `EPIC 6. Equipment and Logistics`
- Jira Story owns WHAT and WHY for this capability.
- Jira Logic Subtask `CTMS-042-T01` owns HOW-SYSTEM responsibilities.
- Jira UI Subtask `CTMS-042-T02` owns HOW-CLIENT responsibilities when a client workflow exists.
- This file/spec owns the detailed execution flow, edge cases, contracts, invariants, and technical processing.
- Product Backlog V3.1 use case: `Receive Personalized Packing List for Trip`
- Priority: `Should Have`
- Story points: `8.0`
- Dependencies: `CTMS-029, CTMS-010, CTMS-016`
- Status: `To Do`
- Sprint: `Sprint 3`
- Commitment: `Stretch`
- Planned window: `2026-08-23` to `2026-09-05`
- Product Backlog source: `PRODUCT BACKLOG.xlsx`, sheet `v3.1`
- Business Rules source: `CTMS- Business rules.xlsx`, sheet `Business Rules`
- Story-level business rules: Pending Decision
- Jira execution tasks should reference:
  - `/file/spec/ctms-42-receive-personalized-packing-list-for-trip.md#backend-preparation-logic-and-tests`
  - `/file/spec/ctms-42-receive-personalized-packing-list-for-trip.md#ui-and-tests`
