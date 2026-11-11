# CTMS-082 — Automatically Reconnect WebSocket

## 1. Overview

Story: CTMS-082

Epic: EPIC 13. Real-Time Communication

Use Case: Automatically Reconnect WebSocket

Priority: Must Have

Goal: Restore real-time communication after an unexpected WebSocket interruption without creating duplicate subscriptions or missing eligible events.

Backlog story: As a user, I want the application to automatically reconnect when the WebSocket connection is interrupted so real-time features recover without manual intervention.

Acceptance Criteria:

| Source  | Criterion                                                                |
| ------- | ------------------------------------------------------------------------ |
| PB AC-1 | Client automatically attempts reconnection after WebSocket interruption. |
| PB AC-2 | Reconnection uses bounded backoff.                                       |
| PB AC-3 | Authentication and authorization are re-established as applicable.       |
| PB AC-4 | Authorized room subscriptions are restored.                              |
| PB AC-5 | Eligible missed events are recovered.                                    |
| PB AC-6 | Reconnection/recovery must not produce duplicate events.                 |

## 2. Scope

### In Scope

- Automatic reconnect.
- Bounded backoff.
- Authorized subscription restoration.
- Missed-event recovery.
- Duplicate prevention.

### Out of Scope

- Initial WebSocket authentication — CTMS-078.
- Business-specific SOS acknowledgement.
- Push notifications.

## 3. Actors & Authorization

- Authenticated client.
- WebSocket server.

Restored subscriptions must still pass current authorization.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-078.

A previously established WebSocket connection has been interrupted.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-263     | When a WebSocket connection drops, the client must reconnect using bounded backoff, restore authorized room subscriptions, and recover eligible missed events without duplication.    |
| BR-259     | A WebSocket connection must validate the JWT, reject invalid or expired tokens, and join the user only to rooms they are authorized to receive.                                       |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done. |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.          |

## 6. State & Lifecycle

`connected`
→ `disconnected`
→ `reconnecting`
→ authenticated
→ authorized subscriptions restored
→ missed events recovered
→ `connected`

Failed attempts remain within bounded retry/backoff behavior.

## 7. Business Flow

1. Client detects WebSocket disconnection.
2. Enter reconnecting state.
3. Wait according to bounded backoff.
4. Attempt authenticated connection.
5. Revalidate authorization.
6. Restore currently authorized room subscriptions.
7. Recover eligible missed events.
8. Deduplicate recovered/live events.
9. Return to connected state.

## 8. Data & Invariants

- Reconnection must not bypass authentication.
- Previous room membership is not sufficient proof of current authorization.
- Missed/live copies of the same event must not be displayed twice.
- Backoff must be bounded rather than increasing without limit.

## 9. API / Integration Contract

Transport: socket.io on the CTMS-078 gateway; the access token is sent in the handshake (`auth: { token }`) on every (re)connect.

- **`connected` (server → client)**, sent after every handshake:
  - `authenticated`, `rooms` (as in CTMS-078);
  - `latestSequence: number | null`: the recovery cursor at connect time (null for anonymous sockets or when the event store is unavailable);
  - `reconnect: { initialDelayMs, maxDelayMs, multiplier, jitterRatio }`: the bounded backoff the client follows (defaults 1000 / 30000 / 2 / 0.2, env `REALTIME_RECONNECT_*`). The delay of attempt *n* is `min(maxDelayMs, initialDelayMs × multiplier^(n−1))` ± jitter, never above `maxDelayMs`.
- **Protected live events** keep their payload and get a second argument `meta = { eventId, sequence, emittedAt }`:
  - `eventId` is the event identity used for deduplication; events that already had one (SOS `eventId`, emergency broadcast `eventId`, weather forecast `eventId`) keep it;
  - `sequence` is the recovery cursor (null only if the event could not be stored; it is still delivered live but cannot be recovered);
  - `trip.availability.updated` (public, anonymous) is not stored and has no `meta`.
