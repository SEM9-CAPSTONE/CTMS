# CTMS-04 - Refresh Authentication Session

**Spec Reference**  
/file/spec/ctms-04-refresh-authentication-session.md

**Story Title**  
Refresh Authentication Session

**Status**  
In Progress

**Story**  
As a user, I want to refresh Authentication Session so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [x] A valid refresh token creates a new access token.
- [x] expired or revoked tokens must be rejected.

## Business Rules Checklist
- [x] BR-011: Locked accounts must not be allowed to log in.
- [x] BR-012: A valid refresh token must be able to create a new access token.
- [x] BR-200: Every change must be written to the audit log.
- [x] BR-201: Every function requiring authentication may only be performed when the user has a valid login session and the account is active.
- [x] BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.
- [x] BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.
- [x] BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.
- [x] BR-206: The backend is the final authority for permissions, status, pricing, capacity, inventory, risk level, and transaction results; clients must not set these values by themselves.
- [x] BR-207: Every change involving multiple tables or records must run in a transaction; if one step fails, the whole business operation must roll back.
- [x] BR-214: Every data relationship must reference an existing and valid record; child records must not be created for resources outside the correct business scope.
- [x] BR-215: Emails must be normalized before comparison and storage; phone numbers must be normalized to a consistent format, preferably E.164. (Not applicable to CTMS-04-T01 — refresh does not touch email/phone.)
- [x] BR-220: A valid time range must have a start time earlier than the end time, unless the business rule explicitly allows equality. (Not applicable to CTMS-04-T01 — refresh has no time-range input.)
- [x] BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. (Not applicable to CTMS-04-T01 — refresh calls no external service; the DG-03 concurrent-refresh guard covers duplicate-request safety instead.)
- [x] BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data.
- [x] BR-236: Users may only add, delete, or reorder media for resources they own or are authorized to manage. (Not applicable to CTMS-04-T01 — no media involved.)
- [x] BR-237: Background jobs must re-check business conditions at execution time and must not rely only on stale state. (Not applicable to CTMS-04-T01 — refresh is a synchronous request, not a background job.)
- [x] BR-240: When offline data conflicts with newer data on the server, the server applies the defined conflict rule and does not silently overwrite newer data. (Not applicable to CTMS-04-T02/T03 — refresh-session has no offline-sync/conflicting-write scenario on either client.)
- [x] BR-241: The UI must prevent duplicate submission while a request is in flight; financial or resource-holding actions only show success after backend confirmation. (CTMS-04-T02/T03: this is exactly what each client's single-flight refresh coordinator does — concurrent 401s collapse into one in-flight `POST /auth/refresh`, never a duplicate, on Web (`authRefresh.ts`) and Mobile (`AuthRefreshCoordinator`) alike. See DG-03/DG-05 ("Web Integration") and DG-M3 ("Mobile Integration") below.)
- [x] BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. (Not applicable to CTMS-04-T02/T03 as written — refresh-session has no concurrent-data-conflict scenario to preserve form data across on either client. The closest related behavior each implements is documented under "Web Integration"/"Mobile Integration" below: the original request's data is preserved and retried automatically after a token-expiry failure, a different trigger than this BR describes.)
- [x] BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.
- [x] BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.

## Dev Notes
- Jira status on 2026-08-04: `In Progress`.
- Priority: `Must Have`; Story points: `3`; Commitment: `Committed`.
- Epic: `EPIC 1. Authentication`.
- Sprint: `Sprint 1`; planned window: `2026-07-26` to `2026-08-08`.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks
- [x] CTMS-04-T01 [BE / Shared Logic] Implement `Refresh Authentication Session` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-200, BR-201, BR-214, BR-215, BR-220, BR-236, BR-237, BR-011, BR-012, BR-206, BR-207. Ref: /file/spec/ctms-04-refresh-authentication-session.md#backend-preparation-logic-and-tests
- [x] CTMS-04-T02 [UI Web/Mobile/Consumer] Implement `Refresh Authentication Session` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-240, BR-241, BR-242, BR-011, BR-012. Ref: /file/spec/ctms-04-refresh-authentication-session.md#ui-and-tests

  Note: only the Web client (`apps/web`) is implemented under this checkbox. Mobile integration is delivered separately under CTMS-04-T03 below (real Jira key CTMS-216); Consumer (a separate client, not in either Jira card) remains open.
- [x] CTMS-04-T03 [Mobile] Implement `Refresh Authentication Session` — Mobile Integration (real Jira key `CTMS-216`) for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-240, BR-241, BR-242, BR-011, BR-012. Ref: /file/spec/ctms-04-refresh-authentication-session.md#mobile-integration-and-tests

## API Contract (CTMS-04-T01 — implemented)

This story shipped with no API Contract on record. The contract below was
resolved through this task's own Decision Gate (DG-01 → DG-05) and is
recorded here per BR-244.

### `POST /auth/refresh`

Request body:

```json
{ "refreshToken": "<raw refresh token issued at login or by a previous refresh>" }
```

Success response `200`:

```json
{ "accessToken": "<new JWT access token>", "refreshToken": "<new raw refresh token>" }
```

No `user` field (DG-01) — unlike `POST /auth/login`'s response.

Errors:
- `401` — the refresh token was not found, expired, already revoked, already
  rotated (reused), or the owning account is no longer `active`. All 5 cases
  return the exact same message, by design — the same anti-enumeration
  reasoning as `/auth/login`'s single "Invalid credentials" message
  (BR-231): a caller must not be able to tell "bad token" from "right token,
  wrong account state" from the response alone.
- `422` — `refreshToken` missing or not a string (BR-205, via the existing
  global `ValidationPipe`).

### Rotation (DG-02)

Every successful refresh revokes the presented token and issues a brand-new
one in the same DB transaction (BR-207) — there is no "keep the same
refresh token, only mint a new access token" path. The new refresh token
reuses `POST /auth/login`'s exact generation scheme (`randomBytes(32)` hex,
SHA-256 hash) and TTL (`JWT_REFRESH_TOKEN_TTL`).

### Reuse / concurrent refresh (DG-03)

Guarded by a single conditional `UPDATE ... WHERE revoked_at IS NULL AND
expires_at > :now`, keyed by the token's row id, executed inside the
rotation transaction. If 0 rows are affected, the token was already
invalidated — a genuine reuse attempt, or a second concurrent request
racing the first — and the call is rejected exactly like a first-time-invalid
token (BR-243: no new token row is written). No token family, no additional
migration, no distributed lock: the row-level conditional `UPDATE` is the
entire guard.

### Session revocation (DG-04)

Not a separate mechanism: a token revoked through any existing path (e.g.
`resetPassword()`'s bulk `revokeActiveTokensForUser()`) is rejected by
`/auth/refresh` the same way an already-rotated token is — both simply have
`revoked_at IS NOT NULL`.

### Account status re-check (BR-201/BR-202)

Every refresh re-checks the owning user's *current* `status`; only `active`
accounts may refresh, independent of what the account's status was at the
time the presented token was originally issued.

### Audit logging (DG-05/BR-200)

Each successful rotation writes one `audit_logs` row
(`action: "auth.token_refreshed"`). `POST /auth/login`'s own refresh-token
creation does not write an equivalent row — tracked separately as CTMS-03
known debt, intentionally left unchanged by this story (Decision Gate
DG-05).

## Web Integration (CTMS-04-T02 — implemented)

This story shipped with no Web Integration design on record. The design
below was resolved through this task's own Decision Gate (DG-01 → DG-07 +
security/concurrency constraints), built entirely on top of CTMS-04-T01's
API Contract above, and is recorded here per BR-244.

### Files
- `apps/web/src/core/api/authRefresh.ts` — single-flight refresh coordinator.
- `apps/web/src/core/api/authSessionSync.ts` — session clear + cross-tab sync.
- `apps/web/src/core/api/httpClient.ts` — 401 detection and refresh-and-retry
  interceptor (existing shared HTTP client, extended in place).
- `apps/web/src/main.tsx` — registers the cross-tab listener once at startup.

### Interceptor flow (DG-05/DG-06)
`httpClient.request()` already attached the access token to every request
that has one — DG-06 kept that exact definition of "protected" (no
per-endpoint whitelist introduced). On a 401 for such a request, it calls
the single-flight `refreshAccessToken()` and retries the original request
exactly once with the new token, via an internal-only `isRetryAfterRefresh`
flag never exposed on the public `RequestOptions` type. A second 401 on the
retry fails immediately — no second refresh, no loop. Requests carrying no
token (public endpoints: login/register/forgot-password/...) are entirely
unaffected — unchanged behavior from before this story, verified by the
full pre-existing Web Vitest/E2E suite still passing unmodified.

### Single-flight (DG-03/DG-05/BR-241)
`authRefresh.ts` holds one module-level `Promise` (`inFlightRefresh`).
Every concurrent 401 calls the same function; only the first actually
starts the `POST /auth/refresh` network call — a raw `fetch`, deliberately
never routed through `httpClient` itself, so the refresh call structurally
cannot re-enter (and therefore cannot re-trigger) the interceptor. Every
other caller receives and awaits that same Promise. Proven with real
concurrent 401s both in a Vitest test (`httpClient.test.ts`) and against
the real backend in a real browser (`tests/e2e/refresh-session.spec.ts`,
using React StrictMode's dev-mode double-invoke of an existing page's
data-fetch effect as the source of genuine concurrency — the current UI
has no other page issuing 2+ simultaneous protected requests to trigger
this with).

### Session clearing and redirect (DG-01)
On refresh failure (401 or network error), `authSessionSync.ts` removes
both tokens, writes a cross-tab signal, and redirects via
`window.location.href = "/login"` — a full reload, not a client-side route
change, since the app has no SPA router (`AppRoutes.tsx` is a bespoke
pushState/switch component) and DG-01 explicitly rejected building
navigation infrastructure for this story alone.

### Cross-tab sync (DG-04)
Uses the standard `storage` event — no `BroadcastChannel`, no new
dependency. The browser only fires it in *other* tabs of the same origin,
never the tab that made the write. The listener (`initAuthSessionSync()`,
registered once in `main.tsx`) only redirects — it never writes to
`localStorage` — which is what prevents a cross-tab ping-pong loop by
construction, not by convention.

### Out of scope (confirmed by Decision Gate, not gaps)
- No `AuthContext`/global session state or route guard (DG-02) — only the
  HTTP-layer behavior above.
- No real logout feature/API (DG-03) — CTMS-08 remains a separate story;
  "cross-tab session invalidation" here means propagating a *local* session
  clear, not a logout action.
- No `/auth/me` usage (DG-07) — not needed for this flow.
- No standalone "Refresh Session" screen — this is an integration-only
  task, exactly as scoped in the Jira description.
- Mobile integration is delivered separately, under CTMS-04-T03 (see
  "Mobile Integration" below) — this section covers only the Web client
  (`apps/web`).

### Security
No token ever appears in a request URL, a `console.*` call, or the
cross-tab signal (which carries only a timestamp) — verified by dedicated
tests at all three levels (unit, `httpClient` integration, E2E).

### Test evidence
- Unit: `authRefresh.test.ts` (10), `authSessionSync.test.ts` (8).
- Integration (real `authRefresh`/`authSessionSync`, mocked network only):
  `httpClient.test.ts` (10), including a genuine concurrent-401 test.
- E2E (real backend, real browser): `tests/e2e/refresh-session.spec.ts` (6),
  covering transparent recovery, concurrent collapse, revoked-token
  cleanup, cross-tab propagation, and end-to-end token rotation with no
  leakage. Full existing E2E suite (24 tests across login/register/
  verify-otp/forgot-password) re-run and still passing, confirming no
  regression to the flows this story did not touch.

## Mobile Integration (CTMS-04-T03 — implemented)

This story shipped with no Mobile Integration design on record. The design
below was resolved through this task's own Decision Gate (DG-M1 → DG-M8),
built entirely on top of CTMS-04-T01's API Contract above, and is recorded
here per BR-244. Flutter/Dart (Riverpod + `dio` + `go_router` +
`flutter_secure_storage`), a different stack from the Web client above —
several decisions are deliberately Mobile-specific rather than a port of
the Web design (see DG-M1/DG-M2 below).

### Files
- `apps/mobile/lib/core/storage/token_storage.dart` — `saveTokens()`/
  `readRefreshToken()` added (rotation-only; existing `saveSession()`/
  `readAccessToken()`/`clear()` untouched).
- `apps/mobile/lib/core/api/auth_refresh_coordinator.dart` — single-flight
  refresh coordinator (new).
- `apps/mobile/lib/core/api/api_client.dart` — 401 detection and
  refresh-and-retry `onError` interceptor (existing shared `Dio` wrapper,
  extended in place).
- `apps/mobile/lib/features/auth/application/auth_controller.dart` —
  `clearSession()` extracted as the shared primitive; `logout()` delegates
  to it.
- `apps/mobile/lib/main.dart` — composition root wiring (`ApiClient` ↔
  `AuthController`).
- `apps/mobile/lib/core/lifecycle/app_lifecycle_observer.dart` —
  foreground/background revalidation (new).

### Interceptor flow (DG-M3/DG-M4)
`ApiClient`'s existing `onRequest` interceptor already attached the access
token to every request that has one — DG-M4 kept that exact definition of
"protected" (no per-endpoint whitelist). On a 401 for such a request, its
new `onError` interceptor calls the single-flight
`AuthRefreshCoordinator.refresh()` and retries the original request exactly
once with the new token (the retried request's `Authorization` header is
explicitly overwritten before replay — `dio.fetch()` otherwise resends the
stale one), via an internal-only `extra['isRetryAfterRefresh']` flag (Dio's
own idiomatic per-request metadata slot) never exposed by any public API. A
second 401 on the retry falls through unchanged to the normal error path —
no second refresh, no loop, and NOT treated as a session expiry (only a
failed *refresh* is). Public/unauthenticated requests are entirely
unaffected — unchanged behavior, verified by the full pre-existing Mobile
Vitest/E2E suite still passing unmodified.

### Single-flight (DG-M3)
`AuthRefreshCoordinator` holds one instance-level `Future<String>?`
(`_inFlight`). Every concurrent 401 calls the same `refresh()`; the
check-and-set (`_inFlight ??= ...`) happens in one synchronous expression,
with no `await` between them — Dart's single-threaded event loop (per
isolate) guarantees no other caller can interleave and observe a
half-updated `_inFlight`, the same reasoning `authRefresh.ts` relies on for
JS. The refresh call itself uses a separate `Dio` instance
(`refreshDio`) with no interceptors, so it structurally cannot re-enter
`ApiClient`'s 401-handling. Proven with real concurrent 401s both in a
Flutter test (`api_client_test.dart`) and against the real backend in a
real browser (`integration_test/refresh_session_test.dart`) — the E2E
proof is a black-box one: with single-flight broken, the backend's own
reuse guard (CTMS-04-T01's row-level conditional `UPDATE`) would fail the
second of two concurrent refresh attempts outright, so "both concurrent
requests succeed" is itself sufficient evidence, without needing
call-count instrumentation against the real backend.

### Session clearing (DG-M1/DG-M2)
On refresh failure, `ApiClient` calls a plain `Future<void> Function()?
onSessionExpired` callback — not `AuthController`/`Ref`/`go_router`
directly. `AuthController.clearSession()` (the same primitive `logout()`
now delegates to) clears `TokenStorage` and sets
`state = const AsyncData(null)`; `app_router.dart`'s pre-existing
`redirect` callback (unchanged by this story) reacts to that state and
bounces to `/login` on its own. The wiring between the two —
`apiClientProvider.overrideWith((ref) => ApiClient(..., onSessionExpired:
() => ref.read(authControllerProvider.notifier).clearSession()))` — lives
only in `main.dart`, the composition root; `api_client.dart` itself never
imports `auth_controller.dart` (doing so would cycle back through
`auth_repository.dart` → `auth_api.dart` → `api_client.dart`).

This is a deliberate reversal of the Web client's DG-02 (no global session
state): Mobile already has a real `AsyncNotifier`-backed
`authControllerProvider` and a declarative `go_router` wired to it before
this story, so routing through that existing state (rather than a Web-style
hard `window.location.href` reload) is the natural mechanism here — the
HTTP layer still never touches `BuildContext`/navigation directly.

