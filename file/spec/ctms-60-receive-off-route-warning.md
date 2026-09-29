# CTMS-060 — Receive Off-Route Warning

## 1. Overview

Story: CTMS-060
Epic: EPIC 9. GPS Navigation and Route Deviation
Use Case: Receive Off-Route Warning
Priority: Must Have

Goal:
Allow Host to complete `Receive Off-Route Warning` within the approved CTMS v3.1 scope.

Acceptance summary:
The Receive Off-Route Warning workflow must satisfy the approved PB v3.1 acceptance criteria for this story. Do not copy the Vietnamese backlog text into this spec; implementers must preserve the approved source meaning when refining detailed tests.

## 2. Scope

### In Scope

- Story-owned behavior for `Receive Off-Route Warning`.
- Validation, authorization, state handling, persistence, audit, and observable errors required by the mapped Business Rules.
- Story-specific acceptance tests that prove both allowed and rejected paths.

### Out of Scope

- Behavior owned by dependency stories unless a mapped BR explicitly makes it part of this story.
- Implementation of dependency stories: CTMS-052, CTMS-058, CTMS-059.

## 3. Actors & Authorization

- Host: primary business actor for this story.
- Backend API: authoritative enforcement point for permissions, state, and business rules.
- UI or client application: may guide the user, but must not replace backend enforcement.

Authorization must be concrete: the caller must have the role, ownership, assignment, or operational relationship required by the mapped BRs before any protected data is returned or any state-changing action is committed.

## 4. Preconditions & Dependencies

- Product Backlog v3.1 row `CTMS-060` is the story scope source.
- The mapped Primary BR IDs below exist in the latest Business Rules workbook.
- Required domain records already exist and are in states allowed by the mapped BRs.
- Dependencies:
- CTMS-052
- CTMS-058
- CTMS-059

## 5. Business Rules

| BR | Rule |
|---|---|
| BR-217 | This BR is the authoritative story rule for `Receive Off-Route Warning`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: GPS. |
| BR-238 | This BR is the authoritative story rule for `Receive Off-Route Warning`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: GPS, VALID. |
| BR-351 | This BR is the authoritative story rule for `Receive Off-Route Warning`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: OFF_ROUTE, GPS. |
| BR-375 | The V3 OFF_ROUTE distance threshold is fixed at 50 meters from GPS location to the nearest segment of the active Route/package version geometry. |
| BR-376 | This BR is the authoritative story rule for `Receive Off-Route Warning`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: OFF_ROUTE. |
| BR-377 | OFF_ROUTE is confirmed only after three consecutive VALID GPS samples satisfy the OFF_ROUTE threshold. A VALID sample that does not satisfy the threshold before the third sample resets the OFF_ROUTE counter to zero. |
| BR-378 | INVALID or low-confidence samples always reset consecutive OFF_ROUTE, ON_ROUTE, and checkpoint counters to zero in V3; counters must not pause. |
| BR-379 | A runtime GPS sample is accurate enough for safety detection when horizontal accuracy is `<= 20m`. Accuracy above `20m` is low-confidence/INVALID and must reset consecutive counters. |
| BR-380 | This BR is the authoritative story rule for `Receive Off-Route Warning`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: OFF_ROUTE. |
| BR-381 | This BR is the authoritative story rule for `Receive Off-Route Warning`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: OFF_ROUTE. |
| BR-382 | OFF_ROUTE recovery uses a fixed ON_ROUTE threshold below 20 meters. The 20m-50m range is a buffer zone to avoid state oscillation around the OFF_ROUTE threshold. |
| BR-383 | The fixed V3 OFF_ROUTE distance threshold is `50m` from the GPS location to the nearest segment of the Route geometry in the active package/version. |
| BR-384 | This BR is the authoritative story rule for `Receive Off-Route Warning`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: OFF_ROUTE, UX. |
| BR-385 | `OFF_ROUTE` is confirmed after 3 consecutive VALID GPS samples with `distance_to_route > 50m`. An INVALID sample or a VALID sample with `distance_to_route <= 50m` before the third qualifying sample resets the OFF_ROUTE counter to `0`. |
| BR-386 | In V3, INVALID or low-confidence samples always reset consecutive OFF_ROUTE, ON_ROUTE, and checkpoint counters to `0`; counters are not paused. |
| BR-387 | This BR is the authoritative story rule for `Receive Off-Route Warning`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: GPS, VALID, 2 minutes, GPS_DEGRADED, OFF_ROUTE. |
| BR-388 | This BR is the authoritative story rule for `Receive Off-Route Warning`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: GPS_DEGRADED, GPS, VALID, NORMAL. |
| BR-212 | Any Business Rule, enum, state transition, or API contract change must update the spec, tests, and data documentation before the story is Done. |
| BR-213 | Every mapped Business Rule must have at least one valid-path test and one violation-path test; concurrency, idempotency, and transaction rules require integration or E2E coverage. |
| BR-350 | A GPS sample may participate in safety detection only when it belongs to an active Trip safety session and references the correct member/device/session context. |
| BR-360 | Trip/client must be able to identify the package version used when GPS or safety data was recorded. GPS logs, safety events, and sync payloads must carry enough reference/version context for historical safety analysis. |
| BR-362 | Safety tracking may activate only for a Trip state allowed by the V3 state machine. GPS outside the Trip window must not become operational Trip safety evidence without an explicit recovery/admin policy. |
| BR-363 | Each device safety-tracking session must bind at minimum to `trip_id`, member or participant identity, device/session context, and active `offline_package_id/version`; missing required context prevents authoritative Trip safety events. |
| BR-373 | `distance_to_route` must be calculated against the nearest segment of the active Route/package version geometry, not merely the nearest waypoint or checkpoint. |
| BR-374 | The internal standard unit for `distance_to_route` is meters. API and storage must publish or normalize units so client and server interpret distance consistently. |
| BR-389 | If the app restarts during a Trip, the client must restore the active safety session, package context, and any valid unsynced safety events or GPS logs from local storage before continuing tracking. |
| BR-398 | `gps_logs` are historical telemetry and are not the sole source of realtime safety state. OFF_ROUTE and checkpoint events must be persisted independently from the 30-second `gps_log` boundary when the event sample does not align with that boundary. |
| BR-431 | The client must store the configuration version used by the safety session. Historical events must store config/rule version so events created under different thresholds remain distinguishable. |

