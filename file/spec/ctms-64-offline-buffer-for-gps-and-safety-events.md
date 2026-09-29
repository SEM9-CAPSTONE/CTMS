# CTMS-064 — Offline Buffer for GPS and Safety Events

## 1. Overview

Story: CTMS-064
Epic: EPIC 10. Buffer and Synchronization
Use Case: Offline Buffer for GPS and Safety Events
Priority: Must Have

Goal:
Allow Authenticated user to complete `Offline Buffer for GPS and Safety Events` within the approved CTMS v3.1 scope.

Acceptance summary:
The Offline Buffer for GPS and Safety Events workflow must satisfy the approved PB v3.1 acceptance criteria for this story. Do not copy the Vietnamese backlog text into this spec; implementers must preserve the approved source meaning when refining detailed tests.

## 2. Scope

### In Scope

- Story-owned behavior for `Offline Buffer for GPS and Safety Events`.
- Validation, authorization, state handling, persistence, audit, and observable errors required by the mapped Business Rules.
- Story-specific acceptance tests that prove both allowed and rejected paths.

### Out of Scope

- Behavior owned by dependency stories unless a mapped BR explicitly makes it part of this story.
- Implementation of dependency stories: CTMS-059.

## 3. Actors & Authorization

- Authenticated user: primary business actor for this story.
- Backend API: authoritative enforcement point for permissions, state, and business rules.
- UI or client application: may guide the user, but must not replace backend enforcement.

Authorization must be concrete: the caller must have the role, ownership, assignment, or operational relationship required by the mapped BRs before any protected data is returned or any state-changing action is committed.

## 4. Preconditions & Dependencies

- Product Backlog v3.1 row `CTMS-064` is the story scope source.
- The mapped Primary BR IDs below exist in the latest Business Rules workbook.
- Required domain records already exist and are in states allowed by the mapped BRs.
- Dependencies:
- CTMS-059

## 5. Business Rules

| BR | Rule |
|---|---|
| BR-242 | This BR is the authoritative story rule for `Offline Buffer for GPS and Safety Events`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: GPS, OFF_ROUTE. |
| BR-399 | This BR is the authoritative story rule for `Offline Buffer for GPS and Safety Events`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: GPS. |
| BR-409 | This BR is the authoritative story rule for `Offline Buffer for GPS and Safety Events`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: 30 days. |
| BR-207 | Offline data must include a request identifier or `idempotency_key`; resubmitting the same sync batch must not create duplicate data. |
| BR-212 | Any Business Rule, enum, state transition, or API contract change must update the spec, tests, and data documentation before the story is Done. |
| BR-213 | Every mapped Business Rule must have at least one valid-path test and one violation-path test; concurrency, idempotency, and transaction rules require integration or E2E coverage. |
| BR-363 | Each device safety-tracking session must bind at minimum to `trip_id`, member or participant identity, device/session context, and active `offline_package_id/version`; missing required context prevents authoritative Trip safety events. |
| BR-389 | If the app restarts during a Trip, the client must restore the active safety session, package context, and any valid unsynced safety events or GPS logs from local storage before continuing tracking. |
| BR-397 | If no sufficiently good sample exists at the logging boundary, the client must follow the approved policy: skip the log or persist a degraded record with quality/staleness context. It must not store unreliable coordinates as raw authoritative location without accuracy/quality context. |
| BR-398 | `gps_logs` are historical telemetry and are not the sole source of realtime safety state. OFF_ROUTE and checkpoint events must be persisted independently from the 30-second `gps_log` boundary when the event sample does not align with that boundary. |
| BR-408 | When a Trip ends, realtime tracking must transition to completed/closed according to policy; the client must not continue sending operational GPS indefinitely under the same Trip context. |
| BR-410 | Data under legal, audit, or safety investigation hold must not be deleted only because raw GPS retention expired; exception retention requires authorization and audit. |

## 6. State & Lifecycle

Relevant states from the approved rules: `active`, `completed`, `expired`, `closed`.

Do not introduce placeholder workflow states unless an owning domain contract explicitly defines them.

## 7. Business Flow

1. Authenticated user initiates `Offline Buffer for GPS and Safety Events` through the approved UI, API, scheduled job, or integration point.
2. The backend loads the required source records and verifies authorization, ownership or assignment, current state, and all mapped BR prerequisites.
3. The backend applies the story-owned decision logic from Section 5.
4. If any mapped rule is violated, the backend rejects the operation with no partial side effects and returns an actionable error.
5. If the action changes authoritative data, the change commits atomically with required audit and post-commit notifications.
6. The client presents the committed result or the rejection reason without exposing protected data.

## 8. Data & Invariants

- Persist or return only fields required for `Offline Buffer for GPS and Safety Events` and the mapped BRs.
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
| PB AC | Approved backlog acceptance path for `Offline Buffer for GPS and Safety Events` | Meets the acceptance summary above | E2E |
| BR-242 | Approved rule is satisfied for `Offline Buffer for GPS and Safety Events` | Accepted and persisted or returned as applicable | Integration |
| BR-242 | Approved rule is violated for `Offline Buffer for GPS and Safety Events` | Rejected with no partial side effects | Boundary / Integration |
| BR-399 | Approved rule is satisfied for `Offline Buffer for GPS and Safety Events` | Accepted and persisted or returned as applicable | Integration |
| BR-399 | Approved rule is violated for `Offline Buffer for GPS and Safety Events` | Rejected with no partial side effects | Boundary / Integration |
| BR-409 | Approved rule is satisfied for `Offline Buffer for GPS and Safety Events` | Accepted and persisted or returned as applicable | Integration |
| BR-409 | Approved rule is violated for `Offline Buffer for GPS and Safety Events` | Rejected with no partial side effects | Boundary / Integration |
| BR-207 | Approved rule is satisfied for `Offline Buffer for GPS and Safety Events` | Accepted and persisted or returned as applicable | Integration |
| BR-207 | Approved rule is violated for `Offline Buffer for GPS and Safety Events` | Rejected with no partial side effects | Boundary / Integration |
| BR-212 | Approved rule is satisfied for `Offline Buffer for GPS and Safety Events` | Accepted and persisted or returned as applicable | Integration |
| BR-212 | Approved rule is violated for `Offline Buffer for GPS and Safety Events` | Rejected with no partial side effects | Boundary / Integration |
| BR-213 | Approved rule is satisfied for `Offline Buffer for GPS and Safety Events` | Accepted and persisted or returned as applicable | Integration |
| BR-213 | Approved rule is violated for `Offline Buffer for GPS and Safety Events` | Rejected with no partial side effects | Boundary / Integration |
| BR-363 | Approved rule is satisfied for `Offline Buffer for GPS and Safety Events` | Accepted and persisted or returned as applicable | Integration |
| BR-363 | Approved rule is violated for `Offline Buffer for GPS and Safety Events` | Rejected with no partial side effects | Boundary / Integration |
| BR-389 | Approved rule is satisfied for `Offline Buffer for GPS and Safety Events` | Accepted and persisted or returned as applicable | Integration |
| BR-389 | Approved rule is violated for `Offline Buffer for GPS and Safety Events` | Rejected with no partial side effects | Boundary / Integration |
| Remaining mapped BRs | Each mapped BR has valid and violation coverage in the owning test suite | Coverage proves the rule is enforced | Unit / Integration / E2E |

## 12. Open Decisions & References

### 12.1 Open Decisions

None.

### 12.2 References

- Product Backlog v3.1.
- CTMS Business Rules workbook.
- CTMS Architecture Overview.
