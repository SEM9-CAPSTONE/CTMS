# CTMS-116 — Detect Potential Safety Hotspots from Deviation Patterns

## 1. Overview

Story: CTMS-116
Epic: EPIC 17. Reports and Evaluation Metrics
Use Case: Detect Potential Safety Hotspots from Deviation Patterns
Priority: Should Have

Goal:
Allow Admin to complete `Detect Potential Safety Hotspots from Deviation Patterns` within the approved CTMS v3.1 scope.

Acceptance summary:
The Detect Potential Safety Hotspots from Deviation Patterns workflow must satisfy the approved PB v3.1 acceptance criteria for this story. Do not copy the Vietnamese backlog text into this spec; implementers must preserve the approved source meaning when refining detailed tests.

## 2. Scope

### In Scope

- Story-owned behavior for `Detect Potential Safety Hotspots from Deviation Patterns`.
- Validation, authorization, state handling, persistence, audit, and observable errors required by the mapped Business Rules.
- Story-specific acceptance tests that prove both allowed and rejected paths.

### Out of Scope

- Behavior owned by dependency stories unless a mapped BR explicitly makes it part of this story.
- Implementation of dependency stories: CTMS-115.

## 3. Actors & Authorization

- Admin: primary business actor for this story.
- Backend API: authoritative enforcement point for permissions, state, and business rules.
- UI or client application: may guide the user, but must not replace backend enforcement.

Authorization must be concrete: the caller must have the role, ownership, assignment, or operational relationship required by the mapped BRs before any protected data is returned or any state-changing action is committed.

## 4. Preconditions & Dependencies

- Product Backlog v3.1 row `CTMS-116` is the story scope source.
- The mapped Primary BR IDs below exist in the latest Business Rules workbook.
- Required domain records already exist and are in states allowed by the mapped BRs.
- Dependencies:
- CTMS-115

## 5. Business Rules

| BR | Rule |
|---|---|
| BR-355 | This BR is the authoritative story rule for `Detect Potential Safety Hotspots from Deviation Patterns`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-356 | This BR is the authoritative story rule for `Detect Potential Safety Hotspots from Deviation Patterns`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: AI, GPS. |
| BR-417 | This BR is the authoritative story rule for `Detect Potential Safety Hotspots from Deviation Patterns`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: 30 days, 50m. |
| BR-418 | This BR is the authoritative story rule for `Detect Potential Safety Hotspots from Deviation Patterns`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-420 | This BR is the authoritative story rule for `Detect Potential Safety Hotspots from Deviation Patterns`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-421 | This BR is the authoritative story rule for `Detect Potential Safety Hotspots from Deviation Patterns`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-422 | This BR is the authoritative story rule for `Detect Potential Safety Hotspots from Deviation Patterns`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: DISMISSED. |
| BR-183 | The system must distinguish source event time, client time, provider time, and server/database commit time when the workflow depends on timing. |
| BR-188 | Date and time handling must use the authoritative timezone and ordering rules for the business workflow, and invalid or impossible time ranges must be rejected. |
| BR-212 | Any Business Rule, enum, state transition, or API contract change must update the spec, tests, and data documentation before the story is Done. |
| BR-213 | Every mapped Business Rule must have at least one valid-path test and one violation-path test; concurrency, idempotency, and transaction rules require integration or E2E coverage. |
| BR-361 | Safety statistics or hotspot aggregates may be retained longer than raw GPS data, but they must minimize personal data, enforce authorization, and not expose raw member location beyond allowed operations, safety review, or audit purposes. |
| BR-416 | Safety statistics must publish a clear denominator. For example, a percentage of Trips with deviation must define eligible Trips, time window, Route/version, and the condition that counts a Trip as having deviation. |
| BR-432 | Safety configuration changes must not retroactively change how existing events are interpreted; any re-analysis must create a new result/version instead of rewriting old evidence. |

## 6. State & Lifecycle

Relevant states from the approved rules: `active`.

