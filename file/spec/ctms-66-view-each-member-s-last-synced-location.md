# CTMS-066 — View Each Member's Last Synced Location

## 1. Overview

Story: CTMS-066

Epic: EPIC 10. Offline Buffer and Synchronization

Use Case: View Each Member's Last Synced Location

Priority: Must Have

Goal: Allow Host to see the latest server-known location and synchronized safety state for eligible Trip members without presenting stale/unsynced device data as real-time information.

Backlog story: As a Host, I want to view each Trip member's last synchronized location so I can understand the latest location the server actually knows.

Acceptance Criteria:

| Source  | Criterion                                                                                          |
| ------- | -------------------------------------------------------------------------------------------------- |
| PB AC-1 | Host view shows latest synchronized member location.                                               |
| PB AC-2 | Host view shows `last_seen_at`.                                                                    |
| PB AC-3 | Synchronized safety flags such as OFF_ROUTE/checkpoint/behind-schedule are shown where applicable. |
| PB AC-4 | Unsynced device data is not represented as server-known real-time state.                           |
| PB AC-5 | Only eligible Trip members are visible to authorized Host.                                         |

## 2. Scope

### In Scope

- Last synchronized location.
- Last seen time.
- Synced safety flags.
- Staleness semantics.
- Host Trip-member authorization.

### Out of Scope

- Device's unsynced live location.
- WebSocket real-time communication.
- GPS generation.

## 3. Actors & Authorization

- Host managing the applicable Trip.
- System.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-065.
- Applicable Trip/member relationship.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-246     | For each eligible Trip member, the Host view must show the latest synchronized location, last_seen_at, and synchronized safety flags such as OFF_ROUTE, Checkpoint, or behind-schedule. Data still unsynced on the device must not be presented as though the server knows it in real time. |
| BR-172     | Access control must be enforced by the backend using role, ownership, and business scope. Hiding or disabling functionality in the UI is not a substitute for backend authorization.                                                                                                        |
| BR-173     | A user may view or modify only data they own unless the user's role and business relationship explicitly authorize access to another user's data.                                                                                                                                           |

## 6. State & Lifecycle

Read projection.

Member device:
local pending data → synchronization → server-known state.

Host sees only server-known synchronized state.

## 7. Business Flow

1. Host opens active Trip monitoring.
2. Verify Host manages Trip.
3. Load eligible Trip members.
4. Resolve latest synchronized location per member.
5. Resolve `last_seen_at`.
6. Resolve synchronized safety flags.
7. Return projection.
8. Clearly represent staleness/server-known semantics.

## 8. Data & Invariants

- Location = latest synchronized server-known location.
- `last_seen_at` accompanies state.
- Unsynced device position is not server-known.
- Host sees only members in authorized Trip scope.
- Stale data must not be labeled live/current without qualification.

## 9. API / Integration Contract

Implemented by CTMS-066-T01 (Jira CTMS-329). See §13.

## 10. Error & Edge Cases

| Case                           | Expected Behavior                        |
| ------------------------------ | ---------------------------------------- |
| Member has never synced        | Show no server-known location            |
| Member offline for long period | Preserve last known location + timestamp |
| Device has newer pending GPS   | Host does not see it as server-known     |
| Unrelated Host                 | No access                                |
| Safety event not synced        | Do not show as server-confirmed          |

## 11. Acceptance & Test Matrix

| Source | Scenario                | Expected Result               | Test Type   |
| ------ | ----------------------- | ----------------------------- | ----------- |
| BR-246 | Member synced location  | Displayed                     | E2E         |
| BR-246 | Member has timestamp    | last_seen_at displayed        | UI          |
| BR-246 | Synced OFF_ROUTE        | Flag displayed                | Integration |
| BR-246 | New unsynced GPS exists | Not presented as server-known | Consistency |
| BR-172 | Unrelated Host          | Rejected                      | Security    |

## 12. Open Decisions

None. The view is explicitly last-synchronized rather than guaranteed real-time.

Decisions taken with CTMS-329 (approved with the plan):

