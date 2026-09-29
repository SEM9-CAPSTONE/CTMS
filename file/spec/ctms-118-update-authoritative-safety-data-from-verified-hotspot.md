# CTMS-118 — Update Authoritative Safety Data from Verified Hotspot

## 1. Overview

Story: CTMS-118
Epic: EPIC 2. Trekking Route and Checkpoint Management
Use Case: Update Authoritative Safety Data from Verified Hotspot
Priority: Should Have

Goal:
Allow Admin to complete `Update Authoritative Safety Data from Verified Hotspot` within the approved CTMS v3.1 scope.

Acceptance summary:
The Update Authoritative Safety Data from Verified Hotspot workflow must satisfy the approved PB v3.1 acceptance criteria for this story. Do not copy the Vietnamese backlog text into this spec; implementers must preserve the approved source meaning when refining detailed tests.

## 2. Scope

### In Scope

- Story-owned behavior for `Update Authoritative Safety Data from Verified Hotspot`.
- Validation, authorization, state handling, persistence, audit, and observable errors required by the mapped Business Rules.
- Story-specific acceptance tests that prove both allowed and rejected paths.

### Out of Scope

- Behavior owned by dependency stories unless a mapped BR explicitly makes it part of this story.
- Implementation of dependency stories: CTMS-117, CTMS-103.

## 3. Actors & Authorization

- Admin: primary business actor for this story.
- Backend API: authoritative enforcement point for permissions, state, and business rules.
- UI or client application: may guide the user, but must not replace backend enforcement.

Authorization must be concrete: the caller must have the role, ownership, assignment, or operational relationship required by the mapped BRs before any protected data is returned or any state-changing action is committed.

## 4. Preconditions & Dependencies

- Product Backlog v3.1 row `CTMS-118` is the story scope source.
- The mapped Primary BR IDs below exist in the latest Business Rules workbook.
- Required domain records already exist and are in states allowed by the mapped BRs.
- Dependencies:
- CTMS-117
- CTMS-103

## 5. Business Rules

| BR | Rule |
|---|---|
| BR-358 | Only a `CONFIRMED` PotentialSafetyHotspot may support corrective action against authoritative safety data, and every corrective action must pass current authorization and validation. |
| BR-359 | When authoritative Route geometry, Route Checkpoint, route hazard areas, or safety instruction changes in a way that affects the Offline Safety Package, the system must create a new package version. Published packages must not be edited in place. |
| BR-419 | This BR is the authoritative story rule for `Update Authoritative Safety Data from Verified Hotspot`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: CONFIRMED. |
| BR-423 | A `CONFIRMED` hotspot does not automatically require Route geometry changes; the reviewer must choose the appropriate corrective-action type or record a no-data-change/other action with reason. |
| BR-426 | This BR is the authoritative story rule for `Update Authoritative Safety Data from Verified Hotspot`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-183 | The system must distinguish source event time, client time, provider time, and server/database commit time when the workflow depends on timing. |
| BR-188 | Date and time handling must use the authoritative timezone and ordering rules for the business workflow, and invalid or impossible time ranges must be rejected. |
| BR-191 | Critical actions must write an audit record containing actor, action, target, timestamp, before/after values or reason, and affected business identifiers. |
| BR-212 | Any Business Rule, enum, state transition, or API contract change must update the spec, tests, and data documentation before the story is Done. |
| BR-213 | Every mapped Business Rule must have at least one valid-path test and one violation-path test; concurrency, idempotency, and transaction rules require integration or E2E coverage. |
| BR-361 | Safety statistics or hotspot aggregates may be retained longer than raw GPS data, but they must minimize personal data, enforce authorization, and not expose raw member location beyond allowed operations, safety review, or audit purposes. |

## 6. State & Lifecycle

Relevant states from the approved rules: `published`, `confirmed`, `pass`.

Do not introduce placeholder workflow states unless an owning domain contract explicitly defines them.

## 7. Business Flow

1. Admin initiates `Update Authoritative Safety Data from Verified Hotspot` through the approved UI, API, scheduled job, or integration point.
2. The backend loads the required source records and verifies authorization, ownership or assignment, current state, and all mapped BR prerequisites.
3. The backend applies the story-owned decision logic from Section 5.
4. If any mapped rule is violated, the backend rejects the operation with no partial side effects and returns an actionable error.
5. If the action changes authoritative data, the change commits atomically with required audit and post-commit notifications.
6. The client presents the committed result or the rejection reason without exposing protected data.

## 8. Data & Invariants

- Persist or return only fields required for `Update Authoritative Safety Data from Verified Hotspot` and the mapped BRs.
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
| PB AC | Approved backlog acceptance path for `Update Authoritative Safety Data from Verified Hotspot` | Meets the acceptance summary above | E2E |
| BR-358 | Approved rule is satisfied for `Update Authoritative Safety Data from Verified Hotspot` | Accepted and persisted or returned as applicable | Integration |
| BR-358 | Approved rule is violated for `Update Authoritative Safety Data from Verified Hotspot` | Rejected with no partial side effects | Boundary / Integration |
| BR-359 | Approved rule is satisfied for `Update Authoritative Safety Data from Verified Hotspot` | Accepted and persisted or returned as applicable | Integration |
| BR-359 | Approved rule is violated for `Update Authoritative Safety Data from Verified Hotspot` | Rejected with no partial side effects | Boundary / Integration |
| BR-419 | Approved rule is satisfied for `Update Authoritative Safety Data from Verified Hotspot` | Accepted and persisted or returned as applicable | Integration |
| BR-419 | Approved rule is violated for `Update Authoritative Safety Data from Verified Hotspot` | Rejected with no partial side effects | Boundary / Integration |
| BR-423 | Approved rule is satisfied for `Update Authoritative Safety Data from Verified Hotspot` | Accepted and persisted or returned as applicable | Integration |
| BR-423 | Approved rule is violated for `Update Authoritative Safety Data from Verified Hotspot` | Rejected with no partial side effects | Boundary / Integration |
| BR-426 | Approved rule is satisfied for `Update Authoritative Safety Data from Verified Hotspot` | Accepted and persisted or returned as applicable | Integration |
| BR-426 | Approved rule is violated for `Update Authoritative Safety Data from Verified Hotspot` | Rejected with no partial side effects | Boundary / Integration |
| BR-183 | Approved rule is satisfied for `Update Authoritative Safety Data from Verified Hotspot` | Accepted and persisted or returned as applicable | Integration |
| BR-183 | Approved rule is violated for `Update Authoritative Safety Data from Verified Hotspot` | Rejected with no partial side effects | Boundary / Integration |
| BR-188 | Approved rule is satisfied for `Update Authoritative Safety Data from Verified Hotspot` | Accepted and persisted or returned as applicable | Integration |
| BR-188 | Approved rule is violated for `Update Authoritative Safety Data from Verified Hotspot` | Rejected with no partial side effects | Boundary / Integration |
| BR-191 | Approved rule is satisfied for `Update Authoritative Safety Data from Verified Hotspot` | Accepted and persisted or returned as applicable | Integration |
| BR-191 | Approved rule is violated for `Update Authoritative Safety Data from Verified Hotspot` | Rejected with no partial side effects | Boundary / Integration |
| Remaining mapped BRs | Each mapped BR has valid and violation coverage in the owning test suite | Coverage proves the rule is enforced | Unit / Integration / E2E |

## 12. Open Decisions & References

### 12.1 Open Decisions

None.

### 12.2 References

- Product Backlog v3.1.
- CTMS Business Rules workbook.
- CTMS Architecture Overview.
