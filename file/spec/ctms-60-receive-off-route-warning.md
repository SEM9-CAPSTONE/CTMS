# CTMS-060 — Receive Off-Route Warning

## 1. Overview

Story: CTMS-060

Epic: EPIC 9. GPS Navigation and Route Deviation

Use Case: Receive Off-Route Warning

Priority: Must Have

Goal: Detect route deviation locally from valid GPS samples and warn the Camper even without Internet.

Acceptance Criteria:

- `distance_to_route` is calculated locally from active package Route geometry.
- GPS sample is VALID for detection only when horizontal accuracy <= 20m.
- INVALID sample resets consecutive counters.
- OFF_ROUTE requires 3 consecutive VALID samples with distance > 50m.
- Recovery to ON_ROUTE requires 3 consecutive VALID samples with distance < 20m.
- 20–50m is a buffer zone and causes no new state transition.
- Confirmed OFF_ROUTE creates local warning and persisted safety event.
- No VALID GPS sample for >=2 minutes during ongoing Trip causes GPS_DEGRADED.
- New VALID sample recovers GPS state and restarts consecutive counters.

## 2. Scope

### In Scope

- Local distance-to-route calculation.
- GPS quality validation.
- OFF_ROUTE detection.
- ON_ROUTE recovery.
- Buffer zone.
- GPS_DEGRADED.
- Local warning.
- Safety-event persistence.

### Out of Scope

- Return-to-route guidance — CTMS-062.
- Server synchronization — CTMS-065.
- Host dashboard — CTMS-085.

## 3. Actors & Authorization

- Camper.
- Mobile safety-detection subsystem.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-052.
- CTMS-058.
- CTMS-059.

Trip is ongoing and active Offline Safety Package is available.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-238 | During an ongoing Trip, the client must calculate distance_to_route on-device from each VALID GPS sample to the Route geometry in the active package/version.                                                                                                                                                                                                                                             |
| BR-375 | The fixed V3 OFF_ROUTE distance threshold is 50 m from the GPS location to the nearest segment of the Route geometry in the active package/version.                                                                                                                                                                                                                                                       |
| BR-377 | OFF_ROUTE is confirmed only after three consecutive VALID GPS samples satisfy the BR-375 OFF_ROUTE threshold. If a VALID sample fails the threshold before three qualifying samples are reached, the OFF_ROUTE counter must reset to 0.                                                                                                                                                                  |
| BR-378 | In V3, any INVALID/low-confidence sample must reset the consecutive OFF_ROUTE, ON_ROUTE, and Checkpoint counters to 0; counters are not paused.                                                                                                                                                                                                                                                           |
| BR-382 | Recovery from OFF_ROUTE uses a fixed ON_ROUTE threshold of <20 m. The 20-50 m range is a buffer zone intended to prevent state oscillation near the OFF_ROUTE threshold.                                                                                                                                                                                                                                 |
| BR-383 | A member in OFF_ROUTE may transition back to ON_ROUTE only after three consecutive VALID GPS samples satisfy the BR-382 recovery threshold. If a VALID sample fails the recovery threshold before three qualifying samples are reached, the recovery counter must reset to 0.                                                                                                                              |
| BR-384 | When OFF_ROUTE is confirmed, a local warning must be issued regardless of network connectivity. The warning must clearly indicate that the user may be off-route and provide an appropriate safe action consistent with the approved UX/safety instructions.                                                                                                                                               |
| BR-386 | The local safety event must be persisted before, or within the same local transaction as, marking OFF_ROUTE as confirmed so an app crash or restart cannot lose an unsynchronized confirmed event.                                                                                                                                                                                                        |
| BR-387 | If no VALID GPS sample is available continuously for >=2 minutes while a Trip is ongoing, the Mobile Safety Engine must transition tracking state to GPS_DEGRADED and warn the Camper that GPS signal quality is insufficient to determine Route status reliably. GPS_DEGRADED must not be inferred as OFF_ROUTE. The client must continue GPS sampling according to the active sampling rule.             |
| BR-388 | When tracking state = GPS_DEGRADED and a VALID GPS sample is received again, tracking state must transition to NORMAL. Consecutive counters from before the degraded period must not be restored.                                                                                                                                                                                                         |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                                                                                                     |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                                                                                                              |

## 6. State & Lifecycle

Primary navigation state:

`ON_ROUTE`
→ 3 consecutive VALID samples >50m
→ `OFF_ROUTE`

`OFF_ROUTE`
→ 3 consecutive VALID samples <20m
→ `ON_ROUTE`

20–50m:
→ retain current state.

GPS quality state:

`NORMAL`
→ no VALID sample >=2 min
→ `GPS_DEGRADED`

`GPS_DEGRADED`
→ VALID sample received
→ `NORMAL`

On recovery, consecutive detection counters restart.

## 7. Business Flow

1. Receive GPS sample.
2. Check horizontal accuracy.
3. If accuracy >20m:
   - mark sample INVALID;
   - reset consecutive counters.
