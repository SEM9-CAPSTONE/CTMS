# CTMS-090 — Receive Push Notifications while App Runs in Background

## 1. Overview

Story: CTMS-090

Epic: EPIC 15. Notifications

Use Case: Receive Push Notifications while App Runs in Background

Priority: Should Have

Goal: Deliver supported high-value notifications while the application is in the background without sending the same event more than once to the same recipient.

Backlog story: As a user, I want to receive push notifications while the app is in the background so I can be informed about important Trip events.

Acceptance Criteria:

| Source  | Criterion                                                                              |
| ------- | -------------------------------------------------------------------------------------- |
| PB AC-1 | Background push supports booking updates.                                              |
| PB AC-2 | Background push supports Porter assignments.                                           |
| PB AC-3 | Background push supports weather alerts.                                               |
| PB AC-4 | Background push supports SOS.                                                          |
| PB AC-5 | Same event must not be sent more than once to the same recipient.                      |
| PB AC-6 | Recipient authorization/eligibility and applicable notification rules remain enforced. |

## 2. Scope

### In Scope

Background push for:

- booking updates;
- Porter assignments;
- weather alerts;
- SOS.

Also includes:

- recipient eligibility;
- per-event/per-recipient duplicate prevention.

### Out of Scope

- General in-app notification UI — CTMS-088.
- Missed-alert recovery — CTMS-089.
- User notification configuration — CTMS-091.

## 3. Actors & Authorization

- Eligible user.
- Push notification subsystem.

Push delivery must not expose an event to an ineligible recipient.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-088.

A supported event occurs and the user/app is eligible for background push.

## 5. Business Rules

| BR             | Rule                                                                                                                                                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-273         | Background push notifications may be used for Booking updates, Porter Assignments, weather alerts, and SOS. The same event must not be delivered more than once to the same recipient.                                                        |
| BR-194         | Notification/event side effects may be queued or emitted only after the primary business transaction commits successfully, preferably through an outbox/queue. Notification failure must not roll back the already-committed business result. |
| BR-195         | A single business event must not create duplicate notifications for the same recipient, target object, and event type.                                                                                                                        |
| BR-196         | Users may disable ordinary notifications, but mandatory safety or emergency alerts for an active related Trip must not be suppressible.                                                                                                       |
| BR-197         | When an external service times out or returns incomplete data, the system must record the failure, must not assume success, and must not fabricate unverifiable data.                                                                         |
| BR-198         | Retries to external services must be bounded and use backoff. Retrying must not create duplicate records or transactions.                                                                                                                     |
| BR-212         | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                         |
| BR-213         | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                  |

## 6. State & Lifecycle

Supported event
→ determine eligible recipient
→ create push-delivery intent
→ deduplicate by event/recipient
→ send
→ delivery outcome recorded as applicable.

Push delivery does not replace authoritative CTMS business state.

## 7. Business Flow

1. Supported event occurs.
2. Determine recipient eligibility.
3. Determine whether background push applies.
4. Identify event/recipient delivery key.
5. Check previous delivery.
6. If not previously sent, dispatch push.
7. Record delivery attempt/result as applicable.
8. If same event is processed again, do not send duplicate push to same recipient.

## 8. Data & Invariants

Supported event categories:

- booking update;
- Porter assignment;
- weather alert;
- SOS.

Critical invariant:

`same event + same recipient → at most one push`

Push content must not be treated as the authoritative source of the underlying business state.

## 9. API / Integration Contract

Provider: **Firebase Cloud Messaging HTTP v1** (Android and iOS). The API signs a service-account JWT itself (`node:crypto`) and calls `https://fcm.googleapis.com/v1/projects/{FCM_PROJECT_ID}/messages:send`; no new npm dependency.

- **`PUT /me/push-devices`** (authenticated) `{ token: string (≤512), platform: "android" | "ios" }` → `200 { id, platform }`. Registers or refreshes this app installation's token for the caller. A token previously registered by another account on the same phone moves to the caller, so a signed-out account stops receiving that phone's pushes.
- **`DELETE /me/push-devices`** (authenticated) `{ token }` → `204`; `404` when the token is not the caller's (sign-out).
- **Push message** (FCM `notification` + `data`): a short Vietnamese title/body plus routing data only — `type` (source event), `eventId`, `tripId`, and `bookingId` / `requestId` / `sosId` / `broadcastId` / `status` / `riskLevel` / `urgency` as applicable, and `pushId`. The app reloads the authoritative state when opened; push content is never authoritative (Section 8). Mandatory alerts use FCM priority `HIGH` / APNs priority 10.
- **Supported events → recipients** (only users addressed by id, never a whole role):

