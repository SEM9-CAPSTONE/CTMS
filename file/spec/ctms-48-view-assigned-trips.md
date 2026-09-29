# CTMS-048 — View Assigned Trips

## 1. Overview

Story: CTMS-048

Epic: EPIC 7. Porter Management

Use Case: View Assigned Trips

Priority: Must Have

Goal: Allow Porter to view the Trips for which the Porter has an authoritative Assignment.

Acceptance Criteria:

| Source  | Criterion                                                                 |
| ------- | ------------------------------------------------------------------------- |
| PB AC-1 | Porter can view their assigned Trips.                                     |
| PB AC-2 | Only assignments belonging to the authenticated Porter are returned.      |
| PB AC-3 | Trip information is projected according to Porter operational visibility. |
| PB AC-4 | Assignment/Trip state shown is authoritative.                             |

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

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                  | Expected Behavior                           |
| ------------------------------------- | ------------------------------------------- |
| No assignments                        | Empty list.                                 |
| Assignment cancelled/invalidated      | Reflect authoritative state/visibility.     |
| Porter requests another Porter's list | Reject/ignore target identity.              |
| Trip updated                          | Current permitted Trip projection returned. |

## 11. Acceptance & Test Matrix

| Source | Scenario                    | Expected Result           | Test Type   |
| ------ | --------------------------- | ------------------------- | ----------- |
| BR-160 | Porter has assignments      | Assigned Trips returned   | E2E         |
| BR-160 | No assignments              | Empty result              | Integration |
| BR-160 | Another Porter's assignment | Not exposed               | Security    |
| BR-220 | Trip has restricted data    | Restricted fields omitted | Security    |

## 12. Open Decisions

Exact grouping/sorting of assigned Trips is a UI/API design concern unless separately specified.