- **`realtime.resume` (client → server, with ack)**, body `{ afterSequence: number }` (the highest `sequence` the client has seen, or `latestSequence` from `connected`):
  - `{ ok: true, events: [{ event, payload, meta }], latestSequence, truncated }`, events in cursor order;
  - only events addressed to the caller's user id, to a role the caller holds **now** (database), or to a Trip the caller belongs to **now** (Host, Camper registered/joined, assigned Porter — the `trip.subscribe` rule);
  - `truncated: true` when not every missed event can be returned: a missed event is past the retention window (default 24 h, `REALTIME_EVENT_RETENTION_HOURS`) or already pruned, the cursor was never issued, or there are more than the limit (default 200, `REALTIME_RESUME_LIMIT`). The client then reloads its data over HTTP;
  - `{ ok: false, error: "NOT_AUTHENTICATED" }` for an anonymous socket, or when the account is no longer active (the socket also gets `auth.error` and is disconnected);
  - `{ ok: false, error: "INVALID_CURSOR" }` when `afterSequence` is not a non-negative integer.
- Trip rooms are still restored only through `trip.subscribe` after each reconnect (CTMS-078); the server never carries room membership over a connection.

## 10. Error & Edge Cases

| Case                                | Expected Behavior                                                |
| ----------------------------------- | ---------------------------------------------------------------- |
| Temporary disconnect                | Reconnect automatically                                          |
| Repeated failure                    | Bounded backoff                                                  |
| Authorization changed while offline | Restore only currently authorized rooms                          |
| Missed event recovered              | Display once                                                     |
| Same event also arrives live        | Deduplicate                                                      |
| Token invalid/expired               | Do not restore protected connection without valid authentication |

## 11. Acceptance & Test Matrix

| Source     | Scenario                       | Expected Result           | Test Type   |
| ---------- | ------------------------------ | ------------------------- | ----------- |
| BR-263     | Connection drops               | Reconnect starts          | Integration |
| BR-263     | Multiple failures              | Bounded backoff           | Reliability |
| BR-259/263 | Reconnect                      | Authorization revalidated | Security    |
| BR-263     | Authorized rooms               | Restored                  | Integration |
| BR-263     | Missed event                   | Recovered                 | E2E         |
| BR-263     | Duplicate recovered/live event | Display once              | Idempotency |

## 12. Open Decisions

~~Exact backoff parameters belong to Technical Design/configuration.~~ Resolved by CTMS-363: defaults 1 s doubling to 30 s with 20% jitter, configurable through `REALTIME_RECONNECT_*` and sent to clients in `connected`.

**Pending Decisions**

- **PD-1.** Retention 24 h and resume limit 200 are defaults chosen for this task; the leader may change them (env only).
- **PD-2.** Immediate revocation of an active Trip-room membership when the relationship ends stays CTMS-078 PD-2. Recovery itself always checks the current membership.
- **PD-3.** Recovered events are not re-filtered by business state (for example an SOS that was closed while the client was offline is still returned with its original payload); clients reload the affected screen, as they already do after a reconnect.

## 13. Implementation Record — Logic (Jira CTMS-363, CTMS-082-T01)

- **What already existed (CTMS-078/355/356):** every handshake re-verifies the JWT and the account, rejects invalid/expired tokens with `auth.error`, and joins only the user room and database role rooms; Trip rooms need a fresh authorized `trip.subscribe`; the web client already reconnects and re-subscribes.
- **New table `realtime_events`** (migration `1794900000000-CreateRealtimeEvents`): `id` uuid (event identity, primary key), `sequence` bigserial (cursor, unique), `event_name`, `payload` jsonb, frozen audience `user_ids` uuid[] / `roles` varchar[] / `trip_id`, `created_at` (= `meta.emittedAt`); indexes on `created_at` and GIN on `user_ids`.
- **`modules/realtime/realtime-events.repository.ts`:** append (`ON CONFLICT ("id") DO NOTHING`, returns the existing cursor on a retry), latest / oldest cursor, expired-after-cursor check, Trips with events after a cursor, events for a recipient (user, role or allowed Trip; ordered; limited), delete older than.
- **`realtime-events.service.ts`:** `record` (store; never blocks live delivery: on failure `sequence` is null and a warning is logged), `recover` (cursor checks, retention, current Trip membership per Trip, limit and truncation), `reconnectPolicy` (validated env), `prune`; the exported `reconnectDelayMs` documents the bounded delay.
- **`realtime-event-prune.worker.ts`:** hourly prune when `REALTIME_EVENT_PRUNE_WORKER_ENABLED=true` (disabled in integration tests).
- **`events.gateway.ts`:**
  - every protected `emit*` method now goes through `publish`: build the audience, store, then `server.to(rooms).emit(name, payload, meta)`; room routing is unchanged (Trip room, user rooms, role rooms);
  - `connected` carries `latestSequence` and `reconnect`;
  - new `@SubscribeMessage("realtime.resume")`: authenticated session only, cursor validation, account re-read (inactive → `auth.error` and disconnect), roles re-granted from the database, Trip membership through the existing `tripRoomRejection`;
  - `flushPublished()` waits for pending publishes (tests, module shutdown).