| Category | Source event | Recipient | Mandatory (BR-196) |
| --- | --- | --- | --- |
| `booking` | `booking.updated` `confirmed` (PayOS payment callback) | Booking owner | no |
| `booking` | `booking.updated` `expired` (unpaid hold expired) | Booking owner | no |
| `booking` | `booking.updated` `cancelled` (Host/Admin Trip cancel, CTMS-036 auto-cancel) | each Booking owner | no |
| `booking` | `booking.updated` `pending_reconfirmation` (Trip rescheduled) | each moved Booking owner | no |
| `porter_assignment` | `porter.request.created` | Porter | no |
| `porter_assignment` | `porter.request.state_changed` accepted / declined / expired | requesting Host | no |
| `porter_assignment` | `porter.request.state_changed` cancelled | Porter | no |
| `weather` | `trip.weather.changed` | Host and booked Campers (Trip-scoped) | yes when the new level is Red |
| `weather` | `trip.weather.decision_required` | Host / Admin addressed | no |
| `sos` | `sos.created` | Trip Host | yes |
| `sos` | `sos.state_changed` acknowledged / closed; cancelled | SOS sender; the Host when the sender cancels | yes |
| `emergency` | `emergency.broadcast` (CTMS-081) | Trip team except the Host (Trip-scoped) | yes |

- **Configuration:** `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` (empty → no provider), `PUSH_DELIVERY_WORKER_ENABLED`, `PUSH_DELIVERY_INTERVAL_MS` (15 s), `PUSH_DELIVERY_BATCH_SIZE` (50), `PUSH_DELIVERY_MAX_ATTEMPTS` (5).

## 10. Error & Edge Cases

| Case                         | Expected Behavior                            |
| ---------------------------- | -------------------------------------------- |
| Booking update               | Eligible for push                            |
| Porter assignment            | Eligible for push                            |
| Weather alert                | Eligible for push                            |
| SOS                          | Eligible for push                            |
| Same event processed twice   | One push maximum per recipient               |
| Different recipients         | Each eligible recipient may receive own push |
| Recipient no longer eligible | Do not expose event                          |
| Push provider failure        | Do not fabricate successful delivery         |

## 11. Acceptance & Test Matrix

| Source | Scenario                | Expected Result      | Test Type   |
| ------ | ----------------------- | -------------------- | ----------- |
| BR-273 | Booking update          | Push supported       | Integration |
| BR-273 | Porter assignment       | Push supported       | Integration |
| BR-273 | Weather alert           | Push supported       | Integration |
| BR-273 | SOS                     | Push supported       | E2E         |
| BR-273 | Same event retried      | No duplicate push    | Idempotency |
| BR-273 | Two eligible recipients | Independent delivery | Integration |

## 12. Open Decisions

~~Push provider/platform implementation belongs to Technical Design.~~ Resolved by CTMS-383: Firebase Cloud Messaging HTTP v1 (Section 9).

**Pending Decisions**

- **PD-1 (leader).** A Firebase project and a service account must be created by the team owner. Until `FCM_*` are set, every push is recorded `skipped: provider_not_configured` (nothing is faked, BR-197). The mobile task (CTMS-090-T02) also needs that project's `google-services.json` / `GoogleService-Info.plist`.
- **PD-2.** Booking updates pushed: `confirmed` after the payment callback, `expired`, `cancelled` by a Trip cancellation (Host, Admin weather decision, auto-cancel) and `pending_reconfirmation` after a reschedule. A Camper's own actions (self-cancel, answering a weather reschedule, paying in the app) are not pushed back to the same Camper.
- **PD-3.** User notification preferences belong to CTMS-091. Until then every ordinary category is on; the `PUSH_PREFERENCES` hook is ready. SOS, emergency broadcasts and Red weather alerts are mandatory and bypass preferences (BR-196).
- **PD-4.** Emergency broadcasts (CTMS-081) are pushed as a mandatory safety category even though Section 2 lists only four categories, because BR-196 forbids suppressing them.

## 13. Implementation Record — Logic (Jira CTMS-383, CTMS-090-T01)

- **Migration `1795000000000-CreatePushNotifications`:**
  - `push_devices` (user, unique `token`, `platform` android/ios, `last_seen_at`, `disabled_at`; FK to users with cascade);
  - `push_notifications`, the delivery outbox: `event_key` + `recipient_id` **unique** (BR-195/BR-273), `category`, `mandatory`, `trip_id`, `trip_scoped`, title/body/data, delivery `status` (`pending` / `sending` / `sent` / `failed` / `skipped`), `skip_reason`, `attempts`, `next_attempt_at`, `last_error`, `sent_at`. Delivery state lives only here, never on the business rows.
