# CTMS-059 — Record GPS Breadcrumbs during Trekking

## 1. Overview

Story: CTMS-059
Epic: EPIC 9. GPS Navigation and Route Deviation
Use Case: Record GPS Breadcrumbs during Trekking
Priority: Must Have

Goal:
Allow Authenticated user to complete `Record GPS Breadcrumbs during Trekking` within the approved CTMS v3.1 scope.

Acceptance summary:
The Record GPS Breadcrumbs during Trekking workflow must satisfy the approved PB v3.1 acceptance criteria for this story. Do not copy the Vietnamese backlog text into this spec; implementers must preserve the approved source meaning when refining detailed tests.

## 2. Scope

### In Scope

- Story-owned behavior for `Record GPS Breadcrumbs during Trekking`.
- Validation, authorization, state handling, persistence, audit, and observable errors required by the mapped Business Rules.
- Story-specific acceptance tests that prove both allowed and rejected paths.

### Out of Scope

- Behavior owned by dependency stories unless a mapped BR explicitly makes it part of this story.
- Implementation of dependency stories: CTMS-058.

## 3. Actors & Authorization

- Authenticated user: primary business actor for this story.
- Backend API: authoritative enforcement point for permissions, state, and business rules.
- UI or client application: may guide the user, but must not replace backend enforcement.

Authorization must be concrete: the caller must have the role, ownership, assignment, or operational relationship required by the mapped BRs before any protected data is returned or any state-changing action is committed.

## 4. Preconditions & Dependencies

- Product Backlog v3.1 row `CTMS-059` is the story scope source.
- The mapped Primary BR IDs below exist in the latest Business Rules workbook.
- Required domain records already exist and are in states allowed by the mapped BRs.
- Dependencies:
- CTMS-058

## 5. Business Rules

| BR | Rule |
|---|---|
| BR-237 | The system must display the current package version and update time, and warn when Route, weather, or survival-knowledge source changes make the downloaded package outdated. |
| BR-367 | This BR is the authoritative story rule for `Record GPS Breadcrumbs during Trekking`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: GPS. |
| BR-368 | During an ongoing Trip, the V3 GPS sampling interval is fixed at 10 seconds per sample; Admin or client cannot change it. |
| BR-369 | This BR is the authoritative story rule for `Record GPS Breadcrumbs during Trekking`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: GPS. |
| BR-370 | This BR is the authoritative story rule for `Record GPS Breadcrumbs during Trekking`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-371 | Before Trip start, the client must verify that the required Offline Safety Package is downloaded, readable, and passes integrity/version validation. If it is missing or corrupted, UI must clearly warn about degraded safety capability and apply the approved allow/block policy for starting the Trip. |
| BR-372 | An Offline Safety Package for safety must include all data needed for enabled local detection, at minimum matching Route geometry, checkpoints to monitor, required hazard/safety metadata, and package metadata/version. The client must not depend on the server to read this data while offline. |
| BR-396 | When tracking is `GPS_DEGRADED` and a VALID runtime GPS sample returns with horizontal accuracy `<= 20m`, tracking moves to `NORMAL`. Consecutive counters from before the degraded period must not be restored. |
| BR-188 | Date and time handling must use the authoritative timezone and ordering rules for the business workflow, and invalid or impossible time ranges must be rejected. |
| BR-207 | Offline data must include a request identifier or `idempotency_key`; resubmitting the same sync batch must not create duplicate data. |
| BR-212 | Any Business Rule, enum, state transition, or API contract change must update the spec, tests, and data documentation before the story is Done. |
| BR-213 | Every mapped Business Rule must have at least one valid-path test and one violation-path test; concurrency, idempotency, and transaction rules require integration or E2E coverage. |
| BR-350 | A GPS sample may participate in safety detection only when it belongs to an active Trip safety session and references the correct member/device/session context. |
| BR-360 | Trip/client must be able to identify the package version used when GPS or safety data was recorded. GPS logs, safety events, and sync payloads must carry enough reference/version context for historical safety analysis. |
| BR-362 | Safety tracking may activate only for a Trip state allowed by the V3 state machine. GPS outside the Trip window must not become operational Trip safety evidence without an explicit recovery/admin policy. |
| BR-363 | Each device safety-tracking session must bind at minimum to `trip_id`, member or participant identity, device/session context, and active `offline_package_id/version`; missing required context prevents authoritative Trip safety events. |
| BR-389 | If the app restarts during a Trip, the client must restore the active safety session, package context, and any valid unsynced safety events or GPS logs from local storage before continuing tracking. |
| BR-390 | Recovery from OFF_ROUTE uses the fixed ON_ROUTE threshold `< 20m`. The `20m-50m` range is a buffer zone to prevent state oscillation near the OFF_ROUTE threshold. |
| BR-397 | If no sufficiently good sample exists at the logging boundary, the client must follow the approved policy: skip the log or persist a degraded record with quality/staleness context. It must not store unreliable coordinates as raw authoritative location without accuracy/quality context. |
| BR-398 | `gps_logs` are historical telemetry and are not the sole source of realtime safety state. OFF_ROUTE and checkpoint events must be persisted independently from the 30-second `gps_log` boundary when the event sample does not align with that boundary. |
| BR-408 | When a Trip ends, realtime tracking must transition to completed/closed according to policy; the client must not continue sending operational GPS indefinitely under the same Trip context. |
| BR-431 | The client must store the configuration version used by the safety session. Historical events must store config/rule version so events created under different thresholds remain distinguishable. |

