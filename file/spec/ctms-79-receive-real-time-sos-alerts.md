# CTMS-079 — Receive Real-Time SOS Alerts

## 1. Overview

Story: CTMS-079

Epic: EPIC 13. Real-Time Communication

Use Case: Receive Real-Time SOS Alerts

Priority: Must Have

Goal: Deliver newly persisted SOS alerts to an authorized Host through an established WebSocket connection within the defined real-time latency requirement.

Backlog story: As a Host, I want to receive SOS alerts in real time so I can react quickly to emergencies on Trips I manage.

Acceptance Criteria:

| Source  | Criterion                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------ |
| PB AC-1 | Authorized Host receives new SOS through WebSocket when connection is stable.                    |
| PB AC-2 | Delivery latency is <5 seconds from server acceptance/persistence of SOS to Host client receipt. |
| PB AC-3 | Unauthorized Host must not receive the SOS.                                                      |
| PB AC-4 | UI provides an attention signal.                                                                 |
| PB AC-5 | UI provides a way to acknowledge the SOS.                                                        |

## 2. Scope

### In Scope

- SOS WebSocket event.
- Authorized Host.
- <5-second delivery target.
- Attention signal.
- Acknowledge entry point.

### Out of Scope

- SOS creation.
- Acknowledge state mutation — CTMS-080.
- Push notification while app backgrounded — CTMS-090.

## 3. Actors & Authorization

- Authorized Host.
- WebSocket server.
- Host client.

Host must be authorized for the Trip associated with SOS.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-074/076.
- CTMS-078.

SOS has been accepted/persisted by server.

WebSocket connection is stable.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                    |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-260 | Under stable connectivity, an authorized Host must receive a newly accepted/persisted SOS over WebSocket in under 5 seconds, measured from server acceptance/persistence to client receipt. The UI must provide a clear attention signal and an acknowledgement action. |
| BR-259 | A WebSocket connection must validate the JWT, reject invalid or expired tokens, and join the user only to rooms they are authorized to receive.                                                                                                                         |

## 6. State & Lifecycle

SOS persisted
→ WebSocket event emitted
→ authorized Host client receives event
→ attention signal shown
→ Host may acknowledge through CTMS-080.

The WebSocket delivery itself does not mark SOS acknowledged.

## 7. Business Flow

1. Server accepts/persists SOS.
2. Resolve applicable authorized Trip room/Host recipients.
3. Emit SOS event.
4. Authorized connected Host receives event.
5. Measure delivery time.
6. Client displays prominent attention signal.
7. Client exposes acknowledge action.
8. Host acknowledgement invokes CTMS-080.

## 8. Data & Invariants

Latency metric:

`Host client received_at - SOS server accepted/persisted_at < 5 seconds`

under stable-connection test conditions.

Invariants:

- Receipt ≠ acknowledgement.
- Unauthorized Hosts receive nothing.
- SOS must be persisted/accepted before the latency measurement origin described by BR-260.

## 9. API / Integration Contract

WebSocket event schema (defined by CTMS-079-T01, Jira CTMS-357):

- **Connection (BR-259).** The client sends its access token as `io(url, { auth: { token } })`; non-browser clients may send `Authorization: Bearer <token>` instead. On success the server emits `connected` with `{ authenticated: true }` and joins the socket to its own private room `user:{userId}` only. An invalid or expired token, or a user that is not `active`, gets `auth.error` and is disconnected. The server also disconnects the socket when the token expires, and the client reconnects with a fresh token. A socket without a token stays anonymous (`authenticated: false`): it receives only public broadcasts (for example CTMS-083 availability) and never joins a private room.
- **`sos.created`** is emitted only to `user:{trip.hostId}`, after the SOS row and its audit record are persisted:

  ```json
  {
    "eventId": "<sos id>",
    "sosId": "<sos id>",
    "tripId": "<trip id>",
    "senderId": "<user id>",
    "emergencyType": "medical | injury | lost | natural_hazard | other",
    "status": "active",
    "eventTime": "<device trigger time, ISO 8601>",
    "persistedAt": "<server received_at, ISO 8601: BR-260 latency origin>"
  }
  ```

  Location, battery and sender details stay behind the authorized Host API (`GET /api/host/sos-alerts`), following the same pattern CTMS-049 uses for incidents.