### Secure token-pair replacement (DG-M5)
`TokenStorage.saveTokens()` writes `refreshToken` **then** `accessToken` —
the reverse of `saveSession()`'s login-time order, on purpose (see that
method's doc comment for the full trace of both write orders). This is
**best-effort sequential persistence, not a transactional atomicity
guarantee** — `flutter_secure_storage` offers no cross-key transaction.

### Foreground/background revalidation (DG-M6)
`AppLifecycleObserver` (a thin `WidgetsBindingObserver`) reacts only to
`AppLifecycleState.resumed`; if authenticated, it invalidates
`camperProfileControllerProvider` — the one real protected provider the
Mobile app has today (`GET /profiles/me`) — so a currently-mounted Profile
screen refetches and naturally exercises the interceptor above if the
access token expired while backgrounded. No `/auth/me`, no JWT decoding, no
timer/polling, no session-check API, and no invalidation of any other
provider — scope frozen exactly at that one call.

### Cold start (DG-M7)
Unchanged from CTMS-03-T03: `AuthRepository.tryRestoreSession()` stays
local-only (a stored token + a decodable cached profile is treated as
"session restored," no network round-trip). A revoked/expired token is
only discovered on the first real protected request after restart — the
same interceptor path as any other 401.

### Out of scope (confirmed by Decision Gate, not gaps)
- No `/auth/me`, no `/auth/logout` API call (DG-M8) — "logout" is still
  local-only `TokenStorage.clear()` + state reset.
