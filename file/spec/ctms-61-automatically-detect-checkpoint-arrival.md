# CTMS-061 — Automatically Detect Checkpoint Arrival

## 1. Overview

Story: CTMS-061
Epic: EPIC 9. GPS Navigation and Route Deviation
Use Case: Automatically Detect Checkpoint Arrival
Priority: Must Have

Goal:
Allow System to complete `Automatically Detect Checkpoint Arrival` within the approved CTMS v3.1 scope.

Acceptance summary:
The Automatically Detect Checkpoint Arrival workflow must satisfy the approved PB v3.1 acceptance criteria for this story. Do not copy the Vietnamese backlog text into this spec; implementers must preserve the approved source meaning when refining detailed tests.

## 2. Scope

### In Scope

- Story-owned behavior for `Automatically Detect Checkpoint Arrival`.
- Validation, authorization, state handling, persistence, audit, and observable errors required by the mapped Business Rules.
- Story-specific acceptance tests that prove both allowed and rejected paths.

### Out of Scope

- Behavior owned by dependency stories unless a mapped BR explicitly makes it part of this story.
- Implementation of dependency stories: CTMS-011, CTMS-052, CTMS-059.

## 3. Actors & Authorization

- System: primary business actor for this story.
- Backend API: authoritative enforcement point for permissions, state, and business rules.
- UI or client application: may guide the user, but must not replace backend enforcement.

Authorization must be concrete: the caller must have the role, ownership, assignment, or operational relationship required by the mapped BRs before any protected data is returned or any state-changing action is committed.

## 4. Preconditions & Dependencies

- Product Backlog v3.1 row `CTMS-061` is the story scope source.
- The mapped Primary BR IDs below exist in the latest Business Rules workbook.
- Required domain records already exist and are in states allowed by the mapped BRs.
- Dependencies:
- CTMS-011
- CTMS-052
- CTMS-059

## 5. Business Rules

| BR | Rule |
|---|---|
| BR-239 | GPS breadcrumbs may be recorded only when the Trip is ongoing, the user is a joined Camper or assigned Porter, and location permission is granted. Logging must stop when Trip or participation state no longer allows tracking. Logs are keyed by user plus Trip, not by device identity. |
| BR-391 | A member in OFF_ROUTE returns to ON_ROUTE only after 3 consecutive VALID GPS samples with `distance_to_route < 20m`. Any INVALID sample or sample with `distance_to_route >= 20m` before 3 qualifying samples resets the recovery counter to `0`. |
| BR-392 | This BR is the authoritative story rule for `Automatically Detect Checkpoint Arrival`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: CHECKPOINT_REACHED, GPS, VALID, 20m. |
| BR-393 | This BR is the authoritative story rule for `Automatically Detect Checkpoint Arrival`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: GPS. |
| BR-394 | This BR is the authoritative story rule for `Automatically Detect Checkpoint Arrival`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: MVP. |
| BR-395 | If there is no VALID GPS sample continuously for `>= 2 minutes` during an ongoing Trip, the Mobile Safety Engine moves tracking to `GPS_DEGRADED` and warns the Camper that GPS is not reliable enough to determine route state. `GPS_DEGRADED` is not OFF_ROUTE. The client continues sampling every 10 seconds. |
| BR-440 | This BR is the authoritative story rule for `Automatically Detect Checkpoint Arrival`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: CHECKPOINT_REACHED. |
| BR-207 | Offline data must include a request identifier or `idempotency_key`; resubmitting the same sync batch must not create duplicate data. |
| BR-212 | Any Business Rule, enum, state transition, or API contract change must update the spec, tests, and data documentation before the story is Done. |
| BR-213 | Every mapped Business Rule must have at least one valid-path test and one violation-path test; concurrency, idempotency, and transaction rules require integration or E2E coverage. |
| BR-350 | A GPS sample may participate in safety detection only when it belongs to an active Trip safety session and references the correct member/device/session context. |
| BR-360 | Trip/client must be able to identify the package version used when GPS or safety data was recorded. GPS logs, safety events, and sync payloads must carry enough reference/version context for historical safety analysis. |
| BR-362 | Safety tracking may activate only for a Trip state allowed by the V3 state machine. GPS outside the Trip window must not become operational Trip safety evidence without an explicit recovery/admin policy. |
| BR-363 | Each device safety-tracking session must bind at minimum to `trip_id`, member or participant identity, device/session context, and active `offline_package_id/version`; missing required context prevents authoritative Trip safety events. |
| BR-389 | If the app restarts during a Trip, the client must restore the active safety session, package context, and any valid unsynced safety events or GPS logs from local storage before continuing tracking. |
| BR-398 | `gps_logs` are historical telemetry and are not the sole source of realtime safety state. OFF_ROUTE and checkpoint events must be persisted independently from the 30-second `gps_log` boundary when the event sample does not align with that boundary. |
| BR-431 | The client must store the configuration version used by the safety session. Historical events must store config/rule version so events created under different thresholds remain distinguishable. |

