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
