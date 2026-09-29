# CTMS-059 — Record GPS Breadcrumbs During Trekking

## 1. Overview

Story: CTMS-059

Epic: EPIC 9. GPS Navigation and Route Deviation

Use Case: Record GPS Breadcrumbs during Trekking

Priority: Must Have

Goal: Capture reliable GPS samples/logs during an ongoing Trip for safety detection and later synchronization.

Acceptance Criteria:

- Runtime GPS sample interval: 10 seconds.
- Raw `gps_log` persistence boundary: 30 seconds.
- Logging only occurs for an ongoing Trip and eligible participant.
- Location permission is required.
- Logs preserve stable ID, event time, coordinates, accuracy and version context.
- Old coordinates must not be copied and represented as fresh GPS data.

## 2. Scope

### In Scope

- Runtime GPS sampling.
- GPS breadcrumb persistence.
- Stable local identity.
- Event time.
- Accuracy.
- Altitude/battery when available.
- Package/config version context.

### Out of Scope

- Off-route transition logic — CTMS-060.
- Sync implementation — CTMS-065.

## 3. Actors & Authorization

- Joined Camper.
- Assigned Porter.
- Mobile client/system.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-058.

Conditions:

- Trip = ongoing.
- Camper has joined OR Porter has valid Assignment.
- Location permission granted.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-237 | GPS breadcrumb logging may occur only while the Trip is ongoing and the user is either a joined Camper or a Porter with a valid assignment for that Trip, and only after location permission has been granted. Logging must stop once Trip/participation state no longer permits tracking. Logs are identified by user + Trip, not by device identity. |
| BR-188 | Absolute timestamps must be stored as timestamptz. Pure calendar dates use date, and time-of-day values use time where defined by schema. APIs must transmit timezone/offset explicitly, and the UI must display values using the configured timezone.                                                                                                  |
| BR-368 | During an ongoing Trip, the GPS sampling interval is fixed at one sample every 10 seconds in V3. Admins and clients must not be able to change this interval.                                                                                                                                                                                           |
| BR-396 | The GPS logging interval is fixed at one log every 30 seconds in V3. gps_log must use an appropriate sample at the logging boundary and must not fabricate a location by copying a stale sample without quality/staleness context.                                                                                                                      |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                                                   |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                                                            |

## 6. State & Lifecycle

Eligible ongoing participation
→ tracking active.

Every 10s:
→ runtime GPS sample.

Every 30s logging boundary:
→ eligible sample persisted as GPS log.

Trip/participation no longer eligible
→ tracking stops.

## 7. Business Flow

1. Confirm Trip ongoing.
2. Confirm user participation/Assignment.
3. Confirm location permission.
4. Start 10-second runtime sampling.
5. Evaluate sample freshness/quality.
6. Use samples for local safety detection.
7. At each 30-second logging boundary, persist appropriate GPS sample.
8. Attach stable UUID/local ID.
9. Preserve event time and version context.
10. Stop tracking when eligibility ends.

## 8. Data & Invariants

Each persisted log includes:

- stable UUID/local ID;
- user;
- Trip;
- event time;
- latitude;
- longitude;
- accuracy;
- package/config version;
- altitude when available;
- battery when available.

Important:

`device_id` is not the logical owner of breadcrumb history.

No fabricated fresh coordinate from stale sample.

## 9. API / Integration Contract

Local persistence first.

Server synchronization belongs to CTMS-064/065.

## 10. Error & Edge Cases

| Case                           | Expected                                |
| ------------------------------ | --------------------------------------- |
| Trip not ongoing               | No tracking                             |
| Camper not joined              | No tracking                             |
| Porter not assigned            | No tracking                             |
| Permission denied              | No GPS logging                          |
| No new GPS sample              | Do not invent coordinate                |
| App/device temporarily offline | Local capture continues where supported |
| Participation ends             | Stop logging                            |

## 11. Acceptance & Test Matrix

| Scenario              | Expected                                   |
| --------------------- | ------------------------------------------ |
| Ongoing eligible Trip | GPS sampling starts                        |
| 10 seconds elapsed    | New runtime sample requested               |
| 30-second boundary    | GPS log persisted                          |
| Trip completed        | Logging stops                              |
| Permission revoked    | Logging stops                              |
| Stale coordinate      | Not represented as fresh sample            |
| Device changes        | Logical history remains user + Trip scoped |

## 12. Open Decisions

Background-location OS permissions and power-management implementation belong to Technical Design.
