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
