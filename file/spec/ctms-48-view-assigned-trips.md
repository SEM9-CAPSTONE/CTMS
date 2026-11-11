# CTMS-048 — View Assigned Trips

## 1. Overview

Story: CTMS-048

Epic: EPIC 7. Porter Management

Use Case: View Assigned Trips

Priority: Must Have

Goal: Allow Porter to view the Trips for which the Porter has an authoritative Assignment.

Acceptance Criteria:

| Source  | Criterion                                                                              |
| ------- | -------------------------------------------------------------------------------------- |
| PB AC-1 | Porter can view their assigned Trips.                                                  |
| PB AC-2 | Only assignments belonging to the authenticated Porter are returned.                   |
| PB AC-3 | Trip information is projected according to Porter operational visibility.              |
| PB AC-4 | Assignment/Trip state shown is authoritative.                                          |
| AC-2    | Assigned Trip operations include schedule, meeting point, and Route information.       |
| AC-3    | Relevant operational members, Route checkpoints, and hazards are available.            |
| AC-4    | Weather observations and offline-package availability are represented truthfully.      |
| AC-5    | Missing, unavailable, failed, and stale operational data are explicitly distinguished. |

## 2. Scope

### In Scope

- Assigned Trip list.
- Assignment details needed by Porter.
- Operational Trip projection.

### Out of Scope

- Creating Assignment.
- Viewing other Porters' assignments.
- Public Trip search.

## 3. Actors & Authorization

- Porter.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-047.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-160 | A Porter may view only Trips for which they have a valid assignment and may access only operationally necessary data: schedule, Trip, required Route/checkpoint/hazard information, joined members as authorized, weather, and offline package. The assignment does not grant broader administrative access. |
| BR-220 | The Porter profile/availability screen may expose only fields required for operations. Eligibility must be computed from profile state, availability, applicable qualification, and assignment conflicts.                                                                                                    |

## 6. State & Lifecycle

Read-only.

Assignment state determines whether/how Trip appears in assigned-Trip views according to the authoritative visibility policy.

The current visibility policy admits only `trip_porters.status = assigned`. A pending request, `pending_reconfirmation`, or `unassigned` record does not authorize operational detail access. Revoking an Assignment removes its Trip from the list and causes subsequent detail reads to return `404`. The Trip's own current status is returned as stored, including ongoing, completed, or cancelled; it is not inferred from cached dates.

## 7. Business Flow

1. Authenticate Porter.
2. Query assignments for Porter.
3. Resolve related Trips.
4. Apply assignment-state visibility.
5. Apply operational projection.
6. Return assigned Trips.

## 8. Data & Invariants

- Porter cannot retrieve another Porter's assignments.
- Assignment is authoritative.
- Trip operational data respects visibility rules.
- Internal unrelated Host data is excluded.

## 9. API / Integration Contract

- `GET /api/trips/assigned`: authenticated Porter only. Returns the authenticated Porter's assigned Trips, ordered by departure time and Trip ID. Caller-supplied Porter identity cannot change the scope.
- The Porter sidebar item `Phân công` opens `/porter/assignments`, protected by the Porter role. It reuses the assigned-Trip panel and supports direct navigation, page reload, and navigation to the operational member roster.
- `GET /api/trips/assigned/:tripId`: authenticated Porter only. Returns an explicit operational projection when an authoritative `assigned` record belongs to the caller; otherwise `404`. Invalid Trip IDs return `422`. Missing authentication returns `401`; other roles receive `403`.
- Assignment authorization, Trip, Route/checkpoints/hazards, permitted members, and recorded weather are read in one database statement so the response uses a consistent snapshot. `retrievedAt` identifies that snapshot.
- Member projection contains only `memberId`, `displayName`, and `memberStatus`. It includes registered, joined, no-show, and left members in confirmed, pending-reconfirmation, or completed bookings. Removed members and cancelled/expired/unpaid bookings are excluded from this preparation view. Existing authorized roster operations remain separate.
- The projection excludes Host administration data, compensation, booking finances, member contact/health/emergency information, and raw weather-provider responses. These endpoints return `Cache-Control: private, no-store`.
- Weather is taken from the latest fetch attempt. Failed, missing, invalid/future-dated, or incomplete observations are `unavailable`; an older successful attempt cannot silently replace a newer failure. Successful observations aged at least 60 minutes are `stale`; younger observations are `recorded`. This 60-minute threshold is the current operational display policy. Observations are timestamped historical readings, not a confirmed forecast for departure. Risk is shown only when assessed from the same snapshot; an absent assessment is unknown, never a default low risk.
- No offline-package download/tracking implementation currently exists in this application. The response explicitly reports `offlinePackage.status = unavailable` and `downloadedAt = null`; the UI must not claim a package was downloaded or enable an unsupported download.
- Frontend query caches are scoped by authenticated Porter identity and refresh every 15 seconds. Cached data is labelled with its retrieval time; failed or revoked detail reads hide cached operations. Revoked detail access also refreshes the assignment list. The existing Route checkpoint/hazard map and member-roster navigation are reused.
- BR-220 eligibility calculation remains owned by the existing Porter profile/availability and invitation/assignment flows. This read operation neither creates eligibility nor revalidates a valid Assignment away because the Porter's availability changed after assignment. Its projection grants no extra administrative/profile visibility.