- **Config:** `.env.example` documents `REALTIME_EVENT_RETENTION_HOURS`, `REALTIME_RESUME_LIMIT`, `REALTIME_EVENT_PRUNE_WORKER_ENABLED`, `REALTIME_EVENT_PRUNE_INTERVAL_MS`, `REALTIME_RECONNECT_INITIAL_DELAY_MS`, `REALTIME_RECONNECT_MAX_DELAY_MS`, `REALTIME_RECONNECT_MULTIPLIER`, `REALTIME_RECONNECT_JITTER_RATIO`.
- **Compatibility:** payloads are unchanged and `meta` is an extra argument, so existing web listeners and tests keep working. Client use of the cursor, backoff and dedupe is CTMS-082-T02.

## 14. Test Evidence — CTMS-363

- **Unit** (`events.gateway.spec.ts`, `realtime-events.service.spec.ts`; 66 tests in the realtime module):
  - routing unchanged and `meta` sent with every protected event; store-before-send with the frozen audience; SOS and weather ids reused; live delivery when storing fails;
  - `connected` cursor and backoff; null cursor when the store is down;
  - resume refused for anonymous sockets, invalid cursors and inactive accounts; current roles and Trip membership used;
  - recovery: up to date, unknown cursor, ordered events with identity, Trip filter, expired and pruned gaps, limit; backoff defaults, validation and cap; prune and worker.
