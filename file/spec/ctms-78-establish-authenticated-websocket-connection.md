# CTMS-078 — Establish Authenticated WebSocket Connection

## 1. Overview

Story: CTMS-078

Epic: EPIC 13. Real-Time Communication

Use Case: Establish Authenticated WebSocket Connection

Priority: Must Have

Goal: Establish a real-time connection only for authenticated users and restrict subscriptions/rooms to resources the user is authorized to receive.

Backlog story: As an authenticated user, I want a secure real-time connection so I receive only events I am authorized to see.

Acceptance Criteria:

| Source  | Criterion                                                      |
| ------- | -------------------------------------------------------------- |
| PB AC-1 | WebSocket connection validates JWT.                            |
| PB AC-2 | Invalid token is rejected.                                     |
| PB AC-3 | Expired token is rejected.                                     |
| PB AC-4 | User joins only rooms the user is authorized to receive.       |
| PB AC-5 | Authentication alone does not grant arbitrary Trip/role rooms. |

## 2. Scope

### In Scope

- WebSocket authentication.
- JWT validation.
- Invalid/expired rejection.
- Authorized room membership.

### Out of Scope

- SOS creation.
- SOS business lifecycle.
- Automatic reconnection — CTMS-082.
- Notification preferences.

## 3. Actors & Authorization

- Authenticated User.
- WebSocket gateway/server.

Authorization is evaluated for each applicable room/resource.

## 4. Preconditions & Dependencies

User has authentication credential/token.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-259     | A WebSocket connection must validate the JWT, reject invalid or expired tokens, and join the user only to rooms they are authorized to receive.                                                                                                                                                         |
| BR-170     | Any function requiring authentication may execute only when the user has a valid authenticated session and the account is in active status.                                                                                                                                                             |
| BR-171     | Any function requiring an active account must re-check account status on the backend at request time. pending_verification, suspended, or deleted accounts must be denied even when the client still holds an older access token/session, except for explicitly allowed verification or recovery flows. |
| BR-172     | Access control must be enforced by the backend using role, ownership, and business scope. Hiding or disabling functionality in the UI is not a substitute for backend authorization.                                                                                                                    |

## 6. State & Lifecycle

Disconnected
→ connection request
→ token validation.

Valid + authorized:
→ connected
→ authorized rooms joined.

Invalid/expired:
→ rejected/disconnected.

## 7. Business Flow

1. Client requests WebSocket connection.
2. Present authentication credential.
3. Validate JWT.
4. Reject invalid/expired token.
5. Resolve user identity/roles/relationships.
6. Determine authorized rooms.
7. Join only authorized rooms.
8. Maintain connection until disconnect/invalid lifecycle event.

## 8. Data & Invariants

- Connected identity comes from validated authentication.
- Room membership requires authorization.
- Valid token does not imply access to every Trip/room.
- Invalid/expired token cannot receive protected events.

## 9. API / Integration Contract

Defined by CTMS-078-T01 (Jira CTMS-355), socket.io on the API origin:

- **Handshake.** The client sends the access token as `io(url, { auth: { token } })`; non-browser clients may send `Authorization: Bearer <token>` instead. The server verifies the JWT and loads the user from the database; the account must be `active`.
  - On success, the server emits `connected` with `{ authenticated: true, rooms: ["user:{id}", "role:{role}"...] }`. Role rooms are the roles granted in the database (`user_roles`), never the token's `roles` claim.
  - An invalid, expired or foreign-signed token, or a `pending_verification` / `suspended` / `deleted` account, gets `auth.error` and is disconnected.
  - The socket is also disconnected when its token expires; reconnecting with a refreshed token is CTMS-082.
  - A socket without a token is accepted as anonymous (`{ authenticated: false }`). It joins no room and receives only public broadcasts (see Section 12).
- **`trip.subscribe { tripId }`** returns an ack:
  - `{ ok: true, room: "trip:{tripId}" }` when the server-owned relationship allows it: the Trip's Host, a Camper whose booking member status is `registered` or `joined` on a confirmed/completed Booking, or a Porter whose `trip_porters` status is `assigned`.
  - Otherwise `{ ok: false, error }`, where `error` is `NOT_AUTHENTICATED` (anonymous socket), `INVALID_TRIP_ID` (not a UUID), `TRIP_NOT_FOUND` or `NOT_TRIP_MEMBER`. The socket does not join any room.
