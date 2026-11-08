# CTMS-081 — Broadcast Emergency Alert to Trip

## 1. Overview

Story: CTMS-081

Epic: EPIC 12. SOS and Emergency Communication

Use Case: Broadcast Emergency Alert to Trip

Priority: Must Have

Goal: Allow an authorized Host to broadcast an emergency alert to eligible members and Porters of a Trip they manage.

Backlog story: As a Host, I want to broadcast an emergency alert to my Trip so eligible participants and Porters can receive urgent instructions.

Acceptance Criteria:

| Source  | Criterion                                                         |
| ------- | ----------------------------------------------------------------- |
| PB AC-1 | Host may broadcast an emergency alert only to a Trip they manage. |
| PB AC-2 | Alert stores the associated Trip.                                 |
| PB AC-3 | Alert stores alert type.                                          |
| PB AC-4 | Alert stores alert content.                                       |
| PB AC-5 | Alert is delivered to eligible Trip members and Porters.          |
| PB AC-6 | MVP does not support area-based targeting outside the Trip scope. |

## 2. Scope

### In Scope

- Trip-scoped emergency broadcast.
- Alert type.
- Alert content.
- Eligible Trip members.
- Eligible assigned Porters.

### Out of Scope

- Geographic/area-based targeting outside the Trip.
- General marketing notifications.
- SOS creation.

## 3. Actors & Authorization

Primary actor:

- Host.

Host may broadcast only for a Trip they manage.

## 4. Preconditions & Dependencies

- Trip exists.
- Host manages the Trip.
- Eligible recipients can be resolved from authoritative Trip participation/assignment data.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                     |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-262 | A Host may broadcast an emergency alert only to a Trip they manage. The alert must store the Trip, alert type, and content and must be delivered to eligible Trip members and Porters. The MVP does not support area-based targeting outside this scope. |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                    |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                             |

## 6. State & Lifecycle

Broadcast request
→ authorization/validation
→ alert persisted
→ eligible recipients resolved
→ delivery initiated.

## 7. Business Flow

1. Host selects a managed Trip.
2. Host selects alert type.
3. Host enters alert content.
4. Backend verifies Host authorization.
5. Validate alert input.
6. Persist Trip-scoped emergency alert.
7. Resolve eligible Trip members and Porters.
8. Commit.
9. Deliver alert to eligible recipients.

## 8. Data & Invariants

Emergency alert contains:

- trip_id;
- alert_type;
- content.

Recipient scope must derive from the target Trip.

MVP must not silently expand recipient targeting to unrelated users based on geographic area.

## 9. API / Integration Contract

Implemented by CTMS-081-T01 (Jira CTMS-361). See §13.

## 10. Error & Edge Cases

| Case                         | Expected Behavior              |
| ---------------------------- | ------------------------------ |
| Host manages Trip            | Broadcast permitted            |
| Host does not manage Trip    | Reject                         |
| Unrelated Camper             | Must not receive alert         |
| Porter not eligible for Trip | Must not receive alert         |
| Empty/invalid content        | Reject according to validation |
| Area targeting requested     | Not supported in MVP           |

## 11. Acceptance & Test Matrix

| Source | Scenario                   | Expected Result | Test Type     |
| ------ | -------------------------- | --------------- | ------------- |
| BR-262 | Authorized Host broadcasts | Alert created   | Integration   |
| BR-262 | Unrelated Host             | Rejected        | Security      |
| BR-262 | Eligible Camper            | Receives alert  | E2E           |
| BR-262 | Eligible Porter            | Receives alert  | E2E           |
| BR-262 | Unrelated user             | No alert        | Authorization |
| BR-262 | Area-based target          | Not supported   | Scope         |

## 12. Open Decisions

Exact supported emergency alert-type enum belongs to authoritative data/configuration design.

**Pending Decision (CTMS-361, approved with the plan):** until data design confirms the list, the enum `emergency_alert_type` contains `severe_weather`, `evacuation`, `route_hazard`, `medical`, `security` and `other`. A change only needs a migration that adds values, plus the DTO enum.

Other decisions taken with CTMS-361:

- **Broadcastable Trips:** only `published` (upcoming) and `ongoing` Trips can receive a broadcast.
- **Delivery target:** delivery goes to each recipient's private `user:{id}` room, not the `trip:{id}` room. The Trip room only holds clients that called `trip.subscribe`, so using it would miss recipients who have not opened the Trip screen.

## 13. Implementation Record — CTMS-081-T01 (Jira CTMS-361), Preparation + Logic

New module `services/api/src/modules/emergency-broadcasts` and migration `1794500000000-CreateEmergencyBroadcasts`.

**Data**

- `emergency_broadcasts`:
  - columns: `id` (client-generated UUID), `trip_id`, `host_id`, `alert_type` (`emergency_alert_type`), `content` (trimmed, 1–1000 characters, CHECK), `recipient_count`, `created_at`;
  - index on `(trip_id, created_at DESC)`.
- `emergency_broadcast_recipients`:
  - columns: `broadcast_id`, `user_id`, `role` (`camper`/`porter`), with primary key `(broadcast_id, user_id)`;
  - freezes exactly who was addressed at broadcast time.
- There is no area or geometry column (PB AC-6).

**`POST /api/trips/:tripId/emergency-broadcasts`** (Host role)

- Body: `{ id: uuid, alertType, content }`.
- Any other field, such as `area`, `radius` or `recipients`, is rejected with 422 by the global `forbidNonWhitelisted` validation. Area targeting therefore cannot be requested (PB AC-6 / Story AC4).
- Responses:

| Case | Result |
| --- | --- |
| No token | 401 |
| Non-Host role | 403 |
| Absent Trip, or Trip of another Host | 404 (BR-262, BR-173) |
| Trip not `published`/`ongoing` | 409 `TRIP_NOT_BROADCASTABLE` |
| Invalid body | 422 |
| Created | 201 |
| Same request retried | 200 |
| Broadcast ID reused with a different Trip, Host, alert type or content | 409 `BROADCAST_ID_CONFLICT` |

- **Transaction:** recipients are resolved and stored together with the broadcast, its recipient rows and an `audit_logs` row (`EMERGENCY_BROADCAST_CREATED`). The insert uses `ON CONFLICT ("id") DO NOTHING`. A concurrent or retried request with the same ID therefore never creates a second row, and it returns the stored broadcast without delivering it again (Story AC5).
- **Eligible recipients:** same Trip-team rule as the CTMS-078 `trip.subscribe` authorization.
  - Campers whose `member_status` is `registered` or `joined`, on `confirmed`/`completed` Bookings, with an active linked account.
  - Porters whose `trip_porters.status` is `assigned`.
  - Removed or no-show members, members of cancelled or unpaid Bookings, guests without an account, unassigned Porters and unrelated users are never addressed. The Host is not a recipient.
- **Delivery:** after commit, `EventsGateway.emitEmergencyBroadcast` emits `emergency.broadcast` to each recipient's `user:{id}` room and to the Host's own room, so the Host's other sessions stay in sync.
  - Payload: `eventId` (= broadcast ID, for client dedupe), `broadcastId`, `tripId`, `tripTitle`, `hostId`, `alertType`, `content`, `createdAt`.

**`GET /api/trips/:tripId/emergency-broadcasts`** (Host, Camper or Porter role)

- The managing Host gets every broadcast of the Trip, newest first, with `recipientCount`.
- A Camper or Porter linked to the Trip gets only broadcasts that addressed them, with `recipientCount: null`. This is how a client recovers broadcasts missed while offline.
- Anyone else gets 404.

## 14. Test Evidence — CTMS-081-T01

- **Unit** (`emergency-broadcasts.service.spec.ts`), 19 tests:
  - persist with trimmed content, then deliver to the frozen recipients plus the Host, with delivery checked to happen after persistence;
  - another Host's Trip or an absent Trip: 404 with nothing stored;
  - draft, pending_approval, completed, cancelled and rejected Trips: 409; a published Trip is allowed;
  - a retry returns the stored broadcast without persisting or emitting; the loser of a concurrent insert race is treated as a retry;
  - ID reuse with a different Trip, alert type or content: 409;
  - a Trip with no eligible recipient still notifies the Host's own sessions;
  - list for Host, list for recipient, stranger 404, absent Trip 404.
