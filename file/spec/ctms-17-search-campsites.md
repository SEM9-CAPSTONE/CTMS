# CTMS-17 - Search Campsites

**Spec Reference**  
/file/spec/ctms-17-search-campsites.md

**Story Title**  
Search Campsites

**Status**  
To Do

**Story**  
As a Camper, I want to search Campsites so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [ ] Filtering supports province/city, amenities, zone base price range, and status.
- [ ] only campsites with status = active are shown.
- [ ] results include name, location, cover image, and active routes.

## Business Rules Checklist
- [ ] BR-045: Do not use rejected status because the database does not define that value.
- [ ] BR-046: The system must support filtering by province/city, amenities, zone base price range, and status.
- [ ] BR-047: Only campsites with status = active may be displayed.
- [ ] BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.
- [ ] BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.
- [ ] BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.
- [ ] BR-210: When concurrent requests change the same resource, the system must use transactions, locking, or version control to prevent overwrites and business limit violations.
- [ ] BR-211: Every stateful resource must follow the defined state transitions and must not use values outside the database enum.
- [ ] BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.
- [ ] BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data.
- [ ] BR-232: Error messages must be clear, actionable, and must not expose stack traces, secrets, or resources the user is not authorized to view.
- [ ] BR-233: List APIs must support pagination and record limits; filtering and sorting may only use published fields.
- [ ] BR-234: Public lists may only contain resources in public-allowed states; draft, suspended, closed, or archived resources must not be shown unless another rule explicitly allows it.
- [ ] BR-235: Media must store URL and required metadata; client-provided URLs are valid only after the upload/verification flow is complete.
- [ ] BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.
- [ ] BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.
- [ ] BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.

## Dev Notes
- Jira status on 2026-08-04: `To Do`.
- Priority: `Must Have`; Story points: `8`; Commitment: `Stretch`.
- Epic: `EPIC 2. Campsite`.
- Sprint: `Sprint 2`; planned window: `2026-08-09` to `2026-08-22`.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks
- CTMS-17-T01 [BE / Shared Logic] Implement `Search Campsites` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-210, BR-211, BR-232, BR-233, BR-234, BR-235, BR-045, BR-046, BR-047, BR-206, BR-207. Ref: /file/spec/ctms-17-search-campsites.md#backend-preparation-logic-and-tests
- CTMS-17-T02 [UI Web/Mobile/Consumer] Implement `Search Campsites` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-240, BR-241, BR-242, BR-045, BR-046, BR-047. Ref: /file/spec/ctms-17-search-campsites.md#ui-and-tests

## Task to Acceptance Criteria Traceability
| Acceptance criterion / BR | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: Filtering supports province/city, amenities, zone base price range, and status | CTMS-17-T01, CTMS-17-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC2: only campsites with status = active are shown | CTMS-17-T01, CTMS-17-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC3: results include name, location, cover image, and active routes | CTMS-17-T01, CTMS-17-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. | CTMS-17-T01, CTMS-17-T02 | Tests and review evidence must prove this exact rule is enforced: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. |
| BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data. | CTMS-17-T01, CTMS-17-T02 | Tests and review evidence must prove this exact rule is enforced: Users may only view or change data they own unless their role and business relationship allow access to another user's data. |
| BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. | CTMS-17-T01, CTMS-17-T02 | Tests and review evidence must prove this exact rule is enforced: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. |
| BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. | CTMS-17-T01, CTMS-17-T02 | Tests and review evidence must prove this exact rule is enforced: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. |
| BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. | CTMS-17-T01, CTMS-17-T02 | Tests and review evidence must prove this exact rule is enforced: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. | CTMS-17-T01, CTMS-17-T02 | Tests and review evidence must prove this exact rule is enforced: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. |
| BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect. | CTMS-17-T01 | Tests and review evidence must prove this exact rule is enforced: Cases with insufficient permission or unmet business conditions must not create any side effect. |
| BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. | CTMS-17-T01 | Tests and review evidence must prove this exact rule is enforced: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. |
| BR-210: When concurrent requests change the same resource, the system must use transactions, locking, or version control to prevent overwrites and business limit violations. | CTMS-17-T01 | Tests and review evidence must prove this exact rule is enforced: When concurrent requests change the same resource, the system must use transactions, locking, or version control to prevent overwrites and business limit violations. |
| BR-211: Every stateful resource must follow the defined state transitions and must not use values outside the database enum. | CTMS-17-T01 | Tests and review evidence must prove this exact rule is enforced: Every stateful resource must follow the defined state transitions and must not use values outside the database enum. |
| BR-232: Error messages must be clear, actionable, and must not expose stack traces, secrets, or resources the user is not authorized to view. | CTMS-17-T01 | Tests and review evidence must prove this exact rule is enforced: Error messages must be clear, actionable, and must not expose stack traces, secrets, or resources the user is not authorized to view. |
| BR-233: List APIs must support pagination and record limits; filtering and sorting may only use published fields. | CTMS-17-T01 | Tests and review evidence must prove this exact rule is enforced: List APIs must support pagination and record limits; filtering and sorting may only use published fields. |
| BR-234: Public lists may only contain resources in public-allowed states; draft, suspended, closed, or archived resources must not be shown unless another rule explicitly allows it. | CTMS-17-T01 | Tests and review evidence must prove this exact rule is enforced: Public lists may only contain resources in public-allowed states; draft, suspended, closed, or archived resources must not be shown unless another rule explicitly allows it. |
| BR-235: Media must store URL and required metadata; client-provided URLs are valid only after the upload/verification flow is complete. | CTMS-17-T01 | Tests and review evidence must prove this exact rule is enforced: Media must store URL and required metadata; client-provided URLs are valid only after the upload/verification flow is complete. |
| BR-045: Do not use rejected status because the database does not define that value. | CTMS-17-T01, CTMS-17-T02 | Tests and review evidence must prove this exact rule is enforced: Do not use rejected status because the database does not define that value. |
| BR-046: The system must support filtering by province/city, amenities, zone base price range, and status. | CTMS-17-T01, CTMS-17-T02 | Tests and review evidence must prove this exact rule is enforced: The system must support filtering by province/city, amenities, zone base price range, and status. |
| BR-047: Only campsites with status = active may be displayed. | CTMS-17-T01, CTMS-17-T02 | Tests and review evidence must prove this exact rule is enforced: Only campsites with status = active may be displayed. |

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped BR missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements
- Implement the `Search Campsites` workflow exactly within `EPIC 2. Campsite`.
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
**CTMS-17-T01 — Implemented.**