4. If VALID:
   - calculate distance to active Route locally.
5. If distance >50m:
   - increment off-route counter;
   - reset incompatible recovery counter.
6. At 3 consecutive qualifying samples:
   - confirm OFF_ROUTE;
   - vibrate/play sound;
   - show local warning;
   - persist safety event.
7. While OFF_ROUTE, VALID distance <20m increments recovery counter.
8. At 3 consecutive recovery samples:
   - transition ON_ROUTE.
9. 20–50m does not create a new transition.
10. Independently track time since last VALID GPS sample.
11. At >=2 minutes:

- enter GPS_DEGRADED;
- warn Camper.

12. New VALID sample:

- return GPS quality to NORMAL;
- restart counters.

## 8. Data & Invariants

Detection uses:

- active package Route geometry;
- package/version context;
- GPS event time;
- GPS accuracy;
- distance to Route.

Fixed V3 thresholds:

- VALID accuracy: `<=20m`
- OFF_ROUTE: `>50m × 3 consecutive VALID samples`
- recovery: `<20m × 3 consecutive VALID samples`
- buffer: `20–50m`
- GPS_DEGRADED: `no VALID sample >=2 minutes`

These thresholds must not be silently replaced by configurable values unless PB/BR is revised.

## 9. API / Integration Contract

Detection must work locally/offline.

Safety-event synchronization belongs to synchronization stories.

## 10. Error & Edge Cases

| Case                                   | Expected                      |
| -------------------------------------- | ----------------------------- |
| accuracy = 25m                         | INVALID                       |
| INVALID between two qualifying samples | Counter resets                |
| distances 55, 60, 65m                  | OFF_ROUTE                     |
| distances 55, 60, 30m                  | No OFF_ROUTE transition       |
| OFF_ROUTE then 18, 15, 12m             | ON_ROUTE                      |
| OFF_ROUTE then 18, 30, 15m             | Recovery not confirmed        |
| distance = 30m                         | Buffer; retain current state  |
| no VALID sample for 2 min              | GPS_DEGRADED                  |
| VALID sample returns                   | NORMAL + counters restart     |
| Internet unavailable                   | Detection/warning still works |

## 11. Acceptance & Test Matrix

| Scenario                           | Expected                      |
| ---------------------------------- | ----------------------------- |
| 3 VALID >50m                       | OFF_ROUTE                     |
| 2 VALID >50m                       | Remain current state          |
| INVALID sample interrupts sequence | Counter reset                 |
| 3 VALID <20m while OFF_ROUTE       | ON_ROUTE                      |
| 20–50m                             | No new transition             |
| accuracy >20m                      | INVALID                       |
| No VALID GPS >=2m                  | GPS_DEGRADED                  |
| Valid GPS returns                  | NORMAL                        |
| Offline OFF_ROUTE                  | Warning + event still created |

## 12. Open Decisions

None for V3 detection thresholds: the PB already fixes the applicable values. Do not replace them with inferred configurable thresholds.

Pending Decisions (raised during CTMS-060-T01, not resolved by any PB/BR value):

- **Authoritative Route/package version.** CTMS-052 Offline Safety Package versioning does not exist yet, so there is no package version to bind events to. Until it does, `routeVersion` is the md5 fingerprint of the Trip's Route geometry. This is safe because a Route referenced by a Trip cannot be edited in place. `package_version` is stored as reported by the client and may be null. Replace or complement `routeVersion` with the package/version identity once CTMS-052 provides it (BR-360, BR-428).
- **Participants who may report.** The spec names only the Camper. The implementation also accepts events from an assigned Porter, reusing the CTMS-059 participation rules (BR-363 "participant identity"). Confirm or narrow this when the Host dashboard (CTMS-085) consumes the events.
- **Retention period for `safety_events`.** No retention period has been approved. Rows are append-only and kept indefinitely, same as `gps_logs`.

## 13. Implementation Record

CTMS-060-T01 (Jira CTMS-311): system-side Preparation and Logic. Detection itself stays on the device (BR-238). The server supplies the data needed to detect offline and accepts the resulting events.

- **New `safety-events` API module** with migration `1792713600000-CreateSafetyEventsTable`, which creates `safety_events`:
  - client UUID as primary key, plus `trip_id`, `user_id`, `participant_role`;
  - `event_type` enum `OFF_ROUTE | ON_ROUTE_RECOVERED | GPS_DEGRADED | GPS_RESTORED`;
  - the original client context: `event_time`, optional `location` + `accuracy_meters`, `distance_to_route_meters`, `consecutive_valid_samples`, `no_valid_sample_since`, `detected_offline`;
  - version context: `route_id` (resolved by the server from the Trip), client `route_version`, optional `package_version`, `config_version`;
  - server `received_at`.

  Rows are append-only. CHECK constraints repeat the fixed V3 thresholds per type, so no row can claim a transition that its own context does not support, even when written outside the API.
