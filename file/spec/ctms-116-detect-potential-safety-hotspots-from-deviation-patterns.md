# CTMS-116 — Detect Potential Safety Hotspots from Deviation Patterns

## 1. Overview

Story: CTMS-116

Epic: EPIC 17. Reports and Evaluation Metrics

Use Case: Detect Potential Safety Hotspots from Deviation Patterns

Priority: Must Have

Goal: Detect recurring safety-relevant deviation patterns and create reviewable PotentialSafetyHotspot candidates without automatically changing authoritative Route or safety data.

Backlog story: As the System, I want to detect potential safety hotspots from historical deviation patterns so recurring risky locations can be reviewed.

Acceptance Criteria:

| Source  | Criterion                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------ |
| PB AC-1 | Historical RouteDeviationEvents may be aggregated to detect repeated patterns.                         |
| PB AC-2 | Detected result is a `PotentialSafetyHotspot`.                                                         |
| PB AC-3 | PotentialSafetyHotspot is a derived candidate, not authoritative hazard data.                          |
| PB AC-4 | AI/analytics cannot directly modify Route geometry, checkpoints, hazard areas, or safety instructions. |
| PB AC-5 | Safety aggregate minimizes personal data and respects authorization.                                   |

## 2. Scope

### In Scope

- Historical deviation aggregation.
- Pattern detection.
- PotentialSafetyHotspot candidate.
- Supporting evidence.

### Out of Scope

- Automatic hotspot confirmation.
- Automatic Route/hazard modification.

## 3. Actors & Authorization

Primary actor:

- System analytics/AI.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-115.

Sufficient eligible RouteDeviationEvent evidence exists.

## 5. Business Rules

| BR                     | Rule                                                                                                                                                                                                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-355                 | PotentialSafetyHotspot is a derived safety candidate generated from historical RouteDeviationEvents and is not an authoritative hazard.                                                                                                                                                                   |
| BR-356                 | AI/analytics must not automatically modify Route geometry, checkpoints, route_hazard_areas, or safety instructions based on GPS patterns. Analysis results may only create suggestions/candidates for verification by an authorized person.                                                               |
| BR-361                 | Safety statistics and hotspot aggregates may be retained longer than raw GPS data, but they must minimize personal data, enforce authorization, and must not expose raw member locations to Hosts/Admins outside authorized operational, safety-review, or audit purposes.                                |
| BR-417                 | Hotspot detection uses a 30-day rolling window. A candidate may be created only for the same Route and a spatial cluster <=50 m with at least 3 distinct Trips, at least 3 distinct Members, and at least 5 RouteDeviationEvents. The system must store the evidence counts, window, and cluster context. |
| BR-418                 | Repeated RouteDeviationEvents from the same Trip or the same Member must not be counted as distinct Trips or Members when evaluating hotspot creation criteria.                                                                                                                                           |
| BR-420                 | A hotspot candidate must store analysis_version and config_version sufficient for a reviewer to identify the logic that created the candidate and reproduce the result.                                                                                                                                   |
| BR-421                 | Two spatially overlapping candidates must not be automatically merged when they belong to different Route versions or evidence windows unless an explicit merge policy exists. Any deduplication or merge must preserve the provenance of the original evidence.                                          |
| BR-422                 | A DISMISSED hotspot must not automatically become an authoritative hazard. If future data again meets detection criteria, the system may create or reopen a candidate according to an explicit re-detection policy, while preserving the prior dismissal history.                                         |

## 6. State & Lifecycle

RouteDeviationEvents
→ pattern analysis
→ PotentialSafetyHotspot `DETECTED`
→ CTMS-117 review.

## 7. Business Flow

1. Load eligible deviation events.
2. Minimize participant-level data.
3. Analyze recurring spatial/Route patterns.
4. Determine whether configured candidate criteria are satisfied.
5. Create PotentialSafetyHotspot.
6. Attach sufficient review evidence.
7. Set candidate to `DETECTED`.
8. Send to human review flow.

## 8. Data & Invariants

PotentialSafetyHotspot is:

- derived;
- reviewable;
- non-authoritative.

Creation must not mutate:

- Route geometry;
- checkpoints;
- route_hazard_areas;
- safety instructions.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                                    | Expected Behavior        |
| ------------------------------------------------------- | ------------------------ |
| Repeated deviation pattern                              | Candidate may be created |
| Insufficient evidence                                   | Do not fabricate hotspot |
| AI detects pattern                                      | Remains candidate        |
| Candidate created                                       | Route unchanged          |
| Raw member location requested outside permitted purpose | Do not expose            |

## 11. Acceptance & Test Matrix

| Source      | Scenario              | Expected Result                    | Test Type |
| ----------- | --------------------- | ---------------------------------- | --------- |
| BR-355      | Pattern detected      | Potential hotspot created          | Analytics |
| BR-356      | Candidate created     | No Route mutation                  | Integrity |
| BR-361      | Aggregate generated   | Personal data minimized            | Privacy   |
| Hotspot BRs | Insufficient evidence | No fabricated authoritative hazard | Safety    |

## 12. Open Decisions

Detection thresholds are configuration/evaluation inputs defined by the mapped hotspot rules; no additional threshold is introduced here.
