# CTMS-115 — Create Route Deviation Events from Historical GPS Data

## 1. Overview

Story: CTMS-115

Epic: EPIC 9. GPS Navigation and Route Deviation

Use Case: Create Route Deviation Events from Historical GPS Data

Priority: Must Have

Goal: Convert eligible historical GPS/deviation evidence into traceable Route Deviation Event episodes for later safety analysis.

Backlog story: As the System, I want to create Route Deviation Events from historical GPS data so repeated deviation patterns can be analyzed.

Acceptance Criteria:

| Source  | Criterion                                                                                   |
| ------- | ------------------------------------------------------------------------------------------- |
| PB AC-1 | Historical analysis uses eligible Trip safety/GPS evidence.                                 |
| PB AC-2 | Related deviation samples/logs are grouped into auditable Route Deviation Event episodes.   |
| PB AC-3 | Episode stores start/end time and Route/Trip/member context.                                |
| PB AC-4 | Episode stores related sample/log count and distance summary/evidence.                      |
| PB AC-5 | Package/config/version context is retained so historical safety state can be reconstructed. |
| PB AC-6 | Multiple Route Deviation Events may later be aggregated for safety-pattern analysis.        |

## 2. Scope

### In Scope

- Historical GPS analysis.
- RouteDeviationEvent.
- Episode grouping.
- Evidence/version context.

### Out of Scope

- Automatically declaring a safety hotspot authoritative.
- Modifying Route geometry.

## 3. Actors & Authorization

Primary actor:

- System safety-analysis process.

Authorized safety/audit users may access evidence only within permitted scope.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-059.
- CTMS-060.
- CTMS-065.

Historical eligible GPS/safety evidence exists.

## 5. Business Rules

| BR                          | Rule                                                                                                                                                                                                                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-352                      | Historical GPS analysis may run only on Trips eligible for analysis, preferably completed Trips, and must preserve the Route/package version context from when the Trip occurred. Historical data must not be compared against current geometry while ignoring version differences.                      |
| BR-353                      | RouteDeviationEvent is derived data representing a deviation episode, not a copy of each gps_log. An episode must include started_at/ended_at, Route/Trip/member context, the count of related samples/logs, maximum/summary distance, and sufficient evidence for audit.                                |
| BR-354                      | Historical safety analysis may aggregate multiple RouteDeviationEvents to identify patterns such as multiple people deviating at the same location, repeated deviations on the same Route segment, or a high proportion of Trips experiencing deviation in the same area.                                |
| BR-360                      | The Trip/client must be able to identify the package version used when GPS or safety data is recorded. GPS logs, safety events, and sync payloads must carry enough reference/version context for historical analysis to reconstruct the safety data that was in effect at event time.                   |
| BR-362                      | Safety tracking may be active only for Trips in operational states permitted by the V3 state machine. GPS collected outside the Trip's operational window must not be treated as Trip operational safety evidence unless an explicit recovery/admin policy allows it.                                    |
| BR-363                      | Each on-device safety-tracking session must be associated, at minimum, with trip_id, a valid member_id or participant identity, device/session context, and the active offline_package_id/version. If required context is missing, the event must not be recorded as an authoritative Trip safety event. |
| BR-368                      | During an ongoing Trip, the GPS sampling interval is fixed at one sample every 10 seconds in V3. Admins and clients must not be able to change this interval.                                                                                                                                            |

## 6. State & Lifecycle

Historical GPS/safety records
→ eligible evidence selection
→ deviation samples grouped
→ RouteDeviationEvent created
→ available for historical safety analysis.

## 7. Business Flow

1. Load eligible historical GPS/safety records.
2. Verify Trip operational context.
3. Verify participant/session/package context.
4. Identify related deviation evidence.
5. Group evidence into deviation episode.
6. Determine started_at/ended_at.
7. Calculate required distance/evidence summary.
8. Persist RouteDeviationEvent.
9. Retain source/version traceability.

## 8. Data & Invariants

RouteDeviationEvent includes applicable:

- started_at;
- ended_at;
- Route;
- Trip;
- participant/member;
- sample/log count;
- distance summary/max distance;
- source evidence;
- package/config/version context.

Historical analysis must not reinterpret data using an unrelated package version.