- **Endpoint:** `GET /campsites` -- confirmed as the canonical route against both existing API clients (`apps/web/src/core/api/endpoints.ts`'s `CAMPSITES.GET_ALL` and `apps/mobile/lib/core/api/api_endpoints.dart`'s `CampsiteEndpoints.getAll`, both already `"/campsites"`) rather than assumed.
- **Auth:** `JwtAuthGuard` + `RolesGuard` + `@Roles(CAMPER)`. BR-202's active-account requirement is enforced by the shared `JwtStrategy` (401 for any non-`active` account status, independent of role), not by CTMS-17-specific logic.
- **Data model (provisional):** CTMS-50 (Create/Manage Campsite) had not merged when this task started, so a minimal `Campsite`/`Zone`/`CampsiteImage` schema was introduced (migration `1786600000000-CreateCampsitesTables`) carrying only the columns this story's AC/BRs need. This is explicitly provisional and will need reconciling once CTMS-50 lands.
- **Decisions resolved during implementation review** (not spelled out in the AC/BR wording above, resolved as Decision Gates rather than inferred):
  - Actor is **Camper**, per the real Jira card (CTMS-77), overriding this document's original "As a Host" wording -- see Story section above.
  - `status` accepts only `active` or omitted (422 for any other value); the active-only guarantee itself is enforced in the repository query (BR-047/234), not merely by this input restriction.
  - `amenities` matches if **any** of a campsite's zones has **any** of the requested amenities (Postgres array-overlap), not "all requested amenities on one zone".
  - Only **active** zones participate in amenities/price matching -- a `closed` zone cannot make its campsite surface in search results.
  - `activeRoutes` is always `[]` -- Trekking Routes is a separate, unbuilt domain outside `EPIC 2. Campsite`.
- **Verification evidence:**
  - Migration applied and rolled back against a real Postgres instance.
  - Repository behavior (active-only lock, amenities ANY-match, active-zone gate, no-duplicate-campsite via `EXISTS`, price range, cover-image selection) proven against real Postgres with seeded fixtures.
  - Unit tests: `services/api/src/modules/campsites/services/campsites.service.spec.ts` (9 tests, mocked repository -- service mapping/pagination-math boundary only).
  - Integration tests: `services/api/test/campsites.search.integration-spec.ts` (15 tests, real Postgres + a fully booted `AppModule` + `supertest`) -- covers security (401/403/401), every frozen invariant above, the full response contract, and campsite-accurate pagination.

## UI and Tests
**CTMS-17-T02 (Web + Mobile) — Implemented.** Consumer UI is not part of this pass -- a separate subtask.

### Web