## 10. Error & Edge Cases

| Case                                  | Expected Behavior                           |
| ------------------------------------- | ------------------------------------------- |
| No assignments                        | Empty list.                                 |
| Assignment cancelled/invalidated      | Reflect authoritative state/visibility.     |
| Porter requests another Porter's list | Reject/ignore target identity.              |
| Trip updated                          | Current permitted Trip projection returned. |

## 11. Acceptance & Test Matrix

| Source | Scenario                                           | Expected Result                                                 | Test Type                      |
| ------ | -------------------------------------------------- | --------------------------------------------------------------- | ------------------------------ |
| BR-160 | Porter has assignments                             | Assigned Trips returned                                         | E2E                            |
| BR-160 | No assignments                                     | Empty result                                                    | Integration                    |
| BR-160 | Another Porter's assignment                        | Not exposed                                                     | Security                       |
| BR-160 | Trip has restricted data                           | Restricted fields omitted                                       | Security                       |
| BR-160 | Pending reconfirmation or unassigned               | Not listed; operational detail denied                           | Integration                    |
| BR-160 | Assignment revoked after initial read              | Subsequent detail denied and list updated                       | Integration / Component        |
| BR-160 | Caller supplies another Porter ID                  | Identity ignored; authenticated scope retained                  | Security                       |
| BR-160 | Ongoing/completed/cancelled Trip                   | Stored current Trip state returned while Assignment is valid    | Integration                    |
| BR-160 | Route checkpoints and hazards                      | Authorized geometry and operational instructions returned       | Integration / Component        |
| BR-160 | Joined members and preparation roster              | Whitelisted member fields; unrelated/inactive bookings excluded | Integration                    |
| BR-160 | Failed latest weather fetch                        | Unavailable, no fabricated current reading                      | Integration / Unit             |
| BR-160 | Weather at exact staleness boundary                | Stale at 60 minutes; timestamp retained                         | Integration / Unit / Component |
| BR-160 | Weather unknown or incomplete                      | No confirmed risk or substituted zero readings                  | Unit / Component               |
| BR-160 | Missing offline support                            | Explicit unavailable state; no downloaded claim                 | Integration / Component        |
| BR-160 | Different Porter logs in using the same browser    | Cached assignments are not shared                               | Component                      |
| BR-220 | Existing availability/qualification/conflict rules | Existing eligibility and privacy guards remain effective        | Integration                    |

Implementation coverage is in `trips.roster.integration-spec.ts`, `trips.operations.service.spec.ts`, `useAssignedTrips.test.ts`, and `PorterAssignedTripsPanel.test.tsx`. BR-220's existing eligibility cases are in `trips.available-porters.integration-spec.ts`. Test types describe required coverage; browser E2E execution must be recorded separately from unit, component, and API integration results.

## 12. Open Decisions

Exact grouping/sorting of assigned Trips is a UI/API design concern unless separately specified.