## 9. API / Integration Contract

Admin only (authorized safety/audit user; `JwtAuthGuard` + `RolesGuard`, role `admin`), see §13:

| Method | Path | Result |
| --- | --- | --- |
| POST | `/api/admin/route-deviation-analysis/trips/:tripId/run` | 200 analysis summary (replaces this Trip's episodes for the current analysis version); 404 unknown Trip; 409 Trip not completed; 422 bad id |
| GET | `/api/admin/route-deviation-analysis/trips/:tripId` | `{ analysis, events }`; 404 when not analysed yet |
| GET | `/api/admin/route-deviation-events?tripId=&routeId=&authoritative=&limit=` | Episodes newest first (default 50, max 200) |

Background: `RouteDeviationAnalysisWorker` when `ROUTE_DEVIATION_ANALYSIS_WORKER_ENABLED=true` (`ROUTE_DEVIATION_ANALYSIS_INTERVAL_MS`, default 10 min; `ROUTE_DEVIATION_ANALYSIS_BATCH_SIZE`, default 20).

## 10. Error & Edge Cases

| Case                                     | Expected Behavior                        |
| ---------------------------------------- | ---------------------------------------- |
| Valid historical episode                 | Event created                            |
| GPS outside valid Trip context           | Not automatically authoritative          |
| Missing required package/session context | Do not treat as authoritative event      |
| Multiple samples in same episode         | Group according to approved episode rule |
| Historical package differs from current  | Preserve historical version              |

## 11. Acceptance & Test Matrix

| Source     | Scenario                 | Expected Result                      | Test Type    |
| ---------- | ------------------------ | ------------------------------------ | ------------ |
| BR-352/353 | Valid deviation episode  | Event created                        | Data         |
| BR-360     | Historical event         | Package context retained             | Traceability |
| BR-362     | GPS outside Trip window  | Not automatically accepted           | Safety       |
| BR-363     | Missing required context | Rejected from authoritative evidence | Integrity    |
| BR-354     | Multiple events          | Available for aggregate analysis     | Integration  |

## 12. Open Decisions

Exact episode grouping algorithm must follow the mapped historical-analysis rules/configuration; no new numeric grouping threshold is introduced here.

## 13. Implementation Record — Logic (Jira CTMS-433, [CTMS-115-T01])

Branch `feat/CTMS-433-route-deviation-events-logic`. Module `services/api/src/modules/route-deviation-analysis`. Decisions A and B approved 2026-11-13.

**Eligible evidence (AC1, BR-352, BR-362).** Only Trips with status `completed`. Each stored `gps_logs` row is checked with the same participation rule as live uploads (`gps-participant.ts` `participationRejection`): Camper JOINED/LEFT on a confirmed or completed Booking, from check-in to the end of the Trip window (or leaving); Porter assigned in `trip_porters`. Logs outside the window or of a user with no eligible role are excluded and counted per reason on the analysis row.

**Replay (decision B, AC2–AC5).** Distance to the Trip's Route is computed in PostGIS (`ST_Distance` on geography, metres; position along the Route with `ST_LineLocatePoint`). Each participant's logs are replayed in time order by the pure function `replayRouteDeviation`, a mirror of the on-device detector (CTMS-312) using the shared constants in `safety-events.constants.ts`:
- valid sample = accuracy ≤ 20 m; an invalid sample resets both counters;
- OFF_ROUTE after 3 consecutive valid samples strictly farther than 50 m (the 20–50 m buffer resets the counter);
- back ON_ROUTE after 3 consecutive valid samples strictly closer than 20 m;
- no valid sample for ≥ 120 s resets both counters without changing the state.

No new numeric threshold is introduced (§12). History only keeps the 30 s logs (the 10 s samples stay on the device), so 3 consecutive samples span about 90 s in the replay; deviations shorter than that may not appear. The runtime context (10 s sampling, 30 s logging, all thresholds, config `v3`) is stored on every analysis and episode.

**RouteDeviationEvent (AC6, BR-353).** Table `route_deviation_events` (migration `1795600000000`), one row per episode, never one per log:
- context: Trip, Route, route version (md5 of the Route geometry, stable because a Route used by a Trip cannot be edited), package version, user and participant role;
- time: `started_at` (first off-route sample), `confirmed_at` (3rd), `ended_at` (first recovery sample, or the last sample when the evidence ended off route), `recovery_confirmed_at`, `end_reason` `RECOVERED` / `EVIDENCE_ENDED`;
- summary: sample count, valid sample count, max and average distance, start point and max-distance point (geography, GiST index for CTMS-116 clustering), start position along the Route;
- evidence: first and last `gps_logs` ids, ids of the device's own OFF_ROUTE / ON_ROUTE_RECOVERED `safety_events` within 120 s of the episode (cross-check only);
- versions: `analysis_version` `v1-gps-log-replay`, `config_version`, runtime context.

Raw `gps_logs` and `safety_events` are only read.

**Package context (decision A, BR-360, BR-363).** Package version = the version on the episode's logs, else the Trip's offline package generated before departure. None → `authoritative = false` with `PACKAGE_VERSION_MISSING`; two versions in one episode → `PACKAGE_VERSION_INCONSISTENT`. A CHECK keeps `authoritative` equal to "no context issue". Episodes are still stored, so nothing is lost when the context becomes available.

**Idempotency.** `route_deviation_trip_analyses` holds one row per (Trip, analysis version) with participants, samples total/used/excluded and episode count. A run locks the Trip row (`FOR UPDATE`; the worker uses `SKIP LOCKED`) and replaces that Trip's analysis and episodes in one transaction; `UNIQUE (analysis_version, start_gps_log_id)` guards against duplicates. A new analysis version re-analyses every Trip without mixing results (BR-421 for CTMS-116).

**For CTMS-116 (AC6, BR-354).** Episodes are indexed by Route, route version and start time, with a GiST index on the start point, ready for the 30-day / same-Route / spatial clustering of CTMS-116, which should use `authoritative = true` episodes only.

## 14. Test Evidence — CTMS-433

- Unit `route-deviation-replay.spec.ts` (10): open on 3 × > 50 m and close on 3 × < 20 m; exactly 50 m and the buffer reset; accuracy 25 m / null invalid and exactly 20 m valid; invalid sample inside an episode resets recovery; exactly 20 m does not recover; 120 s gap resets, 119 s does not; evidence ending off route; two episodes; package context (log version, offline package, missing, inconsistent). `route-deviation-analysis.worker.spec.ts` (2).
- Integration `test/route-deviation-analysis.integration-spec.ts` (3, real PostGIS): a completed Trip with a Camper and an assigned Porter gives 2 episodes with the right start log, counts, distances, route version, device event link and package context (Camper non-authoritative, Porter with package 5 authoritative); logs before check-in excluded (3); raw logs untouched; re-run gives the same episodes without duplicates; an ongoing Trip gives 409 and is never queued; an empty completed Trip is analysed with 0 episodes and leaves the queue; 404 / 422 / filter validation; Host 403; anonymous 401.
- GPS, safety-events, schedule-progress, member-locations, route-safety and offline-package suites pass. Failing on this machine and unrelated: `trekking-route-checkpoints` (2, pre-existing since 2026-11-03) and `route-recovery` (all tests: its own DB connection fails with "SASL: client password must be a string", an environment setting, before any code runs).
- API jest 211 suites, 2 519 tests passed. `lint:all` 0 errors. `build:all` passes. Backend only, no UI.

### DoD — CTMS-433

- [x] Logic implementation completed
- [x] Applicable business rules/invariants implemented (BR-352, BR-353, BR-360, BR-362, BR-363, BR-368)
- [x] Task-specific unit tests added and passed
- [x] Applicable backend/integration tests passed (unrelated failures noted above)
- [x] Story Acceptance Criteria AC1–AC6 covered by tests
- [x] Unit regression tests passed
- [ ] Applicable E2E: none, backend only
- [x] lint:all passed
- [x] build:all passed
- [ ] Required CI checks: after the PR is opened

### Pending Decision

- The mobile app does not send `packageVersion` on `gps_logs` / `safety_events` yet, so on current data almost every episode is non-authoritative (`PACKAGE_VERSION_MISSING`) unless the Trip has an offline package. Either the mobile app sends the package version, or the leader accepts the Route geometry md5 as a substitute context; then re-run the analysis (idempotent).