- **Integration** (`test/websocket-reconnect.integration-spec.ts`, real Postgres + socket.io, 7 tests):
  - cursor and bounded backoff on connect (authenticated and anonymous);
  - a Camper misses a Trip incident and a private emergency broadcast while offline, reconnects with a new token and recovers exactly those two in cursor order (not the Admin review event nor another user's broadcast); from an older cursor the live event comes back with identical `meta`, so it can be deduplicated;
  - an Admin recovers role events, a Camper does not;
  - a Camper who left the Trip recovers only private events, not Trip events;
  - expired token rejected; anonymous resume and invalid cursor refused;
  - a re-published event is stored once and both live copies share identity and cursor;
  - a missed event past the retention window and an unknown cursor give `truncated`.
  - Found and fixed while testing: the live `emittedAt` (app clock) and the stored `created_at` (database clock) differed by a millisecond; the store now saves the emit time.
- **Existing socket suites:** `websocket-auth` and `sos-realtime-delivery` integration tests still pass (32).
- **Gates:** `lint:all` 0 errors (12 existing warnings); `build:all` pass; API unit 191 suites / 2332 tests pass; web Vitest 259 files / 1732 tests pass (`test:all` run per package: no `pytest` on this machine for `@ctms/ai`). Integration shards 1–8: only the 29 known baseline failures (sync-evaluation 4, overbooking-evaluation 4, trekking-route-checkpoints 2, incidents.report 1, trip-reviews 1, review-analysis 16, gps-tracking 1); `websocket-reconnect`, `websocket-auth` and `sos-realtime-delivery` pass; shard 4 crashed Jest, so its suites were run one by one. Default Playwright E2E: 61 passed / 38 failed / 32 did not run, same as the develop baseline.

## 15. Implementation Record — UI (Jira CTMS-364, CTMS-082-T02, web)

- **Shared connection `apps/web/src/core/realtime/realtimeConnection.ts`** (one socket per tab, CTMS-078-T02), extended:
  - **Bounded backoff (PB AC-1/AC-2):** the socket starts with the server defaults (1 s, max 30 s, jitter 0.2); the `reconnect` policy from `connected` is applied to the socket.io manager (`reconnectionDelay`, `reconnectionDelayMax`, `randomizationFactor`). socket.io always doubles the delay, which is the server's default multiplier; an invalid policy is ignored and the cap never goes below the first delay.
  - **Re-authentication (PB AC-3):** unchanged — the latest access token is presented on every reconnect; `auth.error` runs one token refresh, then Login (CTMS-04 rule).
  - **Rooms (PB AC-4):** unchanged — Trip rooms are re-requested with `trip.subscribe` after every authenticated reconnect.
  - **Missed events (PB AC-5):** the connection keeps the highest cursor it delivered (first `connected.latestSequence`, then `meta.sequence` of each event). After every authenticated *re*connect it sends `realtime.resume { afterSequence }` (5 s ack timeout) and replays the returned events, in cursor order, through the same handlers as live events. The first connection of a page does not resume (the page loads its data over HTTP).
  - **Dedupe (PB AC-6):** one dispatch path for live and recovered events; an event whose `meta.eventId` was already delivered is dropped (bounded memory of 500 ids). Events without `meta` keep their previous behaviour.
  - **State:** the snapshot has a new `recovery` field: `idle` | `recovering` | `recovered` | `failed`. `failed` when the resume is refused, times out, is `truncated`, or a reconnect has no cursor to resume from. The epoch still increments on every reconnect, so features still reload their lists over HTTP; only notifications may be missing when recovery fails.
  - Handlers receive `meta` as an optional second argument (`useRealtimeEvent` passes it on).
- **States shown to the user:** `RealtimeConnectionStatus` gets `recovery_failed` (warning: "Đã kết nối lại nhưng không lấy lại được hết cập nhật bị lỡ — dữ liệu đã được tải lại") and a shared `realtimeDisplayState(snapshot)` mapping: connecting, connected, reconnecting, disconnected, auth_rejected (re-authentication), recovery_failed. Used by the Admin review page (`useAdminTripReviewNotifications` / `useHostTripReviewNotifications` now return the display state), the Trip incidents panel and the Host SOS status (`SosRealtimeState` gains `recovery_failed`). Badge styles unchanged.
- **E2E configuration:** `tests/e2e/ctms-82-t02-reconnect-websocket.spec.ts` runs with `playwright.sos-realtime.config.ts` (real API + database) and is ignored by the default config, like the other real-backend realtime specs.
- **Out of scope:** the mobile app (it has no socket and polls).

## 16. Test Evidence — CTMS-364

- **Unit `realtimeConnection.test.ts`** (11 new, 30 in total): server backoff applied; invalid policy ignored and cap kept above the first delay; no resume on the first connection; resume from the last delivered cursor with ordered replay and `meta`; next reconnect resumes after everything delivered; a live + recovered copy is delivered once; `failed` for truncated, refused and timed-out resume while the epoch still increments; `failed` without a cursor; Trip rooms still re-requested; a late ack from a closed socket is ignored.
- **Unit `realtimeRecovery.test.tsx`** (13): display-state mapping for every state; `recovery_failed` badge; SOS, Trip incidents and Admin review hooks report `recovery_failed`; a review event recovered and also received live triggers one reload.
- **E2E, real backend** (`ctms-82-t02-reconnect-websocket.spec.ts`, 2):
  - a Camper's socket is closed by going offline; the Host broadcasts an emergency alert through the API; after going back online the push-only alert banner appears exactly once (it can only come from `realtime.resume`, whose frame is asserted); a second reconnect does not show it again;
  - the Admin review page shows "Mất kết nối — đang kết nối lại…" while offline, then `connected` (not `recovery_failed`) after the resume.
- **Screenshots:** Camper recovered alert, Admin reconnecting, Admin reconnected.
- **Gates:** `lint:all` 0 errors (12 existing warnings); `build:all` pass; web Vitest 260 files / 1757 tests pass; API unit 194 suites / 2362 tests pass (`test:all` run per package: no `pytest` on this machine for `@ctms/ai`). Real-backend realtime E2E (`playwright.sos-realtime.config.ts`): 10 passed, 1 failed — the failure is the pre-existing CTMS-79 SOS banner assertion (`Mã chuyến: …`, banner text changed by CTMS-76 before this task); both CTMS-82 tests and the CTMS-78 / CTMS-81 tests pass. Default Playwright E2E: 61 passed / 38 failed / 32 did not run, same as the develop baseline. Integration not rerun: no API change in this task.