- The Jira card asks for Host/Porter access, while §3 lists only the Host. The Porter assigned to the Trip may also read the projection, because the Porter needs the same picture on site (consistent with CTMS-063 §13.5).
- CTMS-066 is a new read-only endpoint. CTMS-369 `host-trip-map` is unchanged, and its `safety.behindSchedule` remains `null`.
- Only `ongoing` Trips are served. GPS is accepted only while a Trip runs, so there is no newer synchronized state afterwards.

## 13. Implementation Record — CTMS-066-T01 (Jira CTMS-329), Preparation + Logic

New read-only module `services/api/src/modules/member-locations`, registered in `AppModule`.

**Endpoint:** `GET /api/trips/:tripId/member-locations`, with `Cache-Control: private, no-store`.

| Case | Result |
| --- | --- |
| No token | 401 |
| Role other than Host/Porter | 403 (server-granted roles via `RolesGuard`) |
| Absent Trip, Trip of another Host, unassigned Porter | 404. Out-of-scope Trips are indistinguishable from absent ones (BR-172/173) |
| Trip not `ongoing` (checked after authorization) | 409 |
| Malformed Trip ID | 422 |

**Eligible members.** Same rule as CTMS-369:

- Campers whose `member_status` is `joined` or `left` on a `confirmed` or `completed` booking;
- Porters with `trip_porters.status = 'assigned'`.

Registered, removed and no-show members are excluded, and so are members of cancelled bookings. Only ID, name, role and member status are returned. Email, phone, health data and credentials are never returned.

**Per member:**

- `location`: the latest accepted `gps_logs` sample for this Trip, user and participant role, ordered by capture `event_time` desc, then `received_at`, then ID. A delayed upload of an older capture cannot replace a newer position.
- `lastSeenAt` (`last_seen_at`): the capture time of that sample, not the upload time.
- `lastSyncedAt`: the latest server receipt of any device upload, GPS or device-detected safety event. Server-raised `BEHIND_SCHEDULE` rows are excluded. This lets the UI separate "position captured at" from "device last synchronized at".
- `freshness` and `locationAgeSeconds`:
  - `fresh` when the capture age is between 0 and the threshold, inclusive;
  - `stale` when the capture is older or future-dated;
  - `unavailable` when no sample exists.

  The threshold is the existing approved `HOST_TRIP_MAP_FRESHNESS_MAX_AGE_SECONDS` (default 120 s, must be a positive safe integer). No second configuration value is introduced.
- `safety.route` and `safety.gps`: the latest synchronized transition in the OFF_ROUTE/ON_ROUTE_RECOVERED and GPS_DEGRADED/GPS_RESTORED families.
- `safety.lastCheckpoint`: the latest persisted checkpoint visit, with the checkpoint name.
- `safety.behindSchedule`, for Campers with an account: the CTMS-063 evaluation from `ScheduleProgressService.getProgress()`. It contains status, lag, reference checkpoint, safe checkpoint and `evaluatedAt`. It is reused, not recomputed. It is `null` for Porters and guests without an account. `null` means unknown, never "on track".

**Response metadata:** `viewer` (`host`/`porter`), `generatedAt`, `locationSource: "server_confirmed"`, `freshnessMaxAgeSeconds`.

**Unsynchronized data (AC-4):** the projection reads only server tables (`gps_logs`, `safety_events`, `checkpoint_visits`). Samples and events still buffered on a device are therefore absent and cannot be shown as server-known. A member who never synchronized has `location: null` and `freshness: "unavailable"`.

**OpenAPI:** `TripMemberLocationsDto` and its nested DTOs.

## 14. Test Evidence — CTMS-066-T01

- **Unit** (`member-locations.service.spec.ts`), 17 passed:
  - Host and assigned-Porter access; unrelated caller gets 404 without reading members; absent Trip 404; non-ongoing Trip 409;
  - freshness boundaries at 0, 120, 121 and 3600 s; a future capture is stale; never-synced is unavailable; configured threshold; invalid threshold rejected;
  - ISO normalization;
  - pass-through of synced route, GPS and checkpoint data; behind-schedule attached only to the matching Camper; `null` when there is no evaluation.
