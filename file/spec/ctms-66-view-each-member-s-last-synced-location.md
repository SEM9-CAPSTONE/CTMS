# CTMS-066 — View Each Member’s Last Synced Location

## 1. Overview

Story: CTMS-066
Epic: EPIC 10. Buffer and Synchronization
Use Case: View Each Member’s Last Synced Location
Priority: Must Have

Goal:
Allow System to complete `View Each Member’s Last Synced Location` within the approved CTMS v3.1 scope.

Acceptance summary:
The View Each Member’s Last Synced Location workflow must satisfy the approved PB v3.1 acceptance criteria for this story. Do not copy the Vietnamese backlog text into this spec; implementers must preserve the approved source meaning when refining detailed tests.

## 2. Scope

### In Scope

- Story-owned behavior for `View Each Member’s Last Synced Location`.
- Validation, authorization, state handling, persistence, audit, and observable errors required by the mapped Business Rules.
- Story-specific acceptance tests that prove both allowed and rejected paths.

### Out of Scope

- Behavior owned by dependency stories unless a mapped BR explicitly makes it part of this story.
- Implementation of dependency stories: CTMS-065.

## 3. Actors & Authorization

- System: primary business actor for this story.
- Backend API: authoritative enforcement point for permissions, state, and business rules.
- UI or client application: may guide the user, but must not replace backend enforcement.

Authorization must be concrete: the caller must have the role, ownership, assignment, or operational relationship required by the mapped BRs before any protected data is returned or any state-changing action is committed.

## 4. Preconditions & Dependencies

- Product Backlog v3.1 row `CTMS-066` is the story scope source.
- The mapped Primary BR IDs below exist in the latest Business Rules workbook.
- Required domain records already exist and are in states allowed by the mapped BRs.
- Dependencies:
- CTMS-065

## 5. Business Rules

| BR | Rule |
|---|---|
| BR-246 | After reconnect, pending GPS logs and safety events must synchronize automatically. Each item keeps `pending`, `synced`, or `failed` state. Sync must preserve client event time, UUID, location, GPS accuracy, and package/version context so the server can reconstruct detection conditions. |
| BR-405 | This BR is the authoritative story rule for `View Each Member’s Last Synced Location`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-406 | This BR is the authoritative story rule for `View Each Member’s Last Synced Location`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: UI. |
| BR-407 | This BR is the authoritative story rule for `View Each Member’s Last Synced Location`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-172 | Sensitive personal, health, payment, and location data may be accessed only by an authorized actor with a valid business relationship. |
| BR-173 | A user must not read or modify another user's protected data unless a specific role or workflow authorizes it. |
| BR-186 | Sensitive payloads must be minimized in responses, logs, audit records, analytics, and notifications. |
| BR-201 | UI behavior must reflect backend state accurately and must show clear loading, success, empty, validation, permission, conflict, and retry states where applicable. |
| BR-212 | Any Business Rule, enum, state transition, or API contract change must update the spec, tests, and data documentation before the story is Done. |
| BR-213 | Every mapped Business Rule must have at least one valid-path test and one violation-path test; concurrency, idempotency, and transaction rules require integration or E2E coverage. |

## 6. State & Lifecycle

Relevant states from the approved rules: `fail`.

Do not introduce placeholder workflow states unless an owning domain contract explicitly defines them.

## 7. Business Flow

1. System initiates `View Each Member’s Last Synced Location` through the approved UI, API, scheduled job, or integration point.
2. The backend loads the required source records and verifies authorization, ownership or assignment, current state, and all mapped BR prerequisites.
3. The backend applies the story-owned decision logic from Section 5.
4. If any mapped rule is violated, the backend rejects the operation with no partial side effects and returns an actionable error.
5. If the action changes authoritative data, the change commits atomically with required audit and post-commit notifications.
6. The client presents the committed result or the rejection reason without exposing protected data.

## 8. Data & Invariants

- Persist or return only fields required for `View Each Member’s Last Synced Location` and the mapped BRs.
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
| PB AC | Approved backlog acceptance path for `View Each Member’s Last Synced Location` | Meets the acceptance summary above | E2E |
| BR-246 | Approved rule is satisfied for `View Each Member’s Last Synced Location` | Accepted and persisted or returned as applicable | Integration |
| BR-246 | Approved rule is violated for `View Each Member’s Last Synced Location` | Rejected with no partial side effects | Boundary / Integration |
| BR-405 | Approved rule is satisfied for `View Each Member’s Last Synced Location` | Accepted and persisted or returned as applicable | Integration |
| BR-405 | Approved rule is violated for `View Each Member’s Last Synced Location` | Rejected with no partial side effects | Boundary / Integration |
| BR-406 | Approved rule is satisfied for `View Each Member’s Last Synced Location` | Accepted and persisted or returned as applicable | Integration |
| BR-406 | Approved rule is violated for `View Each Member’s Last Synced Location` | Rejected with no partial side effects | Boundary / Integration |
| BR-407 | Approved rule is satisfied for `View Each Member’s Last Synced Location` | Accepted and persisted or returned as applicable | Integration |
| BR-407 | Approved rule is violated for `View Each Member’s Last Synced Location` | Rejected with no partial side effects | Boundary / Integration |
| BR-172 | Approved rule is satisfied for `View Each Member’s Last Synced Location` | Accepted and persisted or returned as applicable | Integration |
| BR-172 | Approved rule is violated for `View Each Member’s Last Synced Location` | Rejected with no partial side effects | Boundary / Integration |
| BR-173 | Approved rule is satisfied for `View Each Member’s Last Synced Location` | Accepted and persisted or returned as applicable | Integration |
| BR-173 | Approved rule is violated for `View Each Member’s Last Synced Location` | Rejected with no partial side effects | Boundary / Integration |
| BR-186 | Approved rule is satisfied for `View Each Member’s Last Synced Location` | Accepted and persisted or returned as applicable | Integration |
| BR-186 | Approved rule is violated for `View Each Member’s Last Synced Location` | Rejected with no partial side effects | Boundary / Integration |
| BR-201 | Approved rule is satisfied for `View Each Member’s Last Synced Location` | Accepted and persisted or returned as applicable | Integration |
| BR-201 | Approved rule is violated for `View Each Member’s Last Synced Location` | Rejected with no partial side effects | Boundary / Integration |
| Remaining mapped BRs | Each mapped BR has valid and violation coverage in the owning test suite | Coverage proves the rule is enforced | Unit / Integration / E2E |

## 12. Open Decisions & References

### 12.1 Open Decisions

None.

### 12.2 References

- Product Backlog v3.1.
- CTMS Business Rules workbook.
- CTMS Architecture Overview.