- **`trip.unsubscribe { tripId }`** leaves the room and acks `{ ok: true, room }`.
- **No other path into a room exists.** Room membership is never carried over a reconnect; the client subscribes again and is re-authorized.
- **Event routing:**

  | Event | Rooms |
  | --- | --- |
  | `trip.review.requested` / `updated` / `reminder` | `role:admin` |
  | `trip.review.auto_rejected` | `user:{hostId}`, `role:admin` |
  | `porter.request.created` / `state_changed` | `user:{porterId}`, `user:{requestedBy}` |
  | `trip.incident.reported` | `trip:{tripId}`, `user:{hostId}` |
  | `trip.incident.updated` | `trip:{tripId}`, `user:{hostId}`, `user:{assignedTo}` when set |
  | `sos.created` | `user:{hostId}` (CTMS-079) |
  | `sos.state_changed` | `user:{hostId}`, `user:{senderId}` (CTMS-079) |
  | `trip.availability.updated` | all sockets: public seat counts (CTMS-083) |

## 10. Error & Edge Cases

| Case                            | Expected Behavior          |
| ------------------------------- | -------------------------- |
| Valid JWT                       | Authentication may proceed |
| Invalid JWT                     | Reject                     |
| Expired JWT                     | Reject                     |
| Valid JWT, unauthorized Trip    | Do not join Trip room      |
| Host authorized for Trip A only | No Trip B room             |
| Connection drops                | CTMS-082 handles reconnect |

## 11. Acceptance & Test Matrix

| Source | Scenario          | Expected Result          | Test Type     |
| ------ | ----------------- | ------------------------ | ------------- |
| BR-259 | Valid JWT         | Connection authenticated | Security      |
| BR-259 | Invalid JWT       | Rejected                 | Security      |
| BR-259 | Expired JWT       | Rejected                 | Security      |
| BR-259 | Authorized room   | Joined                   | Authorization |
| BR-259 | Unauthorized room | Not joined               | Authorization |

## 12. Open Decisions

~~WebSocket technology/provider and token-refresh handshake belong to Technical Design.~~ Resolved: socket.io, with the access token in the handshake (Section 9). Refresh and reconnect belong to CTMS-082.

**Decision (approved with the CTMS-355 plan): anonymous sockets.** Section 1 says connections are for authenticated users only, but the CTMS-083 public Trip availability feed is used by visitors who are not logged in. Anonymous sockets are therefore accepted. They join no room and can receive only `trip.availability.updated`. Every protected event is room-scoped, so the invariant "invalid/expired token cannot receive protected events" holds.

## 13. Implementation Record — CTMS-078-T01 (Jira CTMS-355), Preparation + Logic

Backend only (`services/api/src/modules/realtime`). It builds on the handshake authentication added by CTMS-357 (CTMS-079-T01).

**State on `develop` before this task**

- The JWT was already verified, invalid/expired tokens were rejected, active status was checked, and each socket joined `user:{id}` (CTMS-357).
- There were no role rooms and no Trip rooms, and no way to request a room with server-side authorization.
- `trip.review.*`, `porter.request.*` and `trip.incident.*` were still sent with `server.emit`. Every socket, including anonymous ones and users with no relationship to the Trip, received them.

**Changes**

- **Role rooms (BR-172).** On connect the socket joins `user:{id}` plus `role:{role}` for each role from `UsersRepository.getGrantedRoles` (database). A token claiming `admin` for a camper account joins only `role:camper`. The resolved identity `{ userId, roles }` is kept in `socket.data.identity` and the session map for downstream delivery. `connected` lists the joined rooms.
- **`trip.subscribe` / `trip.unsubscribe` (PB AC-4/AC-5).**
  - The Trip relationship is read from the database on every subscribe through the existing `GpsParticipationSource`. `RealtimeModule` now imports `GpsTrackingModule`, which does not import `RealtimeModule`, so there is no cycle.
  - Authorized: the Host of the Trip, a Camper `registered` or `joined`, an assigned Porter.
  - Refused: a Host of another Trip, a Camper who `left` / was `removed` / `no_show`, an unassigned Porter, an Admin with no Trip relationship, an anonymous socket.
  - Malformed ids are rejected before any database access.
  - If the socket drops while authorization is running, it is not joined.
- **Scoped routing.** Every protected event now goes only to its rooms (Section 9). The payloads already carried the needed ids, so no caller changed. `trip.availability.updated` is the only remaining global broadcast.