- **Integration** (`test/member-locations.integration-spec.ts`, PostgreSQL + PostGIS + HTTP), 5 passed:
  - 401, 403 (Camper), 404 (other Host, unassigned Porter), 422, 409 (completed Trip), Porter allowed;
  - only eligible members, with no contact data;
  - the latest capture wins over a delayed older upload, and `lastSeenAt` equals the capture time;
  - a long-offline Porter keeps the last location as `stale`; a never-synced Camper has no location;
  - synced OFF_ROUTE is shown, the BEHIND evaluation references "Trạm nghỉ suối", and a Camper without GPS is `LOCATION_UNKNOWN`.
- **Gates:**
  - API `lint` and `build` passed.
  - API unit: 2080/2082. The 2 `offline-packages/package-readiness.spec.ts` failures are pre-existing on `develop` (CTMS-221).
  - Integration (8 shards): 688 passed, 28 failed. All 28 failures are pre-existing on `develop`: sync-evaluation 4, overbooking-evaluation 4, trekking-route-checkpoints 2, incidents.report 1, trip-reviews 1, review-analysis 16. The new member-locations suite passed.

### Logic Subtask DoD

- [x] Logic implementation completed.
- [x] Applicable business rules/invariants implemented (BR-246, BR-172, BR-173).
- [x] Task-specific unit tests added/updated.
- [x] Task-specific unit tests passed.
- [x] Applicable backend/integration tests passed.

## 15. Implementation Record — CTMS-066-T02 (Jira CTMS-330), Host web + Porter mobile UI

Both clients consume `GET /api/trips/:tripId/member-locations` (§13). They refresh every 60 s and offer a manual "Làm mới" button. Every location, timestamp and safety flag comes from the server. Neither client merges its own device buffer into the list (AC-4).

**Shared presentation rules**

- A fixed line states that this is the latest location the server received, not a live position: "Vị trí server đã nhận gần nhất, không phải vị trí trực tiếp".
- **Freshness badge:**
  - "Mới" (success);
  - "Cũ" (warning);
  - "Chưa có dữ liệu" (neutral).

  It is recomputed on the client every 15 s from `lastSeenAt` and the server's `freshnessMaxAgeSeconds`. A position that was fresh when fetched therefore turns stale as time passes, even if refreshes fail. A future-dated capture is never shown as fresh.
- **Per member:**
  - name and role, with "Đã rời đoàn" when `memberStatus = left`;
  - "Ghi lúc HH:mm (x phút trước)" from `lastSeenAt`;
  - coordinates with accuracy;
  - "Checkpoint gần nhất: … · HH:mm";
  - "Đồng bộ gần nhất: HH:mm" from `lastSyncedAt`;
  - flags: "Lệch tuyến" (latest route transition is OFF_ROUTE), "GPS yếu" (latest GPS transition is GPS_DEGRADED), and "Chậm hơn đoàn / Chậm nghiêm trọng · n phút" (CTMS-063 evaluation, same labels as CTMS-320).
- A member who never synchronized shows "Server chưa nhận được vị trí nào của thành viên này."
- **Order:** members with a safety warning first, then stale, then no data, then fresh. Ties are broken by name.
- **States:**
  - loading;
  - empty;
  - restricted, for 403/404: "không có quyền xem";
  - Trip not ongoing, for 409;
  - first-load error, with retry;
  - failed refresh: the last data is kept and labelled "đang hiển thị dữ liệu lúc HH:mm".

**Web Host (`apps/web/src/features/member-locations`)**

- `MemberLastLocationsCard` ("Vị trí đồng bộ gần nhất") sits in the "Điểm danh & Hoàn tất" tab of Trip detail, below the CTMS-063 progress card, while the Trip is `ongoing`.
- It reuses `StatusBadge`, `Button` and the CTMS-320 card layout.

**Mobile Porter (`apps/mobile/lib/features/member_locations`)**