- **Scope:** `apps/web/src/features/campsites/` -- a Camper-facing search page consuming CTMS-17-T01's frozen `GET /campsites` contract exactly. Filters are exactly province, city, amenities, minPrice, maxPrice (no status selector, no date/guest-count/campsite-type fields -- those exist only in the landing page's static, non-functional mockup, not in the backend contract).
- **Routing/auth gate:** `RoutePath.CAMPSITES` ("/campsites") is wrapped in `AppRoleGuard allowedRoles={["camper"]}` in `AppRoutes.tsx`; removed from `PUBLIC_ROUTES` (it previously listed `/campsites` as public, which no longer matched CTMS-77's frozen backend contract). An anonymous or non-Camper request is blocked by the guard before any `GET /campsites` call is made -- proven at the E2E layer (0 network calls to `/api/campsites` for both an anonymous visitor and an authenticated Host).
- **Loading/error/empty/success:** `SearchCampsitesPage` renders these as 4 distinct states, not conflated -- an API failure shows "Không thể tải danh sách campsite" while a genuine zero-result search shows "Không tìm thấy campsite phù hợp"; the search results grid never mixes with a stale loading/error view.
- **BR-241 (no duplicate submission while a request is in flight):** Search, Reset, and Pagination controls are disabled while a request is in flight; the 5 filter input fields stay editable so a Camper can prepare the next filter without needing to wait. Enforced by two layers in `useCampsitesSearch`: the `isLoading` flag (drives the disabled UI) and a synchronous `requestInFlight` ref (a second, race-proof guard against a click slipping through before React re-renders the disabled state) -- both `submitFilters`/`resetFilters`/`setPage` become no-ops while a request is outstanding.
- **Error mapping:** `mapCampsitesError` reads the real, live-verified response shapes from CTMS-77 (401 `{"message":"Unauthorized"}` for a missing/invalid token, 401 `{"message":"Authentication required"}` for an inactive account, 403 `{"message":"Insufficient permission"}`, 422 `{"message":[{field,errors[]}]}` for validation failures) and maps by **HTTP status**, not by the exact backend message string -- both 401 variants collapse to one Vietnamese message since the distinction isn't meaningful to a Camper. This is deliberately a separate concern from `AppRoleGuard`: the guard decides whether the page mounts at all (anonymous/wrong-role, before any request), while this mapping only ever runs on a request that already passed the guard (e.g. the session expiring mid-use).
- **Verification evidence:**
  - Unit/component tests (38, Vitest + Testing Library): `campsites.service.test.ts` (4, real query-serialization via a `fetch` stub -- confirms `status` is never sent and empty filters are dropped, not sent as `""`), `useCampsitesSearch.test.ts` (7, initial params, filter parsing, BR-241, error-lifecycle), `CampsitesSearchFilters.test.tsx` / `CampsitesPagination.test.tsx` / `CampsiteResultCard.test.tsx` (15, filter contract, loading/disabled table, field fidelity -- no price/status/date/guest/type/routes-UI rendered), `SearchCampsitesPage.test.tsx` (12, loading/error/empty/success, 401/403/422 distinguished, filter/reset/pagination interaction, no duplicate or extraneous API calls).
  - E2E (4, Playwright, real Chromium + real Web UI + real `GET /campsites` + real NestJS + real Postgres -- no `campsitesService`/API mocking anywhere in this suite): a full register -> verify OTP -> login flow for a real Camper account; campsites seeded directly via `services/api/src/seeds/db-helper.ts` (CTMS-77 has no Create Campsite API, so E2E fixtures for this story are inserted directly, mirroring the same pattern as `services/api/test/support/campsite-fixtures.ts`); province search returning the exact seeded active campsites (name/city+province/cover image) while the seeded `draft` campsite never appears, further narrowed correctly by amenities; an overlong `province` (>100 chars) rejected by the real backend with 422 and zero DB mutation (a negative `minPrice` was deliberately not used for this case -- the number input's own `min={0}` makes the browser block the submit natively, so nothing would ever reach the backend to reject); anonymous and wrong-role (Host) requests both blocked by the guard with zero calls to `/api/campsites` and zero DB change. Run twice independently, 8/8 pass both times, all fixtures and test accounts removed from Postgres after every run (verified via direct count).

### Mobile

- **Scope:** `apps/mobile/lib/features/camper/explore/` -- the Camper "Khám phá" tab, consuming the same CTMS-17-T01 `GET /campsites` contract Web does, filter-for-filter (province, city, amenities, minPrice, maxPrice; no status/date/guest-count/campsite-type fields, matching the same Figma-vs-backend Decision Gate Web resolved). Architecture: `CamperExploreScreen` (presentation) → `CampsiteSearchController` (Riverpod `Notifier`, application) → `CampsiteSearchRepository` (data) → `ApiClient` (real `dio` HTTP).
- **Routing/auth gate:** no new guard code -- `app_router.dart`'s existing role-based `redirect` (the Flutter equivalent of Web's `AppRoleGuard`) already sends an unauthenticated user to `/login` and a non-Camper/non-Porter role to `/unsupported-mobile-role` before `/camper/explore` (and therefore `CampsiteSearchController`/`CampsiteSearchRepository`) is ever built. Proven at the E2E layer: logging out leaves the app unable to reach Explore at all, and an authenticated Host lands on the unsupported-mobile-role screen with zero `NavigationBar`/Explore access.
- **Loading/error/empty/success:** rendered as 4 distinct states in `CamperExploreScreen`'s results sliver, never conflated -- a backend failure never falls back to the empty-state view, matching Web's same posture.
- **BR-241 (no duplicate submission while a request is in flight):** `CampsiteSearchController` guards `submitFilters`/`resetFilters`/`setPage` with a single `if (state.isLoading) return;` at the top of each method. Unlike Web, no second/synchronous guard (like `useCampsitesSearch`'s `requestInFlight` ref) is needed: Riverpod's `Notifier.state` is always synchronously current (no React-style batched-render gap), so this single check is already a fully race-proof guard by construction. The 5 filter fields stay editable while a search is in flight, same as Web.
- **Error mapping:** `_mapSearchError` maps CTMS-17-T01's real response shapes by HTTP status (401/403/422, plus a generic fallback for anything else, including a non-`ApiException`/no-network error) to Vietnamese messages -- the same status-based mapping approach as Web's `mapCampsitesError`, and the same separation of concerns (the router redirect owns "should this screen exist at all", this mapping only ever runs for a request that already passed that gate).
- **Verification evidence:**
  - Unit/controller/widget tests (54, `flutter_test`): `campsite_search_models_test.dart` (9, `fromJson` fallback/defaulting behaviour for every model), `campsite_search_repository_test.dart` (7, real `ApiClient` with only `dio.httpClientAdapter` faked -- query serialization, `status` never sent, 401/403/422 propagate untouched), `campsite_search_controller_test.dart` (13, initial search params, BR-241, filter parse/trim rules, pagination preserves filters, all 4 `_mapSearchError` branches including the two added during the Step 6 coverage pass), `campsite_search_filters_test.dart` / `campsite_result_card_test.dart` / `campsite_pagination_bar_test.dart` (17, filter contract, loading/disabled state, field fidelity -- no price/status/date/guest/type/routes UI), `camper_explore_screen_test.dart` (8, full screen composition: loading/error/empty/success, filter submit, pagination preserving filter, no extraneous API calls). Full Mobile suite: **134/134 PASS** (`flutter test`), `flutter analyze` clean (0 new issues; 7 pre-existing issues elsewhere in the app are unrelated to this story).
  - E2E (4 scenarios, real Chrome via `flutter drive`/chromedriver + real `GET /campsites` + real NestJS + real Postgres -- no `ProviderScope` override of `campsiteSearchRepositoryProvider`/`campsiteSearchControllerProvider` anywhere in this suite): a real login as a pre-activated Camper account, province search returning 22 seeded active campsites (a "Pine Camp" and a "Beach Camp" plus 20 filler campsites) while the seeded `draft` campsite never appears, **pagination proven against the real backend** (`Tổng cộng 22 campsite` / `Trang 1 / 2`, tapping "Trang sau" yields real page-2 data / `Trang 2 / 2`, not a client-side slice), further narrowed by amenities to exactly the matching campsite; an overlong `province` (>100 chars) rejected by the real backend with 422; an anonymous user (post-logout) permanently unable to reach Explore, and an authenticated Host redirected to the unsupported-mobile-role screen -- both with zero `NavigationBar`/Explore access. DB hygiene: since `integration_test/*.dart` runs inside the compiled app (no `dart:io` to shell out to `db-helper.ts` mid-test the way Playwright can), the DB-mutation check is a whole-run bookend rather than Web's per-scenario check (`apps/mobile/scripts/run-search-campsites-e2e.ps1` records a `count-campsites` baseline right after seeding, runs the full `flutter drive` suite, then re-checks it) -- verified baseline **23 → 23** unchanged across the whole run, then all 23 seeded campsites and the throwaway Host login account removed from Postgres after cleanup (verified via direct count: 0).

## References
- Story ID: `CTMS-17`
- Epic: `EPIC 2. Campsite`
- Sprint: `Sprint 2`
- Dependencies: `CTMS-16`
- Linked items: `Blocked by: CTMS-16

Blocks: CTMS-18`
- Spec Reference: `/file/spec/ctms-17-search-campsites.md`
- Business Rules workbook: `C:/Users/admin/Downloads/CTMS_Global_Business_Rules_Sprint_1-3.xlsx`
- Story-level BRs: `BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-210, BR-211, BR-232, BR-233, BR-234, BR-235, BR-045, BR-046, BR-047`