Do not introduce placeholder workflow states unless an owning domain contract explicitly defines them.

## 7. Business Flow

1. Admin initiates `Detect Potential Safety Hotspots from Deviation Patterns` through the approved UI, API, scheduled job, or integration point.
2. The backend loads the required source records and verifies authorization, ownership or assignment, current state, and all mapped BR prerequisites.
3. The backend applies the story-owned decision logic from Section 5.
4. If any mapped rule is violated, the backend rejects the operation with no partial side effects and returns an actionable error.
5. If the action changes authoritative data, the change commits atomically with required audit and post-commit notifications.
6. The client presents the committed result or the rejection reason without exposing protected data.

## 8. Data & Invariants

- Persist or return only fields required for `Detect Potential Safety Hotspots from Deviation Patterns` and the mapped BRs.
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
| PB AC | Approved backlog acceptance path for `Detect Potential Safety Hotspots from Deviation Patterns` | Meets the acceptance summary above | E2E |
| BR-355 | Approved rule is satisfied for `Detect Potential Safety Hotspots from Deviation Patterns` | Accepted and persisted or returned as applicable | Integration |
| BR-355 | Approved rule is violated for `Detect Potential Safety Hotspots from Deviation Patterns` | Rejected with no partial side effects | Boundary / Integration |
| BR-356 | Approved rule is satisfied for `Detect Potential Safety Hotspots from Deviation Patterns` | Accepted and persisted or returned as applicable | Integration |
| BR-356 | Approved rule is violated for `Detect Potential Safety Hotspots from Deviation Patterns` | Rejected with no partial side effects | Boundary / Integration |
| BR-417 | Approved rule is satisfied for `Detect Potential Safety Hotspots from Deviation Patterns` | Accepted and persisted or returned as applicable | Integration |
| BR-417 | Approved rule is violated for `Detect Potential Safety Hotspots from Deviation Patterns` | Rejected with no partial side effects | Boundary / Integration |
| BR-418 | Approved rule is satisfied for `Detect Potential Safety Hotspots from Deviation Patterns` | Accepted and persisted or returned as applicable | Integration |
| BR-418 | Approved rule is violated for `Detect Potential Safety Hotspots from Deviation Patterns` | Rejected with no partial side effects | Boundary / Integration |
| BR-420 | Approved rule is satisfied for `Detect Potential Safety Hotspots from Deviation Patterns` | Accepted and persisted or returned as applicable | Integration |
| BR-420 | Approved rule is violated for `Detect Potential Safety Hotspots from Deviation Patterns` | Rejected with no partial side effects | Boundary / Integration |
| BR-421 | Approved rule is satisfied for `Detect Potential Safety Hotspots from Deviation Patterns` | Accepted and persisted or returned as applicable | Integration |
| BR-421 | Approved rule is violated for `Detect Potential Safety Hotspots from Deviation Patterns` | Rejected with no partial side effects | Boundary / Integration |
| BR-422 | Approved rule is satisfied for `Detect Potential Safety Hotspots from Deviation Patterns` | Accepted and persisted or returned as applicable | Integration |
| BR-422 | Approved rule is violated for `Detect Potential Safety Hotspots from Deviation Patterns` | Rejected with no partial side effects | Boundary / Integration |
| BR-183 | Approved rule is satisfied for `Detect Potential Safety Hotspots from Deviation Patterns` | Accepted and persisted or returned as applicable | Integration |
| BR-183 | Approved rule is violated for `Detect Potential Safety Hotspots from Deviation Patterns` | Rejected with no partial side effects | Boundary / Integration |
| Remaining mapped BRs | Each mapped BR has valid and violation coverage in the owning test suite | Coverage proves the rule is enforced | Unit / Integration / E2E |

## 12. Open Decisions & References

### 12.1 Open Decisions

None.

### 12.2 References

- Product Backlog v3.1.
- CTMS Business Rules workbook.
- CTMS Architecture Overview.