## 6. State & Lifecycle

Relevant states from the approved rules: `active`, `confirmed`.

Do not introduce placeholder workflow states unless an owning domain contract explicitly defines them.

## 7. Business Flow

1. Host initiates `Receive Off-Route Warning` through the approved UI, API, scheduled job, or integration point.
2. The backend loads the required source records and verifies authorization, ownership or assignment, current state, and all mapped BR prerequisites.
3. The backend applies the story-owned decision logic from Section 5.
4. If any mapped rule is violated, the backend rejects the operation with no partial side effects and returns an actionable error.
5. If the action changes authoritative data, the change commits atomically with required audit and post-commit notifications.
6. The client presents the committed result or the rejection reason without exposing protected data.

## 8. Data & Invariants

- Persist or return only fields required for `Receive Off-Route Warning` and the mapped BRs.
- Preserve authoritative identifiers, ownership links, timestamps, snapshots, status values, and audit references when they affect the business outcome.
- Derived counters, scores, release-gate metrics, and ledger amounts must be traceable to their source records and rule version.
- Do not invent tables, enum values, state machines, or audit stores solely for this story.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case | Expected Behavior |
|---|---|
| Caller lacks the required role, ownership, assignment, or relationship | Reject with no side effects. |
| Required source record is missing | Return not found or blocked state without fabricating data. |
| Current state violates a mapped BR | Return business conflict and preserve the current authoritative state. |
| Input violates a mapped BR | Return validation error before persistence. |
| Duplicate or retried request affects authoritative data | Enforce idempotency or reject safely so duplicate records, refunds, notifications, or ledger entries are not created. |

## 11. Acceptance & Test Matrix

| BR / AC | Scenario | Expected Result | Test Type |
|---|---|---|---|
| PB AC | Approved backlog acceptance path for `Receive Off-Route Warning` | Meets the acceptance summary above | E2E |
| BR-217 | Approved rule is satisfied for `Receive Off-Route Warning` | Accepted and persisted or returned as applicable | Integration |
| BR-217 | Approved rule is violated for `Receive Off-Route Warning` | Rejected with no partial side effects | Boundary / Integration |
| BR-238 | Approved rule is satisfied for `Receive Off-Route Warning` | Accepted and persisted or returned as applicable | Integration |
| BR-238 | Approved rule is violated for `Receive Off-Route Warning` | Rejected with no partial side effects | Boundary / Integration |
| BR-351 | Approved rule is satisfied for `Receive Off-Route Warning` | Accepted and persisted or returned as applicable | Integration |
| BR-351 | Approved rule is violated for `Receive Off-Route Warning` | Rejected with no partial side effects | Boundary / Integration |
| BR-375 | Approved rule is satisfied for `Receive Off-Route Warning` | Accepted and persisted or returned as applicable | Integration |
| BR-375 | Approved rule is violated for `Receive Off-Route Warning` | Rejected with no partial side effects | Boundary / Integration |
| BR-376 | Approved rule is satisfied for `Receive Off-Route Warning` | Accepted and persisted or returned as applicable | Integration |
| BR-376 | Approved rule is violated for `Receive Off-Route Warning` | Rejected with no partial side effects | Boundary / Integration |
| BR-377 | Approved rule is satisfied for `Receive Off-Route Warning` | Accepted and persisted or returned as applicable | Integration |
| BR-377 | Approved rule is violated for `Receive Off-Route Warning` | Rejected with no partial side effects | Boundary / Integration |
| BR-378 | Approved rule is satisfied for `Receive Off-Route Warning` | Accepted and persisted or returned as applicable | Integration |
| BR-378 | Approved rule is violated for `Receive Off-Route Warning` | Rejected with no partial side effects | Boundary / Integration |
| BR-379 | Approved rule is satisfied for `Receive Off-Route Warning` | Accepted and persisted or returned as applicable | Integration |
| BR-379 | Approved rule is violated for `Receive Off-Route Warning` | Rejected with no partial side effects | Boundary / Integration |
| Remaining mapped BRs | Each mapped BR has valid and violation coverage in the owning test suite | Coverage proves the rule is enforced | Unit / Integration / E2E |

## 12. Open Decisions & References

### 12.1 Open Decisions

None.

### 12.2 References

- Product Backlog v3.1.
- CTMS Business Rules workbook.
- CTMS Architecture Overview.