- No standalone "Refresh Session" screen — integration-only task, exactly
  as scoped in the Jira description.
- No lifecycle logic inside `ApiClient` — foreground/background handling
  stays entirely in `AppLifecycleObserver`.

### Security
No token ever appears in a request URL, a secure-storage write outside
`flutter_secure_storage`, or a `print`/log call — verified by dedicated
tests (`token_storage_test.dart`'s write-order tests confirm exactly which
keys are touched; `api_client_test.dart` confirms the shared generic
session-expired message never carries a backend-specific reason).

### Test evidence
- Unit: `token_storage_test.dart` (8), `auth_refresh_coordinator_test.dart`
  (10), `app_lifecycle_observer_test.dart` (7), `auth_controller_test.dart`
  `clearSession`/`logout` group (+3).
- Integration (real `AuthRefreshCoordinator`/`AuthController`, only the Dio
  transport faked): `api_client_test.dart` (7), including a genuine
  concurrent-401 test using a real `AuthRefreshCoordinator`.
- E2E (real backend, real Chrome via `flutter drive`):
  `integration_test/refresh_session_test.dart` (6), covering transparent
  recovery, concurrent collapse (real backend reuse-guard proof), app
  background/resume recovery, revoked-refresh-token cleanup + redirect, a
  simulated restart with a valid session, and a simulated restart with an
  already-invalid session. Full pre-existing Mobile E2E suite
  (`integration_test/app_test.dart`, 4 tests) re-run and still passing.

