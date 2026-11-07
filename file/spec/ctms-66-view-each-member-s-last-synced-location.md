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
