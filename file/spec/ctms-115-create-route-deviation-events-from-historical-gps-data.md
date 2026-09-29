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

TBD — Technical Design.

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