## Task to Acceptance Criteria Traceability
| Acceptance criterion / BR | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: A valid refresh token creates a new access token | CTMS-04-T01, CTMS-04-T02, CTMS-04-T03 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC2: expired or revoked tokens must be rejected | CTMS-04-T01, CTMS-04-T02, CTMS-04-T03 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. | CTMS-04-T01, CTMS-04-T02, CTMS-04-T03 | Tests and review evidence must prove this exact rule is enforced: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. |
| BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data. | CTMS-04-T01, CTMS-04-T02, CTMS-04-T03 | Tests and review evidence must prove this exact rule is enforced: Users may only view or change data they own unless their role and business relationship allow access to another user's data. |
| BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. | CTMS-04-T01, CTMS-04-T02, CTMS-04-T03 | Tests and review evidence must prove this exact rule is enforced: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. |
| BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. | CTMS-04-T01, CTMS-04-T02, CTMS-04-T03 | Tests and review evidence must prove this exact rule is enforced: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. |
| BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. | CTMS-04-T01, CTMS-04-T02, CTMS-04-T03 | Tests and review evidence must prove this exact rule is enforced: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. | CTMS-04-T01, CTMS-04-T02, CTMS-04-T03 | Tests and review evidence must prove this exact rule is enforced: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. |
| BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect. | CTMS-04-T01 | Tests and review evidence must prove this exact rule is enforced: Cases with insufficient permission or unmet business conditions must not create any side effect. |
| BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. | CTMS-04-T01 | Tests and review evidence must prove this exact rule is enforced: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. |
| BR-200: Every change must be written to the audit log. | CTMS-04-T01 | Tests and review evidence must prove this exact rule is enforced: Every change must be written to the audit log. |
| BR-201: Every function requiring authentication may only be performed when the user has a valid login session and the account is active. | CTMS-04-T01 | Tests and review evidence must prove this exact rule is enforced: Every function requiring authentication may only be performed when the user has a valid login session and the account is active. |
| BR-214: Every data relationship must reference an existing and valid record; child records must not be created for resources outside the correct business scope. | CTMS-04-T01 | Tests and review evidence must prove this exact rule is enforced: Every data relationship must reference an existing and valid record; child records must not be created for resources outside the correct business scope. |
| BR-215: Emails must be normalized before comparison and storage; phone numbers must be normalized to a consistent format, preferably E.164. | CTMS-04-T01 | Tests and review evidence must prove this exact rule is enforced: Emails must be normalized before comparison and storage; phone numbers must be normalized to a consistent format, preferably E.164. |
| BR-220: A valid time range must have a start time earlier than the end time, unless the business rule explicitly allows equality. | CTMS-04-T01 | Tests and review evidence must prove this exact rule is enforced: A valid time range must have a start time earlier than the end time, unless the business rule explicitly allows equality. |
| BR-236: Users may only add, delete, or reorder media for resources they own or are authorized to manage. | CTMS-04-T01 | Tests and review evidence must prove this exact rule is enforced: Users may only add, delete, or reorder media for resources they own or are authorized to manage. |
| BR-237: Background jobs must re-check business conditions at execution time and must not rely only on stale state. | CTMS-04-T01 | Tests and review evidence must prove this exact rule is enforced: Background jobs must re-check business conditions at execution time and must not rely only on stale state. |
| BR-011: Locked accounts must not be allowed to log in. | CTMS-04-T01, CTMS-04-T02, CTMS-04-T03 | Tests and review evidence must prove this exact rule is enforced: Locked accounts must not be allowed to log in. |
| BR-012: A valid refresh token must be able to create a new access token. | CTMS-04-T01, CTMS-04-T02, CTMS-04-T03 | Tests and review evidence must prove this exact rule is enforced: A valid refresh token must be able to create a new access token. |

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped BR missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements
- Implement the `Refresh Authentication Session` workflow exactly within `EPIC 1. Authentication`.
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
- Story ID: `CTMS-04`
- Epic: `EPIC 1. Authentication`
- Sprint: `Sprint 1`
- Dependencies: `CTMS-03`
- Linked items: `Blocked by: CTMS-03

Blocks: None`
- Spec Reference: `/file/spec/ctms-04-refresh-authentication-session.md`
- Business Rules workbook: `C:/Users/admin/Downloads/CTMS_Global_Business_Rules_Sprint_1-3.xlsx`
- Story-level BRs: `BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-200, BR-201, BR-214, BR-215, BR-220, BR-236, BR-237, BR-011, BR-012`
