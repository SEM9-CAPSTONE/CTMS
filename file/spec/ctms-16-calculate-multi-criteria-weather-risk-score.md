# CTMS-016 — Calculate Multi-Criteria Weather Risk Score

## 1. Overview

Story: CTMS-016
Epic: EPIC 3. Weather Risk Assessment
Use Case: Calculate Multi-Criteria Weather Risk Score
Priority: Must Have

Goal:
Allow System to complete `Calculate Multi-Criteria Weather Risk Score` within the approved CTMS v3.1 scope.

Acceptance summary:
The Calculate Multi-Criteria Weather Risk Score workflow must satisfy the approved PB v3.1 acceptance criteria for this story. Do not copy the Vietnamese backlog text into this spec; implementers must preserve the approved source meaning when refining detailed tests.

## 2. Scope

### In Scope

- Story-owned behavior for `Calculate Multi-Criteria Weather Risk Score`.
- Validation, authorization, state handling, persistence, audit, and observable errors required by the mapped Business Rules.
- Story-specific acceptance tests that prove both allowed and rejected paths.

### Out of Scope

- Behavior owned by dependency stories unless a mapped BR explicitly makes it part of this story.
- Implementation of dependency stories: CTMS-015.

## 3. Actors & Authorization

- System: primary business actor for this story.
- Backend API: authoritative enforcement point for permissions, state, and business rules.
- UI or client application: may guide the user, but must not replace backend enforcement.

Authorization must be concrete: the caller must have the role, ownership, assignment, or operational relationship required by the mapped BRs before any protected data is returned or any state-changing action is committed.

## 4. Preconditions & Dependencies

- Product Backlog v3.1 row `CTMS-016` is the story scope source.
- The mapped Primary BR IDs below exist in the latest Business Rules workbook.
- Required domain records already exist and are in states allowed by the mapped BRs.
- Dependencies:
- CTMS-015

## 5. Business Rules

| BR | Rule |
|---|---|
| BR-041 | This BR is the authoritative story rule for `Calculate Multi-Criteria Weather Risk Score`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-042 | This BR is the authoritative story rule for `Calculate Multi-Criteria Weather Risk Score`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-043 | This BR is the authoritative story rule for `Calculate Multi-Criteria Weather Risk Score`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-175 | Clients must not self-assert server-owned state, ownership, pricing, capacity, ledger, audit, or safety outcomes. |
| BR-212 | Any Business Rule, enum, state transition, or API contract change must update the spec, tests, and data documentation before the story is Done. |
| BR-213 | Every mapped Business Rule must have at least one valid-path test and one violation-path test; concurrency, idempotency, and transaction rules require integration or E2E coverage. |

## 6. State & Lifecycle

No new lifecycle is defined by this story. Existing entity states from the owning domain remain authoritative.

Do not introduce placeholder workflow states unless an owning domain contract explicitly defines them.

## 7. Business Flow

1. System initiates `Calculate Multi-Criteria Weather Risk Score` through the approved UI, API, scheduled job, or integration point.
2. The backend loads the required source records and verifies authorization, ownership or assignment, current state, and all mapped BR prerequisites.
3. The backend applies the story-owned decision logic from Section 5.
4. If any mapped rule is violated, the backend rejects the operation with no partial side effects and returns an actionable error.
5. If the action changes authoritative data, the change commits atomically with required audit and post-commit notifications.
6. The client presents the committed result or the rejection reason without exposing protected data.

## 8. Data & Invariants

- Persist or return only fields required for `Calculate Multi-Criteria Weather Risk Score` and the mapped BRs.
- Preserve authoritative identifiers, ownership links, timestamps, snapshots, status values, and audit references when they affect the business outcome.
- Derived counters, scores, release-gate metrics, and ledger amounts must be traceable to their source records and rule version.
- Do not invent tables, enum values, state machines, or audit stores solely for this story.

## 9. API / Integration Contract

Confirmed current API surface:

- `POST /weather/risk-score`
- `GET /weather/risk-score/latest`

Request and response DTO details remain owned by the implementation files and must stay aligned with this story's BRs.

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
| PB AC | Approved backlog acceptance path for `Calculate Multi-Criteria Weather Risk Score` | Meets the acceptance summary above | E2E |
| BR-041 | Approved rule is satisfied for `Calculate Multi-Criteria Weather Risk Score` | Accepted and persisted or returned as applicable | Integration |
| BR-041 | Approved rule is violated for `Calculate Multi-Criteria Weather Risk Score` | Rejected with no partial side effects | Boundary / Integration |
| BR-042 | Approved rule is satisfied for `Calculate Multi-Criteria Weather Risk Score` | Accepted and persisted or returned as applicable | Integration |
| BR-042 | Approved rule is violated for `Calculate Multi-Criteria Weather Risk Score` | Rejected with no partial side effects | Boundary / Integration |
| BR-043 | Approved rule is satisfied for `Calculate Multi-Criteria Weather Risk Score` | Accepted and persisted or returned as applicable | Integration |
| BR-043 | Approved rule is violated for `Calculate Multi-Criteria Weather Risk Score` | Rejected with no partial side effects | Boundary / Integration |
| BR-175 | Approved rule is satisfied for `Calculate Multi-Criteria Weather Risk Score` | Accepted and persisted or returned as applicable | Integration |
| BR-175 | Approved rule is violated for `Calculate Multi-Criteria Weather Risk Score` | Rejected with no partial side effects | Boundary / Integration |
| BR-212 | Approved rule is satisfied for `Calculate Multi-Criteria Weather Risk Score` | Accepted and persisted or returned as applicable | Integration |
| BR-212 | Approved rule is violated for `Calculate Multi-Criteria Weather Risk Score` | Rejected with no partial side effects | Boundary / Integration |
| BR-213 | Approved rule is satisfied for `Calculate Multi-Criteria Weather Risk Score` | Accepted and persisted or returned as applicable | Integration |
| BR-213 | Approved rule is violated for `Calculate Multi-Criteria Weather Risk Score` | Rejected with no partial side effects | Boundary / Integration |

## 12. Open Decisions & References

### 12.1 Open Decisions

None.

### 12.2 References

- Product Backlog v3.1.
- CTMS Business Rules workbook.
- CTMS Architecture Overview.