- **`sos.state_changed`** (CTMS-077/080) is emitted only to the Trip Host room and the SOS sender room. Its payload is unchanged.
- **Missed events.** Socket.io does not replay events. After reconnecting, the client reloads open SOS through `GET /api/host/sos-alerts?status=active` and dedupes by `eventId`/`sosId`.

## 10. Error & Edge Cases

| Case                                    | Expected Behavior                                    |
| --------------------------------------- | ---------------------------------------------------- |
| Stable connection                       | Event delivered                                      |
| Unauthorized Host                       | No event                                             |
| Host disconnected                       | Real-time WebSocket guarantee does not falsely apply |
| Event displayed                         | Attention signal shown                               |
| Event received                          | SOS remains unacknowledged until explicit action     |
| Delivery >=5s under defined stable test | Performance AC fails                                 |

## 11. Acceptance & Test Matrix

| Source | Scenario              | Expected Result              | Test Type   |
| ------ | --------------------- | ---------------------------- | ----------- |
| BR-260 | Stable WebSocket      | SOS received                 | E2E         |
| BR-260 | Measure server→client | <5 seconds                   | Performance |
| BR-259 | Unauthorized Host     | No event                     | Security    |
| BR-260 | SOS received          | Attention signal             | UI          |
| BR-260 | SOS received          | Acknowledge action available | UI          |

## 12. Open Decisions

~~Performance test environment must define what qualifies as a stable connection, while retaining the <5-second metric defined by BR-260.~~

**Resolved (approved with the CTMS-357 plan):** for acceptance tests, a "stable connection" means the API and client run on localhost/LAN over the WebSocket transport, with no injected latency, packet loss or reconnects during the measurement. The metric is unchanged: `client received_at − persistedAt < 5 s`.

## 13. Implementation Record — CTMS-079-T01 (Jira CTMS-357), Preparation + Logic

Backend only (`services/api`). The Host client UI (attention signal, acknowledge entry point, sending the token) belongs to the UI subtask.

**Findings on `develop` before this task**

- `sos.created` and `sos.state_changed` were sent with `server.emit`, so every connected socket received them, including anonymous sockets and Hosts of other Trips (PB AC-3 / BR-259 violated). `sos.state_changed` also carried the cancellation reason and resolution note.
- The gateway did not validate JWTs and had no rooms.
- Any anonymous client could call the `emergency.broadcast` handler, which re-broadcast arbitrary payloads to everyone as `emergency.alert`. No client used it.

**Changes**

- **Socket authentication (BR-259)** in `realtime/events.gateway.ts` (`handleConnection`):
  - The token is verified with `JwtService` (same `JWT_SECRET` as the HTTP `JwtStrategy`; `RealtimeModule` now imports `JwtModule` and `UsersModule`). The user must exist and be `active`, the same rule `JwtStrategy.validate` applies.
  - On success the socket joins only `user:{userId}`. Recipients are decided by the server from the database when it emits; a client can never subscribe itself to a Trip or Host room.
  - On failure the server emits `auth.error` and disconnects.
  - A timer disconnects the socket at the token's `exp`, so a socket never outlives its access token. Timers are cleared on disconnect and on module destroy.
  - Sockets without a token stay anonymous for the existing public broadcasts. Rejecting them would break CTMS-083 availability updates on public pages.
- **Authorized routing (BR-260, PB AC-1/AC-3).**
  - `SosService.createSos` reuses the Trip it already loads for the participant check and emits `sos.created` to `user:{trip.hostId}` only after the SOS row and its `SOS_CREATED` audit row are saved. A failed save emits nothing.
  - cancel, acknowledge and close emit `sos.state_changed` to the Host and sender rooms only.
  - The authorized Host is `trips.host_id`, the same rule CTMS-080 `assertTripHost` uses.
- **Event identity.**
  - `eventId = sosId`: each persisted SOS is emitted exactly once, so retries of the delivery path and reconnects never create a second event identity.
  - `sosId` is the identity used by CTMS-080 acknowledgement.
  - `persistedAt` (`received_at`) is the latency origin.
  - Receipt does not change any state; the SOS stays `active` until CTMS-080.