- `PorterMemberLocationsPanel` ("Vị trí thành viên") sits in `PorterGpsTrackingSection`, below `PorterTeamProgressPanel`, for the selected Trip.
- `MemberLocationsController` follows the CTMS-320 controller pattern and also keeps the HTTP status of the last failure.
- It reuses `CtmsSectionCard`, `CtmsStatusBadge`, `CtmsAlertBanner` and `CtmsButton`.

**Judgment calls** (approved with the plan):

- The view is a list only. The shared `RouteCheckpointMap` was not changed to draw member markers.
- The Host view is on web and the Porter view is on mobile, as in CTMS-320.

**E2E harness:** `tests/e2e/ctms-66-t02-member-last-locations.spec.ts` was added to `playwright.sos-realtime.config.ts` and excluded from the default config.

## 16. Test Evidence — CTMS-066-T02

- **Vitest** (`MemberLastLocationsCard.test.tsx`), 10 tests:
  - loading, with the "not live" statement;
  - ordering, freshness badges, last seen and relative time, coordinates, checkpoint, OFF_ROUTE and BEHIND flags, no-data text;
  - a future capture is stale, and "Đã rời đoàn" is shown;
  - a fresh position turns stale as the clock moves, without a refetch;
  - empty state;
  - 403, 404, 409 and 500 messages;
  - a failed refresh keeps the last data.

  Full web suite: 1611/1611 passed.
- **Flutter widget tests** (`porter_member_locations_panel_test.dart`), 9 tests, covering the same scenarios plus restricted, 409, and error-then-retry. `flutter analyze` reports no issues in the changed folders.

  Full `flutter test`: the only failure is `widget_test.dart › porter overview renders dashboard UI`, which is pre-existing on `develop`.
- **E2E (real API + PostGIS)**, `test:e2e:sos-realtime`: the new CTMS-066 test passed. The Host sees, in order:
  - "An Lệch Tuyến": Mới, Lệch tuyến, `16.04000, 108.20000 · ±8 m`, checkpoint Đèo Gió;
  - "Porter Cũ": Cũ, 15 phút trước;
  - "Bình Chưa Đồng Bộ": Chưa có dữ liệu.

  In the same run, `ctms-79-t02 … other Host gets nothing` failed. It also fails on `develop` with this task stashed: CTMS-76 (`9f7a9e6`) changed the SOS banner to show the Trip title instead of "Mã chuyến: …", and that E2E assertion was not updated.
- **Screenshots:**
  - `host-member-last-locations.png` (Playwright, running app);
  - `porter-member-locations.png` (the real widget at 412 dp, rendered by a temporary test that was deleted afterwards; no Android emulator is available on this machine).
- **Gates:**
  - `pnpm lint:all`: 0 errors (12 pre-existing warnings, none in changed files).
  - `pnpm build:all`: passed.
  - `pnpm test:all`:
    - API 2080/2082; the 2 `offline-packages` failures are pre-existing on `develop`;
    - web 1611/1611.
  - Default Playwright regression: 47 passed, 37 failed, 32 did not run. Compared with the CTMS-320 run, the only additional failure is `ctms-416-demand-insights.spec.ts › live API/database …`, a spec added on `develop` after that run; it fails identically on `develop` with this task stashed. No failure touches Trip detail, member locations or the Porter GPS section.

### UI Subtask DoD

- [x] UI implementation completed.
- [x] Applicable client-side behavior implemented.
- [x] Task-specific unit/component tests passed.
- [x] Backend integration completed.
- [x] Task-specific E2E tests passed.
- [x] All Story Acceptance Criteria verified (AC-1 location, AC-2 last_seen_at, AC-3 flags, AC-4 server-confirmed only, AC-5 restricted state).
- [x] Unit regression tests passed (except the pre-existing `develop` failures listed above).
- [x] E2E regression tests passed (see the regression result above).
- [x] lint:all passed.
- [x] build:all passed.
- [x] test:all passed (except the pre-existing `develop` failures listed above).
- [ ] Required CI checks passed — runs on the PR.