**Judgment calls** (the spec is silent; approved with the plan):

1. Anonymous sockets are kept for public events only (Section 12).
2. "Trip team" for the Trip room is Host, `registered`/`joined` Campers and `assigned` Porters. `registered` is included so pre-start Campers can receive Trip events. Admins are not Trip members; they receive review events through `role:admin`.
3. The Trip-room decision is made at subscribe time. If the relationship changes later (for example a Camper leaves), the socket stays in the room until it unsubscribes or reconnects. The access-token lifetime bounds this, because the socket is disconnected at token expiry. See PD-2.
4. Error codes are returned in the ack. No exception reveals whether the Trip exists beyond `TRIP_NOT_FOUND`, which a member can already learn through the REST API.

**Pending Decisions**

- **PD-1 (client follow-up, CTMS-078-T02).** The web hooks `useAdminTripReviewNotifications` and `useHostTripReviewNotifications` (`apps/web/src/features/trips/hooks/useTripReviewNotifications.ts`) still connect without a token. After this change they no longer receive review toasts; their lists still refresh through their existing refetch. They must send `auth: { token }`, as `useHostSosRealtime` does. Clients that want incident events must call `trip.subscribe`.
- **PD-2.** Should an active Trip-room membership be revoked immediately when the Trip relationship ends, or when the account is suspended mid-connection? Today both are bounded by unsubscribe/reconnect and the token expiry. Immediate revocation needs those business flows to call the gateway.

## 14. Test Evidence

- **Unit:** `realtime/events.gateway.spec.ts` now has 39 tests (29 new). They cover:
  - user and DB-granted role rooms, and `socket.data.identity`;
  - a token that claims `admin` for a non-admin user;
  - Trip subscribe allowed for the Host, a `registered` Camper, a `joined` Camper and an assigned Porter;
  - Trip subscribe refused for a Host of another Trip, a `left` / `removed` / `no_show` Camper, an unassigned Porter, an unknown Trip, 5 malformed bodies, an anonymous socket, and a socket dropped during authorization;
  - unsubscribe;
  - each of the 8 protected events routed only to its rooms, with no `server.emit`;
  - an incident without an assignee;
  - availability still public.

  Full suite: `pnpm test` → 1785/1785 passed (154/154 suites).
- **Integration** (`test/websocket-auth.integration-spec.ts`, real Postgres + real socket.io server + `socket.io-client`, no mocks): 26 passed.
  - PB AC-1..AC-3: valid JWT, malformed token, foreign-signed token, expired token, and `suspended` / `pending_verification` / `deleted` accounts.
  - Anonymous socket joins no room.
  - BR-172: a camper token claiming `admin` gets no `role:admin` and no admin review event, while the real Admin receives it.
  - PB AC-4/AC-5:
    - Host, `joined` and `registered` Camper, and assigned Porter can join;
    - Host of Trip B only, `left` Camper, unassigned Porter, unrelated user and Admin are refused;
    - anonymous socket, unknown Trip and malformed id are refused;
    - Host B gets Trip B's room but not Trip A's.
  - A Trip incident event reaches the authorized subscriber but not the refused or anonymous sockets.
  - Unsubscribe stops events. A reconnect does not keep Trip room membership, and a revoked relationship is refused on the next subscribe.
  - Porter requests and review auto-rejection reach only their parties; public availability still reaches anonymous visitors.
  - Mutation check: temporarily skipping the Trip-room authorization made 8 tests fail. The code was then restored.
  - Existing realtime suites (`sos-realtime-delivery`, `porter-level-requests`) still pass.
  - Full suite: `pnpm test:integration` (8 shards) → 559/570 passed (54/58 suites). The 11 failures are the same pre-existing `develop` failures recorded in CTMS-079 Section 14, unrelated to realtime:
    - `sync-evaluation` ×4;
    - `overbooking-evaluation` ×4;
    - `trekking-route-checkpoints` ×2;
    - `incidents.report` ×1 (a REST role check).
- `pnpm build` and `pnpm lint` pass; biome is clean on every changed file.
- Backend-only task: no UI, so no screenshots.

### Logic Subtask DoD

- [x] Logic implementation completed.
- [x] Applicable business rules and invariants implemented (BR-259, BR-170, BR-171 at connect, BR-172).
- [x] Task-specific unit tests added or updated.
- [x] Task-specific unit tests passed.
- [x] Applicable backend or integration tests passed.
