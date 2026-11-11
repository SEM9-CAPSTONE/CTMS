# CTMS-062 — View Direction and Distance Back to Route

## 1. Overview

Story: CTMS-062

Epic: EPIC 9. GPS Navigation and Route Deviation

Use Case: View Direction and Distance Back to Route

Priority: Must Have

Goal: Help an off-route user navigate back toward the nearest appropriate point on the downloaded Route without requiring Internet connectivity.

Backlog story: As a Camper, I want to see the direction and distance back to the Route when I go off-route.

Acceptance Criteria:

| Source  | Criterion                                                                        |
| ------- | -------------------------------------------------------------------------------- |
| PB AC-1 | System determines a nearest return point using available offline Route data.     |
| PB AC-2 | System displays distance to that return point.                                   |
| PB AC-3 | System displays recommended movement direction.                                  |
| PB AC-4 | Guidance works from downloaded Route data without requiring server connectivity. |

## 2. Scope

### In Scope

- Nearest Route return point.
- Distance back to Route.
- Recommended direction.
- Offline calculation.

### Out of Scope

- OFF_ROUTE detection — CTMS-060.
- Full turn-by-turn navigation.
- Modifying Route geometry.

## 3. Actors & Authorization

- Camper.
- Mobile navigation subsystem.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-052.
- CTMS-058.
- CTMS-060.

Active package Route and current location are available.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-240     | When a user is off-route, the system must show the nearest re-entry point on the Route, the distance to that point, and recommended movement direction based on the Route data available offline. |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.             |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                      |

## 6. State & Lifecycle

OFF_ROUTE
→ calculate return target
→ display direction/distance
→ user approaches Route.

Actual OFF_ROUTE→ON_ROUTE transition remains governed by CTMS-060.

## 7. Business Flow

1. Receive OFF_ROUTE state.
2. Read current valid location.
3. Load active Route geometry locally.
4. Calculate nearest appropriate point on Route.
5. Calculate distance.
6. Calculate recommended direction.
7. Render guidance.
8. Recalculate as location changes.
9. Leave state transition decision to CTMS-060.

## 8. Data & Invariants

- Guidance uses active package Route.
- Current GPS quality must be represented accurately.
- Guidance does not itself declare ON_ROUTE.
- No Internet dependency for core calculation.

## 9. API / Integration Contract

Core calculation: local.

CTMS-315 provides the read-only online validation contract at
`GET /api/trips/:tripId/route-recovery/context?packageId=<uuid>&packageVersion=<integer>`.
It validates the exact client-selected package against one read-only DB snapshot.
AVAILABLE/STALE may include only verified package geometry; UNAVAILABLE/MISMATCH
withhold geometry. It does not determine which package is active on a device,
activate a package or change Trip/Route state. Existing route-deviation API behavior
is unchanged. See [CTMS-315 implementation contract](../../docs/features/CTMS-315-Route-Recovery-Context.md)
for reason codes, authorization, snapshot guarantees and the CTMS-316 handoff.

Client calculation conventions: WGS84/EPSG:4326 `[longitude, latitude]`, original
LineString order, horizontal distance in metres, absolute bearing clockwise from
true north normalized to `[0,360)`. GPS validity and the OFF_ROUTE/ON_ROUTE state
remain governed by the existing GPS/deviation rules. On-device return-point,
distance and bearing calculation and UI integration are delivered by CTMS-316.

## 10. Error & Edge Cases

| Case                    | Expected Behavior                      |
| ----------------------- | -------------------------------------- |
| No Internet             | Guidance remains available             |
| GPS unavailable         | Do not fabricate direction             |
| Package missing         | Guidance unavailable                   |
| Route geometry invalid  | Do not provide misleading return point |
| User reaches near Route | CTMS-060 decides recovery              |

## 11. Acceptance & Test Matrix

| Source  | Scenario              | Expected Result    | Test Type  |
| ------- | --------------------- | ------------------ | ---------- |
| BR-240  | Off-route + valid GPS | Return point shown | E2E        |
| BR-240  | Valid return point    | Distance shown     | Navigation |
| BR-240  | Valid return point    | Direction shown    | Navigation |
| PB AC-4 | Airplane mode         | Guidance works     | Offline    |

## 12. Open Decisions

Exact direction presentation—bearing, arrow, compass UI—is Technical Design/UI.

CTMS-316 uses the [client decision table](../../docs/features/CTMS-316-Route-Recovery-UI.md).
STALE contexts withhold guidance. Network/timeout fallback is allowed only for an
exact previously AVAILABLE, still locally verified package, with an explicit
unverified-again label and observation time. HTTP 401/403/404 and server errors do
not grant fallback. GPS usability reuses accuracy <=20 m, age <=30 s and future
skew <=5 s; this presentation gate does not alter CTMS-060 navigation transitions.