- **Integration** (`test/emergency-broadcasts.integration-spec.ts`, PostgreSQL + HTTP + socket.io), 10 tests:
  - 201 with `trip_id`, `alert_type` and `content` stored; recipients are exactly the joined Camper, the registered Camper and the assigned Porter; the audit row is written;
  - the joined Camper, registered Camper, assigned Porter and Host receive `emergency.broadcast`; the removed Camper, the Camper on a cancelled Booking, the unrelated Camper, the unassigned Porter and another Host receive nothing within 1 s;
  - 401, 404 (other Host or absent Trip), 403 (Camper, Porter), 409 (completed Trip);
  - 422 for area targeting, explicit recipients, blank content, content over 1000 characters, an unknown alert type, and a missing ID;
  - 3 concurrent requests plus 1 sequential retry with the same ID give one 201, the rest 200, exactly 1 row and 1 delivery; reusing the ID with other content gives 409;
  - GET: the Host sees all broadcasts with counts, a recipient sees only addressed ones without counts, a removed member sees an empty list, and strangers get 404.

  This suite caught an ambiguous `role` column in the recipient query, which was fixed before commit.
- **Gates:**
  - API `lint` and `build` passed.
  - API unit: 2099/2101. The 2 `offline-packages/package-readiness.spec.ts` failures are pre-existing on `develop`.
  - Integration (8 shards): 698 passed, 28 failed. All 28 failures are pre-existing on `develop`: sync-evaluation 4, overbooking-evaluation 4, trekking-route-checkpoints 2, incidents.report 1, trip-reviews 1, review-analysis 16. The new emergency-broadcasts suite passed.

### Logic Subtask DoD

- [x] Logic implementation completed.
- [x] Applicable business rules/invariants implemented (BR-262, BR-173; BR-213 valid and violation paths, with idempotency covered by integration tests).
- [x] Task-specific unit tests added/updated.
- [x] Task-specific unit tests passed.
- [x] Applicable backend/integration tests passed.

## 15. Implementation Record — CTMS-081-T02 (Jira CTMS-362), UI

No API change. The UI uses the CTMS-361 contract: `POST`/`GET /api/trips/:tripId/emergency-broadcasts` and the `emergency.broadcast` socket event.

**Web: Host sends** (`apps/web/src/features/emergency-broadcasts`)