- **Module `modules/push-notifications`:**
  - `push-notification.policy.ts`: maps a committed realtime event to push intents (Section 9 table), with the event id as the duplicate key and short Vietnamese text;
  - `push-notifications.repository.ts`: device upsert/delete/disable; `enqueue` (`INSERT … ON CONFLICT DO NOTHING`, joined to existing users); `claimDue` (`FOR UPDATE SKIP LOCKED`, mandatory first; rows left in `sending` by a crashed pass are retried after 10 min; "due" uses the later of the app and database clocks); outcome updates;
  - `push-notifications.service.ts`: `enqueueForEvent` never throws into the caller (BR-194). `deliverDue` checks, in order: provider configured, recipient eligible now (active account; for Trip-scoped pushes still Host / Camper registered-joined / assigned Porter), preference (ordinary only), active devices. It then sends to each device: one success → `sent`; unregistered token → device disabled; retryable error → `pending` with 1, 2, 4, 8 min backoff up to 5 attempts, then `failed`; rejected message → `failed` (BR-197/BR-198);
  - `fcm-push.sender.ts`: FCM HTTP v1 with a cached OAuth token; 10 s timeout; 429/5xx/timeout retryable, `UNREGISTERED`/404 unregistered, other 4xx permanent; `UnconfiguredPushSender` when `FCM_*` are missing;
  - `push-delivery.worker.ts` (`PUSH_DELIVERY_WORKER_ENABLED`, off in integration tests); `push-devices.controller.ts`.
- **Queueing after commit (BR-194):** `EventsGateway.publish` (already called after each business transaction) queues the push after the live send, using the same event id as the realtime record (CTMS-363), so a re-published event is neither stored nor pushed twice.
- **`booking.updated`** (new private realtime event to the Booking owner) through `realtime/booking-updates.ts`, with a deterministic event id per occurrence (`stableEventId`), so a repeated payment callback or retried job yields the same id. Call sites, all after commit and never able to fail the business flow:
  - `PaymentsService.handlePayOSWebhook` when the Booking becomes `confirmed`;
  - `BookingExpiryService.expireBooking`;
  - `TripsService.cancel` (also used by the Admin weather decision) and `TripAutoCancelService.evaluateTrip` for each cancelled Booking;
  - `TripsService.reschedule`: the moved Bookings are read after commit (status `pending_reconfirmation` with the new schedule snapshot).
- `.env.example` documents the new keys without values.

## 14. Test Evidence — CTMS-383

- **Unit** (`push-notifications/*.spec.ts`, `events.gateway.spec.ts`):
  - policy: every supported event and recipient rule, unsupported statuses, role events never pushed, Red = mandatory, Host not pushed its own broadcast, text trimming;
  - service: queueing errors swallowed; sent to all devices; `provider_not_configured`; inactive account; Camper who left a Trip vs Host; preference off for ordinary but not mandatory; no device; unregistered token disabled; retry backoff; last attempt and rejected message → `failed`; unexpected error recorded;
  - FCM sender: RS256 assertion verified with the public key; payload and priorities; OAuth token reuse; unregistered / 503 / 429 / timeout / 400 / OAuth failure; unconfigured sender;
  - `stableEventId` determinism; `publishBookingUpdates` never throws; gateway queues the push after the live send with the live event id; worker on/off and failure isolation.
- **Integration** (`test/push-notifications.integration-spec.ts`, real Postgres, Firebase replaced by a recording fake, 9 tests):
  - device registration, move to the signed-in account, sign-out, 404 for another user's token, 401 and validation errors;
  - **Booking (AC-1):** a Host reschedule queues one `booking` push for the Camper; publishing the same event again adds nothing; delivery sends it once, a second pass sends nothing (**AC-4/PB AC-5**);
  - a Host Trip cancellation pushes each Booking owner;
  - **Porter (AC-2):** a new Porter request is pushed to the Porter only;
  - **Weather (AC-3):** a Red alert is delivered independently to Host and joined Camper, and skipped `not_eligible` for a Camper who left (**AC-5/PB AC-6**);
  - **SOS (AC-3):** high-priority mandatory push to the Host;
  - provider 503 → `pending`, `attempts 1`, next attempt ≥ 1 min later, error recorded; after recovery the retry sends it once (`attempts 2`);
  - no device → `skipped: no_device`; an `UNREGISTERED` token is disabled.
  - Found and fixed while testing: TypeORM returns `[rows, count]` for `UPDATE/DELETE … RETURNING` (the claim and sign-out used the wrong shape), and the app/database clock skew left fresh rows not yet "due".
- **Gates:** `lint:all` 0 errors (12 existing warnings); `build:all` pass; API unit 197 suites / 2400 tests pass; web Vitest 260 files / 1757 tests pass (`test:all` run per package: no `pytest` on this machine for `@ctms/ai`). Integration: the new `push-notifications` suite 9/9, and every suite touching the changed code passes (`bookings.cancel`, `bookings.create`, `trip-weather-decisions`, `websocket-reconnect`, `websocket-auth`, `sos-realtime-delivery`, …). Remaining failures are pre-existing: the known baseline (sync-evaluation 4, overbooking-evaluation 4, trekking-route-checkpoints 2, incidents.report 1, trip-reviews 1, review-analysis 16); the new develop suites `route-recovery` (27) and `offline-basemaps` (4) fail before any test code with "SASL: client password must be a string" (their own pg connection needs a password variable this machine does not set); `trips.review` 1 and `trip-weather-monitoring` failed only inside the shard because of leftover data and pass alone. Shards 2 and 3 crashed Jest, so their suites were run one by one (all pass). Default Playwright E2E: 61 passed / 38 failed / 32 did not run, same as the develop baseline.