- **Removed `emergency.broadcast` / `emergency.alert`** (unauthenticated spoofing path, no consumer).
- `socket.io-client@^4.8.1` (the version the web app already uses) was added to `services/api` devDependencies for the integration test only.

**Judgment calls** (the spec is silent; approved with the plan):

1. `sos.state_changed` is routed to the Host and the sender only. Other Trip participants get no socket notification for now; no client listens to this event yet, and participants can read the state through `GET /trips/:tripId/sos`. See Pending Decision PD-1.
2. The `sos.created` payload is minimal (identity, classification, timestamps). Details are fetched through the authorized Host API.
3. "Stable connection" is defined in Section 12.
4. Anonymous sockets are still accepted (they receive public events only).

**Pending Decisions**

- **PD-1:** should other Trip participants (Campers/Porters who are not the sender) receive `sos.state_changed` in real time? That would need per-Trip participant rooms joined from server-side membership.
- **PD-2 (outside this task, reported only):** `POST /trips/:tripId/sos` has no client idempotency key. An offline/retried submit (CTMS-076) therefore persists and delivers a second SOS. `createSos` also saves the SOS and its audit row without a shared transaction. Both belong to CTMS-074/076.

## 14. Test Evidence

- **Unit**
  - `realtime/events.gateway.spec.ts` (new, 10 tests):
    - valid token joins only its own room;
    - Bearer header accepted;
    - no token stays anonymous;
    - invalid/expired token rejected;
    - missing and suspended user rejected;
    - socket disconnected at token expiry;
    - expiry timer cleared on disconnect;
    - `sos.created` goes only to the Host room, never `server.emit`;
    - `sos.state_changed` goes only to the Host and sender rooms.
  - `sos/sos.service.spec.ts`: 3 new tests (emit only after SOS + audit persisted; Porter-raised SOS still routed to the Trip Host; no emit when persistence fails). 4 existing assertions were updated for the new `hostId` argument and the full payload.
  - Full suite: `pnpm test` → 1710/1710 passed (151/151 suites).