## 6. State & Lifecycle

Relevant states from the approved rules: `active`, `ongoing`.

Do not introduce placeholder workflow states unless an owning domain contract explicitly defines them.

## 7. Business Flow

1. System initiates `Automatically Detect Checkpoint Arrival` through the approved UI, API, scheduled job, or integration point.
2. The backend loads the required source records and verifies authorization, ownership or assignment, current state, and all mapped BR prerequisites.
3. The backend applies the story-owned decision logic from Section 5.
4. If any mapped rule is violated, the backend rejects the operation with no partial side effects and returns an actionable error.
5. If the action changes authoritative data, the change commits atomically with required audit and post-commit notifications.
6. The client presents the committed result or the rejection reason without exposing protected data.

## 8. Data & Invariants

- Persist or return only fields required for `Automatically Detect Checkpoint Arrival` and the mapped BRs.
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
| PB AC | Approved backlog acceptance path for `Automatically Detect Checkpoint Arrival` | Meets the acceptance summary above | E2E |
| BR-239 | Approved rule is satisfied for `Automatically Detect Checkpoint Arrival` | Accepted and persisted or returned as applicable | Integration |
| BR-239 | Approved rule is violated for `Automatically Detect Checkpoint Arrival` | Rejected with no partial side effects | Boundary / Integration |
| BR-391 | Approved rule is satisfied for `Automatically Detect Checkpoint Arrival` | Accepted and persisted or returned as applicable | Integration |
| BR-391 | Approved rule is violated for `Automatically Detect Checkpoint Arrival` | Rejected with no partial side effects | Boundary / Integration |
| BR-392 | Approved rule is satisfied for `Automatically Detect Checkpoint Arrival` | Accepted and persisted or returned as applicable | Integration |
| BR-392 | Approved rule is violated for `Automatically Detect Checkpoint Arrival` | Rejected with no partial side effects | Boundary / Integration |
| BR-393 | Approved rule is satisfied for `Automatically Detect Checkpoint Arrival` | Accepted and persisted or returned as applicable | Integration |
| BR-393 | Approved rule is violated for `Automatically Detect Checkpoint Arrival` | Rejected with no partial side effects | Boundary / Integration |
| BR-394 | Approved rule is satisfied for `Automatically Detect Checkpoint Arrival` | Accepted and persisted or returned as applicable | Integration |
| BR-394 | Approved rule is violated for `Automatically Detect Checkpoint Arrival` | Rejected with no partial side effects | Boundary / Integration |
| BR-395 | Approved rule is satisfied for `Automatically Detect Checkpoint Arrival` | Accepted and persisted or returned as applicable | Integration |
| BR-395 | Approved rule is violated for `Automatically Detect Checkpoint Arrival` | Rejected with no partial side effects | Boundary / Integration |
| BR-440 | Approved rule is satisfied for `Automatically Detect Checkpoint Arrival` | Accepted and persisted or returned as applicable | Integration |
| BR-440 | Approved rule is violated for `Automatically Detect Checkpoint Arrival` | Rejected with no partial side effects | Boundary / Integration |
| BR-207 | Approved rule is satisfied for `Automatically Detect Checkpoint Arrival` | Accepted and persisted or returned as applicable | Integration |
| BR-207 | Approved rule is violated for `Automatically Detect Checkpoint Arrival` | Rejected with no partial side effects | Boundary / Integration |
| Remaining mapped BRs | Each mapped BR has valid and violation coverage in the owning test suite | Coverage proves the rule is enforced | Unit / Integration / E2E |

## 12. Open Decisions & References

### 12.1 Open Decisions

None.

### 12.2 References

- Product Backlog v3.1.
- CTMS Business Rules workbook.
- CTMS Architecture Overview.