## 6. State & Lifecycle

Relevant states from the approved rules: `active`, `ongoing`, `completed`, `closed`, `pass`.

Do not introduce placeholder workflow states unless an owning domain contract explicitly defines them.

## 7. Business Flow

1. Authenticated user initiates `Record GPS Breadcrumbs during Trekking` through the approved UI, API, scheduled job, or integration point.
2. The backend loads the required source records and verifies authorization, ownership or assignment, current state, and all mapped BR prerequisites.
3. The backend applies the story-owned decision logic from Section 5.
4. If any mapped rule is violated, the backend rejects the operation with no partial side effects and returns an actionable error.
5. If the action changes authoritative data, the change commits atomically with required audit and post-commit notifications.
6. The client presents the committed result or the rejection reason without exposing protected data.

## 8. Data & Invariants

- Persist or return only fields required for `Record GPS Breadcrumbs during Trekking` and the mapped BRs.
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
| PB AC | Approved backlog acceptance path for `Record GPS Breadcrumbs during Trekking` | Meets the acceptance summary above | E2E |
| BR-237 | Approved rule is satisfied for `Record GPS Breadcrumbs during Trekking` | Accepted and persisted or returned as applicable | Integration |
| BR-237 | Approved rule is violated for `Record GPS Breadcrumbs during Trekking` | Rejected with no partial side effects | Boundary / Integration |
| BR-367 | Approved rule is satisfied for `Record GPS Breadcrumbs during Trekking` | Accepted and persisted or returned as applicable | Integration |
| BR-367 | Approved rule is violated for `Record GPS Breadcrumbs during Trekking` | Rejected with no partial side effects | Boundary / Integration |
| BR-368 | Approved rule is satisfied for `Record GPS Breadcrumbs during Trekking` | Accepted and persisted or returned as applicable | Integration |
| BR-368 | Approved rule is violated for `Record GPS Breadcrumbs during Trekking` | Rejected with no partial side effects | Boundary / Integration |
| BR-369 | Approved rule is satisfied for `Record GPS Breadcrumbs during Trekking` | Accepted and persisted or returned as applicable | Integration |
| BR-369 | Approved rule is violated for `Record GPS Breadcrumbs during Trekking` | Rejected with no partial side effects | Boundary / Integration |
| BR-370 | Approved rule is satisfied for `Record GPS Breadcrumbs during Trekking` | Accepted and persisted or returned as applicable | Integration |
| BR-370 | Approved rule is violated for `Record GPS Breadcrumbs during Trekking` | Rejected with no partial side effects | Boundary / Integration |
| BR-371 | Approved rule is satisfied for `Record GPS Breadcrumbs during Trekking` | Accepted and persisted or returned as applicable | Integration |
| BR-371 | Approved rule is violated for `Record GPS Breadcrumbs during Trekking` | Rejected with no partial side effects | Boundary / Integration |
| BR-372 | Approved rule is satisfied for `Record GPS Breadcrumbs during Trekking` | Accepted and persisted or returned as applicable | Integration |
| BR-372 | Approved rule is violated for `Record GPS Breadcrumbs during Trekking` | Rejected with no partial side effects | Boundary / Integration |
| BR-396 | Approved rule is satisfied for `Record GPS Breadcrumbs during Trekking` | Accepted and persisted or returned as applicable | Integration |
| BR-396 | Approved rule is violated for `Record GPS Breadcrumbs during Trekking` | Rejected with no partial side effects | Boundary / Integration |
| Remaining mapped BRs | Each mapped BR has valid and violation coverage in the owning test suite | Coverage proves the rule is enforced | Unit / Integration / E2E |

## 12. Open Decisions & References

### 12.1 Open Decisions

None.

### 12.2 References

- Product Backlog v3.1.
- CTMS Business Rules workbook.
- CTMS Architecture Overview.