- **Integration** (`test/sos-realtime-delivery.integration-spec.ts`, real Postgres + real socket.io server on `app.listen(0)` with `socket.io-client`, no mocks), 6 tests:
  - BR-260: the Host receives `sos.created` with the persisted identity, and `received_at − persistedAt < 5 000 ms`; the row stays `active` / unacknowledged.
  - PB AC-3: another Host, the non-Host sender and an anonymous socket receive nothing (observed for 1 s after the Host's receipt).
  - BR-259: a malformed token and an expired token are rejected with `auth.error` and disconnected; a suspended Host with an unexpired token is rejected.
  - Two Host tabs each receive exactly one copy. After disconnecting and reconnecting, no event is replayed or duplicated, and the missed SOS is recovered through `GET /api/host/sos-alerts?status=active`.
  - `sos.state_changed` (acknowledge) reaches the Host and the sender but not another Host or an anonymous socket.
  - Mutation check: temporarily restoring the old `server.emit("sos.created")` made the PB AC-3 test fail (1 failed / 5 passed). The code was then restored.
  - Existing `sos-handling` and `sos-cancellation` integration suites still pass.
  - Full suite: `pnpm test:integration` (8 shards) → 511/522 passed (52/56 suites). The 11 failures are pre-existing on `develop`: the same 11 tests fail identically with this task's changes stashed. They are not caused by this task and are not fixed here:
    - `sync-evaluation` ×4: `sync-evaluation.service.ts:650` joins `booking_members.trip_id`, which does not exist (CTMS-097);
    - `overbooking-evaluation` ×4;
    - `trekking-route-checkpoints` ×2;
    - `incidents.report` ×1.
- `pnpm build` and `pnpm lint` pass clean; biome reports no issue in any changed file.
- Backend-only task: no UI, so no screenshots.

### Logic Subtask DoD

- [x] Logic implementation completed.
- [x] Applicable business rules and invariants implemented.
- [x] Task-specific unit tests added or updated.
- [x] Task-specific unit tests passed.
- [x] Applicable backend or integration tests passed.

## 15. Implementation Record — CTMS-079-T02 (Jira CTMS-358), Host web UI

Web client only (`apps/web`); it consumes the CTMS-357 contract in Section 9. The existing team UI is reused: the red `EmergencyAlertBanner`, the SOS center page, the CTMS-080 acknowledge modal, the shared `Toast` and the shared `StatusBadge`. The only new visible element is the delivery-state badge, approved with the plan.

**Before this task on `develop`**, the Host saw SOS only through polling: 30 s on the dashboard and 15 s on the SOS center. The web app did not open an authenticated socket, and after CTMS-357 an anonymous socket never receives SOS. A Host on any page other than the dashboard had no attention signal at all.

**Changes**

- **`useHostSosRealtime`** (`features/sos-handling/hooks`).
  - Connection:
    - Opens one socket.io connection with `auth: (cb) => cb({ token })`. The access token is re-read from storage on every (re)connect, so a refreshed token is always used.
    - On `auth.error` (invalid/expired token, including the server's disconnect at token expiry), the hook calls the existing single-flight `refreshAccessToken()` once and reconnects. If the refresh fails, it stays `disconnected`.
  - Delivery state:
    - `connecting`, then `live` only after the server confirms `connected { authenticated: true }`. An anonymous socket is reported as `disconnected`, because it can never receive SOS.
    - `disconnect` or `connect_error` → `disconnected`.
    - The next authenticated connect → `recovered` for 5 s, then `live`.
  - No fabricated SOS:
    - `sos.created` and `sos.state_changed` never become UI rows. They only invalidate the Host SOS list (`["sos","host-list"]`) and the dashboard overview (`["host-overview"]`) queries, so what is shown always comes from the authorized API.
    - Malformed payloads (no `sosId`) are ignored.
    - Every authenticated connect also reloads both queries, which recovers SOS missed while offline.
  - Dedupe:
    - `created:{eventId}` and `state:{sosId}:{status}` keys are kept in a bounded (200) module-level set.
    - Every Host route renders its own `HostLayout`, so a remount does not re-alert an SOS that was already announced in the tab.
  - The existing polling is unchanged and stays as the fallback.
- **Attention signal (PB AC-4).**
  - A new SOS raises the existing error toast "Yêu cầu cứu trợ khẩn cấp — <loại> · Mã chuyến: <8 ký tự>" on any Host page, once per SOS.
  - The dashboard banner and the SOS center table refresh immediately.
  - State changes refresh the lists without a new toast.
- **Acknowledge entry point (PB AC-5).** The existing banner "Tiếp nhận ngay" → CTMS-080 modal "Tiếp nhận SOS", and the SOS center detail modal, are unchanged. The Toast component has no action slot, and it was not modified.
- **`HostSosRealtimeProvider`.** It renders nothing and is enabled only for the `host` role. It is mounted in `HostLayout` (every Host route) and around `DashboardMain` in `RoleLandingPage`, because the dashboard has its own layout and does not use `HostLayout`.
- **`SosRealtimeStatus`.** Built on the shared `StatusBadge`. It sits under the SOS center subtitle and above the dashboard banner:
  - `live`: success tone, "Đang nhận cảnh báo SOS theo thời gian thực";
  - `disconnected`: warning tone, "Mất kết nối thời gian thực — đang thử lại, danh sách vẫn tự cập nhật định kỳ";
  - `recovered`: info tone, "Đã kết nối lại — đã tải lại các SOS có thể bị lỡ";
  - `connecting`: neutral tone.

  It uses `aria-live="polite"`.
- `EMERGENCY_LABELS` in `EmergencyAlertBanner` is now exported so the toast uses the same wording as the banner.
- **Real-backend E2E harness**, following the CTMS-049/CTMS-378 pattern:
  - `services/api/test/e2e/start-sos-realtime-server.ts` (API on 3019, database `ctms_79_test`, isolated JWT secret);
  - `apps/web/playwright.sos-realtime.config.ts` (web on 5189) and the script `pnpm --filter @ctms/web test:e2e:sos-realtime`;
  - the spec is excluded from the default Playwright config.

**Judgment calls** (approved with the plan):

1. Reuse existing components; the status badge is the only new UI.
2. An SOS missed while offline is recovered into the lists and the banner on reconnect, but no toast is raised for it. Toasts mean "just arrived in real time"; the `recovered` badge tells the Host the list was reloaded.
3. Dedupe is per browser tab (module memory). A full page reload starts clean and shows the authoritative lists.

**Findings outside this task (pre-existing on `develop`, not fixed here)**

- `RoleLandingPage` renders `HostDashboardOverview` twice: in the sticky header and again in the body. The KPI row, the SOS banner (and now its status badge) therefore appear twice on the Host dashboard. This also makes `src/routes/AppRoutes.trekking-route.test.tsx` fail (2 tests, "multiple elements … Tuyến của tôi"), with or without this task. It needs its own Jira task (CTMS-378 owner).

## 16. Test Evidence — CTMS-079-T02

- **Unit/component (Vitest)**
  - `hooks/useHostSosRealtime.test.tsx` (13 tests):
    - authenticated socket re-reads the token on each connect;
    - `live` only after server-confirmed auth; anonymous socket → `disconnected`;
    - new SOS reloads both queries and raises one toast;
    - duplicate delivery deduped; no re-alert after a layout remount;
    - malformed payload ignored; state change reloads without a toast;
    - disconnect → recovered (with reload) → live after 5 s; `connect_error` → disconnected;
    - `auth.error` refreshes once and reconnects; failed refresh stays disconnected;
    - disabled → no socket; unmount disconnects.
  - `components/SosRealtimeStatus.test.tsx` (5 tests): hidden outside a Host session, plus each of the four states.
  - Affected features (sos-handling, role-landing, host-overview): 21 files / 110 tests passed.
- **Task E2E (real API + Postgres + socket.io)**: `tests/e2e/ctms-79-t02-receive-real-time-sos-alerts.spec.ts`, 2 tests. Passed, and 3/3 with `--repeat-each=3`.
  1. The authorized Host on the dashboard gets the toast and the banner for a Camper-raised SOS within the 5 s budget (measured 60–81 ms from `persistedAt`). The dashboard polls every 30 s, so this delivery is the socket. Another Host gets nothing. The SOS stays `active` after receipt. "Tiếp nhận ngay" → "Tiếp nhận SOS" acknowledges it and the banner disappears.
  2. The SOS center shows `live`, receives a new row in real time, switches to `disconnected` when the browser goes offline, and switches to `recovered` on reconnect with the SOS raised while offline loaded from the API. It then settles back to `live`.

  Mutation check: disabling the hook's `sos.created` handler made test 1 fail (banner not visible within 5 s). The code was then restored.

  Screenshots from the running app (Playwright output):
  - `host-dashboard-sos-realtime.png`
  - `host-sos-center-disconnected.png`
  - `host-sos-center-recovered.png`
- **Gates**
  - `pnpm lint:all`: 0 errors (12 pre-existing warnings, none in changed files).
  - `pnpm build:all`: passed.
  - `pnpm test:all`:
    - API 1710/1710 passed;
    - web 1493/1495 passed. The 2 failures are the pre-existing `AppRoutes.trekking-route.test.tsx` failures above, which reproduce identically with this task stashed.
  - Default Playwright E2E regression: 41 passed / 36 failed / 32 did not run. The **identical** 36 tests fail and the same 32 do not run on a clean `develop` worktree (same machine, same DB), so this task adds no E2E regression. The failures are environmental or pre-existing: `seed:dev-admin` / `main.seed.ts` / `dev-host-route.seed.ts` seed commands failing, outdated selectors in booking/route-safety/trip-draft flows, and the duplicated dashboard overview.

### UI Subtask DoD

- [x] UI implementation completed.
- [x] Applicable client-side behavior implemented.
- [x] Task-specific unit/component tests passed.
- [x] Backend integration completed.
- [x] Task-specific E2E tests passed.
- [x] All Story Acceptance Criteria verified (PB AC-1…AC-5: E2E 1 and 2; AC-2 measured 60–81 ms).
- [x] Unit regression tests passed (except the 2 pre-existing `develop` failures listed above).
- [x] E2E regression tests passed: no new failure vs `develop` (the 36 identical pre-existing failures are listed above).
- [x] lint:all passed.
- [x] build:all passed.
- [x] test:all passed (except the 2 pre-existing `develop` failures listed above).
- [ ] Required CI checks passed — runs on the PR.
