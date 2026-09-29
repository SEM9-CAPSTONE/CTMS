# CTMS-033 — Automatically Expire Booking

## 1. Overview

Story: CTMS-033
Epic: EPIC 5. Booking and Payment
Use Case: Automatically Expire Booking
Priority: Must Have

Goal:
Allow System to complete `Automatically Expire Booking` within the approved CTMS v3.1 scope.

Acceptance summary:
The Automatically Expire Booking workflow must satisfy the approved PB v3.1 acceptance criteria for this story. Do not copy the Vietnamese backlog text into this spec; implementers must preserve the approved source meaning when refining detailed tests.

## 2. Scope

### In Scope

- Story-owned behavior for `Automatically Expire Booking`.
- Validation, authorization, state handling, persistence, audit, and observable errors required by the mapped Business Rules.
- Story-specific acceptance tests that prove both allowed and rejected paths.

### Out of Scope

- Behavior owned by dependency stories unless a mapped BR explicitly makes it part of this story.
- Implementation of dependency stories: CTMS-029, CTMS-032.

## 3. Actors & Authorization

- System: primary business actor for this story.
- Backend API: authoritative enforcement point for permissions, state, and business rules.
- UI or client application: may guide the user, but must not replace backend enforcement.

Authorization must be concrete: the caller must have the role, ownership, assignment, or operational relationship required by the mapped BRs before any protected data is returned or any state-changing action is committed.

## 4. Preconditions & Dependencies

- Product Backlog v3.1 row `CTMS-033` is the story scope source.
- The mapped Primary BR IDs below exist in the latest Business Rules workbook.
- Required domain records already exist and are in states allowed by the mapped BRs.
- Dependencies:
- CTMS-029
- CTMS-032

## 5. Business Rules

| BR | Rule |
|---|---|
| BR-093 | This BR is the authoritative story rule for `Automatically Expire Booking`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: <. |
| BR-094 | This BR is the authoritative story rule for `Automatically Expire Booking`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-095 | This BR is the authoritative story rule for `Automatically Expire Booking`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-096 | This BR is the authoritative story rule for `Automatically Expire Booking`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: NULL. |
| BR-097 | This BR is the authoritative story rule for `Automatically Expire Booking`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-176 | State-changing operations must persist the authoritative result before dependent side effects are emitted. |
| BR-177 | Duplicate submissions and retries must not create duplicate authoritative records. |
| BR-178 | Provider, sync, queue, and notification retries must be idempotent. |
| BR-180 | Stateful resources must follow defined state transitions and must not use enum values outside the database or API contract. |
| BR-181 | Before updating state, the backend must verify the current persisted state; stale requests must fail with a business conflict. |
| BR-188 | Date and time handling must use the authoritative timezone and ordering rules for the business workflow, and invalid or impossible time ranges must be rejected. |
| BR-190 | Expired, consumed, revoked, superseded, or stale credentials, tokens, OTPs, packages, snapshots, or assignments must not be accepted. |
| BR-191 | Critical actions must write an audit record containing actor, action, target, timestamp, before/after values or reason, and affected business identifiers. |
| BR-192 | Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, unnecessary health data, or private payloads beyond the audit need. |
| BR-193 | Automated actions must record `actor_id = NULL` or a system actor and must store a clear execution reason. |
| BR-194 | Notifications or event side effects may be emitted only after the main business transaction commits successfully, preferably through an outbox or queue. |
| BR-195 | A single business event must not create duplicate notifications for the same recipient, target, and event type. |
| BR-205 | Background jobs must re-check business conditions at execution time and must not rely solely on stale state captured when the job was scheduled. |
| BR-206 | Background jobs must be safely rerunnable; multiple workers must not expire, cancel, refund, or notify the same record more than once. |
| BR-212 | Any Business Rule, enum, state transition, or API contract change must update the spec, tests, and data documentation before the story is Done. |
| BR-213 | Every mapped Business Rule must have at least one valid-path test and one violation-path test; concurrency, idempotency, and transaction rules require integration or E2E coverage. |

## 6. State & Lifecycle

Relevant states from the approved rules: `expired`, `pass`, `fail`.

Do not introduce placeholder workflow states unless an owning domain contract explicitly defines them.

## 7. Business Flow

1. System initiates `Automatically Expire Booking` through the approved UI, API, scheduled job, or integration point.
2. The backend loads the required source records and verifies authorization, ownership or assignment, current state, and all mapped BR prerequisites.
3. The backend applies the story-owned decision logic from Section 5.
4. If any mapped rule is violated, the backend rejects the operation with no partial side effects and returns an actionable error.
5. If the action changes authoritative data, the change commits atomically with required audit and post-commit notifications.
6. The client presents the committed result or the rejection reason without exposing protected data.

## 8. Data & Invariants

- Persist or return only fields required for `Automatically Expire Booking` and the mapped BRs.
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
| PB AC | Approved backlog acceptance path for `Automatically Expire Booking` | Meets the acceptance summary above | E2E |
| BR-093 | Approved rule is satisfied for `Automatically Expire Booking` | Accepted and persisted or returned as applicable | Integration |
| BR-093 | Approved rule is violated for `Automatically Expire Booking` | Rejected with no partial side effects | Boundary / Integration |
| BR-094 | Approved rule is satisfied for `Automatically Expire Booking` | Accepted and persisted or returned as applicable | Integration |
| BR-094 | Approved rule is violated for `Automatically Expire Booking` | Rejected with no partial side effects | Boundary / Integration |
| BR-095 | Approved rule is satisfied for `Automatically Expire Booking` | Accepted and persisted or returned as applicable | Integration |
| BR-095 | Approved rule is violated for `Automatically Expire Booking` | Rejected with no partial side effects | Boundary / Integration |
| BR-096 | Approved rule is satisfied for `Automatically Expire Booking` | Accepted and persisted or returned as applicable | Integration |
| BR-096 | Approved rule is violated for `Automatically Expire Booking` | Rejected with no partial side effects | Boundary / Integration |
| BR-097 | Approved rule is satisfied for `Automatically Expire Booking` | Accepted and persisted or returned as applicable | Integration |
| BR-097 | Approved rule is violated for `Automatically Expire Booking` | Rejected with no partial side effects | Boundary / Integration |
| BR-176 | Approved rule is satisfied for `Automatically Expire Booking` | Accepted and persisted or returned as applicable | Integration |
| BR-176 | Approved rule is violated for `Automatically Expire Booking` | Rejected with no partial side effects | Boundary / Integration |
| BR-177 | Approved rule is satisfied for `Automatically Expire Booking` | Accepted and persisted or returned as applicable | Integration |
| BR-177 | Approved rule is violated for `Automatically Expire Booking` | Rejected with no partial side effects | Boundary / Integration |
| BR-178 | Approved rule is satisfied for `Automatically Expire Booking` | Accepted and persisted or returned as applicable | Integration |
| BR-178 | Approved rule is violated for `Automatically Expire Booking` | Rejected with no partial side effects | Boundary / Integration |
| Remaining mapped BRs | Each mapped BR has valid and violation coverage in the owning test suite | Coverage proves the rule is enforced | Unit / Integration / E2E |

## 12. Open Decisions & References

### 12.1 Open Decisions

None.

### 12.2 References

- Product Backlog v3.1.
- CTMS Business Rules workbook.
- CTMS Architecture Overview.
