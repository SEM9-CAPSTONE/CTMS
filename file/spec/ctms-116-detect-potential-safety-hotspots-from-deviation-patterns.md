# CTMS-116 — Detect Potential Safety Hotspots from Deviation Patterns

## CTMS-052 dependency clarification — 2026-11-06

This is the GPS-derived hotspot pipeline. Its `CONFIRMED PotentialSafetyHotspot` is separate from Host verification of an individual CTMS-049 incident. CTMS-118 begins with a CONFIRMED hotspot and retains all authorization/corrective-action controls; it does not confirm an Incident or automatically promote a field report. See [separate upstream tasks](ctms-52-upstream-safety-contracts.md). Acceptance: an unverified incident or a non-CONFIRMED hotspot cannot enter authoritative package hazard input through this pipeline.

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

Admin only (authorized safety reviewer; `JwtAuthGuard` + `RolesGuard`, role `admin`), see §13. Host review and status changes belong to CTMS-117.

| Method | Path | Result |
| --- | --- | --- |
| POST | `/api/admin/safety-hotspots/detect` | 200 run summary: window, events considered, clusters found, candidates created (ids), skipped per reason |
| GET | `/api/admin/safety-hotspots?routeId=&status=&limit=` | Candidates newest first (default 50, max 200) |
| GET | `/api/admin/safety-hotspots/:id` | One candidate; 422 bad id; 404 unknown |

Background: `SafetyHotspotsWorker` when `SAFETY_HOTSPOT_DETECTION_WORKER_ENABLED=true` (daily by default, `SAFETY_HOTSPOT_DETECTION_INTERVAL_MS`).

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

## 13. Implementation Record — Logic (Jira CTMS-435, [CTMS-116-T01])

Branch `feat/CTMS-435-detect-safety-hotspots-logic`. Module `services/api/src/modules/safety-hotspots`. Re-detection policy approved 2026-11-13.

**Evidence (AC3, BR-417).** RouteDeviationEvents of the current CTMS-115 analysis version with `authoritative = true` (BR-363 decision of CTMS-115) whose `started_at` lies in the rolling window `(now − 30 days, now]`. Events are grouped by Route **and** route version and never mixed across versions (AC1, BR-421).

**Spatial cluster (AC2).** Each event is represented by its start point. PostGIS `ST_DWithin` (geography, 50 m) gives every event's neighbourhood on the same Route version. The pure `clusterEvents` repeatedly takes the largest neighbourhood that meets the criteria (ties: earliest anchor, then id), makes it a cluster and removes its events. Every member is therefore within 50 m of the anchor event (no chaining), no event belongs to two clusters, and the result is deterministic.

**Criteria (AC4–AC6, BR-418).** At least 5 events, 3 distinct Trips and 3 distinct Members; repeated events of one Trip or Member count once. Otherwise nothing is created.

**Candidate (AC7, BR-355, BR-420).** Table `potential_safety_hotspots` (migration `1795700000000`), created as `DETECTED` (the CHECK already allows the CTMS-117 states; detection never sets them):
- Route and route version, evidence window (start/end) and first/last event time;
- cluster context: centre (centroid of the start points), radius 50 m, anchor event id, span along the Route (min/max fraction);
- counts: events, distinct Trips, distinct Members;
- evidence: event ids and their SHA-256 (`evidence_hash`);
- `analysis_version` `v1-anchor-cluster`, `config_version` `v3`, the criteria used, `detection_run_id`, `detected_at`.

Each run is recorded in `hotspot_detection_runs` (window, criteria, events considered, clusters found, candidates created, skipped per reason, who triggered it).

**Personal data (BR-361).** A candidate keeps aggregate counts, a centroid and evidence ids, never member ids or a member's own point; the API returns only those. A reviewer reaches individual evidence through the event ids (CTMS-117).

**Idempotency and duplicates (BR-421, BR-422).** Detection runs under an advisory lock. `UNIQUE (route_id, route_version, analysis_version, evidence_hash)` stops the same evidence twice. A qualifying cluster whose centre is within 50 m of an existing candidate on the same Route version:
- `DETECTED`, `UNDER_REVIEW` or `CONFIRMED` → skipped (`ALREADY_COVERED`); the existing candidate is neither merged nor changed;
- `DISMISSED` → a new candidate only when some evidence started after the dismissal (`status_changed_at`), linked through `previous_hotspot_id` so the dismissal history stays; otherwise skipped (`DISMISSED_WITHOUT_NEW_EVIDENCE`).

**Advisory only (AC8, BR-356).** Detection writes only `potential_safety_hotspots` and `hotspot_detection_runs`. Route geometry, checkpoints and external safety features are untouched (there is no `route_hazard_areas` table in this codebase).

**Limit.** Only authoritative episodes count. While the mobile app does not send `packageVersion` (CTMS-115 Pending Decision), real data yields almost no authoritative episodes, so no hotspot will be detected yet; the logic is fully exercised with prepared episodes.

## 14. Test Evidence — CTMS-435

- Unit `hotspot-clustering.spec.ts` (14): 5/3/3 criteria and repeated Trips/Members; one cluster; no chaining beyond the anchor radius; insufficient or spread-out evidence gives nothing; two separate places; largest-then-earliest anchor; re-detection policy for DETECTED / UNDER_REVIEW / CONFIRMED / DISMISSED before and after; order-independent evidence hash; worker gating and failure.
- Integration `test/safety-hotspots.integration-spec.ts` (3, real PostGIS): a qualifying cluster gives one DETECTED candidate with 5 events / 3 Trips / 3 Members, 30-day window, 50 m radius, versions and criteria, excluding a non-authoritative, a 31-day-old and a 300 m-away event; Route geometry, checkpoints and external safety features unchanged; API exposes no member id; re-run skipped as already covered; after a dismissal, a re-run without new evidence is skipped and a later event creates a new candidate linked to the dismissed one; 5 events split over two Route versions give nothing; 404 / 422 / bad status; Host 403; anonymous 401.
- Together with the CTMS-115, GPS and safety-event suites: 4 suites, 43 tests passed.
- API jest 212 suites, 2 533 tests passed. `lint:all` 0 errors. `build:all` passes. Backend only, no UI.

### DoD — CTMS-435

- [x] Logic implementation completed
- [x] Applicable business rules/invariants implemented (BR-355, BR-356, BR-361, BR-417, BR-418, BR-420, BR-421, BR-422)
- [x] Task-specific unit tests added and passed
- [x] Applicable backend/integration tests passed
- [x] Story Acceptance Criteria AC1–AC8 covered by tests
- [x] Unit regression tests passed
- [ ] Applicable E2E: none, backend only
- [x] lint:all passed
- [x] build:all passed
- [ ] Required CI checks: after the PR is opened