- **`GET /api/trips/:tripId/route-deviation/context` (Preparation).** Returns:
  - eligibility, using the same BR-237 live rule as GPS tracking;
  - the Trip's Route id, `routeVersion` and GeoJSON geometry;
  - the fixed V3 thresholds as constants, not configuration (Section 8): accuracy ≤ 20 m, OFF_ROUTE > 50 m, recovery < 20 m, 3 consecutive samples, GPS_DEGRADED after 120 s, config version `v3`.
- **`POST /api/trips/:tripId/safety-events` (Logic).** Accepts at most 100 events and returns a per-event outcome: `accepted`, `duplicate` or `rejected` with a reason. Repeated or concurrent uploads of one UUID store one row and keep the first stored context (BR-244). A UUID owned by another user or Trip is rejected with `ID_CONFLICT`.
- **Event integrity without re-detection.** The server does not recompute distance or detection state from GPS data; the device result is kept as reported. It checks only that the reported context supports the transition:
  - the event was detected against the Trip's current Route (`ROUTE_VERSION_MISMATCH` otherwise);
  - OFF_ROUTE has accuracy ≤ 20, distance > 50 and ≥ 3 samples;
  - ON_ROUTE_RECOVERED has accuracy ≤ 20, distance < 20 and ≥ 3 samples;
  - GPS_DEGRADED has `event_time − no_valid_sample_since ≥ 120 s`;
  - GPS_RESTORED has a VALID sample;
  - anything else is rejected with `THRESHOLD_NOT_MET`.

  Participation and time-window rejections are the same as for GPS logs.
- **Audit.** Each newly accepted event writes one `audit_logs` row (`safety_event.received`) in the same SQL statement as the insert. A duplicate upload writes no second audit row.
- **Synced vs local state (BR-226).** `received_at` and the per-event outcomes are the only server-confirmed state; local detection state stays on the device. The device sync status (CTMS-067) `serverConfirmedSafetyCount` / `lastReceivedAt` and the Host member health now count `safety_events` together with `trip_incidents`. The DTO already described the count as "safety events/incidents"; this change was approved with the plan.
- **Shared participation rules.** The CTMS-059 participant resolution, live eligibility and participation-window checks moved unchanged from `GpsTrackingService` into `gps-tracking/gps-participant.ts`, so GPS logs and safety events apply identical rules. The existing GPS tests pass unchanged.
- `docs/report4/DATABASE-TABLE-DESCRIPTIONS.md` lists the new `safety_events` table (BR-212).

Judgment calls (the spec is silent; approved with the plan):

- `routeVersion` is the geometry fingerprint, and Porters may also report (see Pending Decisions).
- Malformed payloads are rejected as a whole with `422`. Examples: missing confirming sample for OFF_ROUTE / ON_ROUTE_RECOVERED / GPS_RESTORED, missing distance or sample count, missing `noValidSampleSince` for GPS_DEGRADED, a partial location, a timestamp without offset, a config other than `v3`, more than 100 events. Business rejections are per event, so one bad event never blocks the rest of a client buffer.
- A Trip whose Route cannot be resolved returns `409`.

## 14. Test Evidence

- **Unit:** 36 new tests, all passed: `safety-events.service.spec.ts` (23) and `dto/create-safety-events.dto.spec.ts` (13). They cover a valid path and a violation path for:
  - BR-375/377/378: 50 m boundary, 2 samples, accuracy 25 m vs exactly 20 m;
  - BR-382/383: 30 m buffer, exactly 20 m, 1 sample;
  - BR-387/388: 120 s vs 119 s, restored with accuracy 15 vs 25;
  - Route version mismatch, participation window, Trip status, Porter assigned/unassigned, idempotency and ID conflict.

  Full suite: `pnpm --filter @ctms/api test` → 1467/1467 passed (125/125 suites).
- **Integration** (`test/safety-events.integration-spec.ts`, real Postgres/PostGIS, no mocking): 14 passed. Covered:
  - context for Camper and Porter, version differs for a different geometry, non-ongoing Trip, 403/404/401;
  - exact persistence of the client context with the server Route and one audit row;
  - recovery, GPS_DEGRADED without location, and GPS_RESTORED from a Porter;
  - duplicate retry keeps the first context with no second audit row;
  - **5 concurrent uploads of one UUID store exactly one row**;
  - foreign UUID rejected; mixed batch with threshold, route-version and time-window rejections;
  - non-trackable Trip; 422 and 403;
  - DB CHECK rejects an inconsistent OFF_ROUTE row;
  - device sync status counts the accepted safety event.

  Full suite: `pnpm --filter @ctms/api test:integration` (8 shards) → 442/442 passed (44/44 suites), no regression in other modules.
- `pnpm --filter @ctms/api build` and `pnpm --filter @ctms/api lint` both pass clean.
- Backend-only task: no UI, so no screenshots.

### Logic Subtask DoD

- [x] Logic implementation completed.
- [x] Applicable business rules and invariants implemented.
- [x] Task-specific unit tests added or updated.
- [x] Task-specific unit tests passed.
- [x] Applicable backend or integration tests passed.