- `HostEmergencyBroadcastCard` sits in the existing **"Sự cố chuyến đi"** tab of the Host Trip page, above the incident list. It is shown only to the managing Host and only for `published`/`ongoing` Trips. No new tab and no layout change.
- **Form:** alert type (six values, Vietnamese labels) and content (required, trimmed, 1–1000 characters, live counter). There is no area or recipient picker (PB AC-6).
- **Confirmation:** sending asks for confirmation through the shared `ConfirmModal`.
- **One client UUID per draft:** a retry after a failure resends the same ID, so the API returns the stored broadcast instead of creating a second one (Story AC5). A new ID is taken after a confirmed success or when the Host asks for a new draft after `BROADCAST_ID_CONFLICT`.
- **Errors:** 404/403 (not the Host's Trip), 409 `TRIP_NOT_BROADCASTABLE`, 409 `BROADCAST_ID_CONFLICT`, 422 and network failures each get a Vietnamese message.
- **History:** type, content, time and recipient count. It refreshes on `emergency.broadcast` for the same Trip (the Host's other sessions) and every 60 s as a fallback.

**Web: Camper/Porter receive**

- `useEmergencyBroadcastListener` runs in `AppRouteContent` for signed-in users with the Camper or Porter role. Each alert goes into an in-page inbox, deduplicated by `eventId` (a redelivered alert is never shown again, even after it was read). The sender's own echo is ignored.
- `EmergencyBroadcastAlerts`, rendered at the app root, shows each alert as a fixed red `role="alert"` banner with type, Trip title, time and content, until the viewer taps "Đã đọc".
- `ReceivedEmergencyBroadcastsCard` recovers alerts missed while offline through `GET` (newest highlighted). It renders nothing when the list is empty. It appears on:
  - Booking detail, for `confirmed` bookings;
  - the Camper Trip page when it shows a confirmed booking;
  - the Porter assigned-Trip detail, above the tabs.

**Mobile: Camper/Porter** (`apps/mobile/lib/features/emergency_broadcasts`)

- The app has no socket client, so `EmergencyBroadcastsController` polls `GET` every 15 s (same cadence as the CTMS-076 incident list). It also refreshes when the app resumes and when connectivity returns. A failed refresh keeps the last list and says so.
- `EmergencyBroadcastsPanel` is inserted:
  - at the top of the Camper Trip safety panels (`camper_trip_detail_screen`);
  - above the GPS panel in `porter_gps_tracking_section`.
- The panel is empty until an alert exists. The newest unacknowledged alert is shown as an emergency `CtmsAlertBanner`. "Đã xem" stores the acknowledged IDs per Trip in secure storage, on the device only. Older alerts are listed below.

**Decisions**

- "Đã đọc/Đã xem" is local only. The API has no read receipt, so the Host is not told who read an alert.
- On web, opening `/trips/:id` directly does not restore the Camper's booking (existing behaviour), so the recovery card is guaranteed on Booking detail.

## 16. Test Evidence — CTMS-081-T02

- **Web unit** (Vitest, 21 tests):
  - `HostEmergencyBroadcastCard.test.tsx` (12):
    - history with recipient count;
    - required type and content;
    - more than 1000 characters blocked;
    - confirm-before-send with trimmed content;
    - same ID resent after a network failure;
    - new ID after success and after "Tạo bản nháp mới";
    - 409/409/404/422 messages;
    - socket refresh for the same Trip only.
  - `EmergencyBroadcastAlerts.test.tsx` (5): banner content, dedupe after read, newest first, own echo ignored, no socket when disabled.
  - `ReceivedEmergencyBroadcastsCard.test.tsx` (4): offline recovery, empty or error renders nothing, live socket refresh, disabled fetches nothing.
- **Mobile** (`emergency_broadcasts_panel_test.dart`, 6): empty renders nothing; newest unseen highlighted plus older list; "Đã xem" persists across remount; failed refresh keeps data; polling interval; refresh on reconnect only.
- **E2E, real API + DB + socket.io** (`ctms-81-t02-broadcast-emergency-alert.spec.ts` in `playwright.sos-realtime.config.ts`):
  - validation, then confirm, then send from the Host Trip page; "Đã phát cảnh báo tới 1 người"; history row;
  - the joined Camper's banner appears within 5 s with type, Trip and content, and "Đã đọc" removes it;
  - the alert is still on the Camper's Booking detail;
  - an unrelated Camper gets no banner;
  - DB row `severe_weather` / content / `recipient_count = 1`.
  - Screenshots: Host form, Host history, Camper banner, Camper recovery card.
- **Gates:**
  - `lint:all`: 0 errors (12 warnings, all pre-existing). `build:all`: passed.
  - Web `vitest`: 1670/1670 (251 files).
  - Mobile:
    - `flutter analyze`: 6 issues, all pre-existing and in untouched files (sos, porter_incidents, ctms_section_card).
    - `flutter test`: 249 passed, 1 failed. The failure is the known `widget_test.dart › porter overview renders dashboard UI`.
  - `playwright.sos-realtime.config.ts`: 8 passed, 1 failed. The new spec passed. The failure is the known `ctms-79-t02` banner copy changed by CTMS-76.
  - Default Playwright: 54 passed / 38 failed / 32 did not run, identical to the baseline. The new real-backend spec is added to the default config's `testIgnore`, like the other realtime specs.
  - No API change.

### UI Subtask DoD

- [x] Host broadcast UI (type, content, confirmation, idempotent retry, errors, history).
- [x] Eligible Camper and Porter receive alerts (web realtime banner and recovery card; mobile panel).
- [x] Unrelated users receive nothing (server-scoped; E2E verified).
- [x] No area targeting in the UI (PB AC-6).
- [x] Tests added and passing; regression compared with baseline.
