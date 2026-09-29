# CTMS-034 — Cancel Booking According to Policy

## 1. Overview

Story: CTMS-034
Epic: EPIC 5. Booking and Payment
Use Case: Cancel Booking According to Policy
Priority: Should Have

Goal:
Allow Camper to complete `Cancel Booking According to Policy` within the approved CTMS v3.1 scope.

Acceptance summary:
The Cancel Booking According to Policy workflow must satisfy the approved PB v3.1 acceptance criteria for this story. Do not copy the Vietnamese backlog text into this spec; implementers must preserve the approved source meaning when refining detailed tests.

## 2. Scope

### In Scope

- Story-owned behavior for `Cancel Booking According to Policy`.
- Validation, authorization, state handling, persistence, audit, and observable errors required by the mapped Business Rules.
- Story-specific acceptance tests that prove both allowed and rejected paths.

### Out of Scope

- Behavior owned by dependency stories unless a mapped BR explicitly makes it part of this story.
- Implementation of dependency stories: CTMS-029.

## 3. Actors & Authorization

- Camper: primary business actor for this story.
- Backend API: authoritative enforcement point for permissions, state, and business rules.
- UI or client application: may guide the user, but must not replace backend enforcement.

Authorization must be concrete: the caller must have the role, ownership, assignment, or operational relationship required by the mapped BRs before any protected data is returned or any state-changing action is committed.

## 4. Preconditions & Dependencies

- Product Backlog v3.1 row `CTMS-034` is the story scope source.
- The mapped Primary BR IDs below exist in the latest Business Rules workbook.
- Required domain records already exist and are in states allowed by the mapped BRs.
- Dependencies:
- CTMS-029

## 5. Business Rules

| BR | Rule |
|---|---|
| BR-098 | This BR is the authoritative story rule for `Cancel Booking According to Policy`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-099 | This BR is the authoritative story rule for `Cancel Booking According to Policy`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-100 | This BR is the authoritative story rule for `Cancel Booking According to Policy`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-101 | This BR is the authoritative story rule for `Cancel Booking According to Policy`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-102 | This BR is the authoritative story rule for `Cancel Booking According to Policy`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-174 | Inputs must be validated for required fields, formats, identifiers, enum values, and cross-entity references before any write is committed. |
| BR-175 | Clients must not self-assert server-owned state, ownership, pricing, capacity, ledger, audit, or safety outcomes. |
| BR-176 | State-changing operations must persist the authoritative result before dependent side effects are emitted. |
| BR-177 | Duplicate submissions and retries must not create duplicate authoritative records. |
| BR-178 | Provider, sync, queue, and notification retries must be idempotent. |
| BR-179 | Multi-record operations that define one business outcome must use a transaction or equivalent atomic boundary. |
| BR-180 | Stateful resources must follow defined state transitions and must not use enum values outside the database or API contract. |
| BR-181 | Before updating state, the backend must verify the current persisted state; stale requests must fail with a business conflict. |
| BR-188 | Date and time handling must use the authoritative timezone and ordering rules for the business workflow, and invalid or impossible time ranges must be rejected. |
| BR-191 | Critical actions must write an audit record containing actor, action, target, timestamp, before/after values or reason, and affected business identifiers. |
| BR-192 | Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, unnecessary health data, or private payloads beyond the audit need. |
| BR-194 | Notifications or event side effects may be emitted only after the main business transaction commits successfully, preferably through an outbox or queue. |
| BR-209 | The UI must prevent duplicate submission while a request is processing. Financial or resource-holding actions may show success only after backend confirmation. |
| BR-210 | When backend rejects a stale or concurrent request, the UI must preserve entered data, show the reason, and allow reload or retry. |
| BR-211 | Operational, financial, safety, authorization, and administrative decisions must be traceable to the actor, source record, rule, and timestamp that produced them. |
| BR-212 | Any Business Rule, enum, state transition, or API contract change must update the spec, tests, and data documentation before the story is Done. |
| BR-213 | Every mapped Business Rule must have at least one valid-path test and one violation-path test; concurrency, idempotency, and transaction rules require integration or E2E coverage. |

## 6. State & Lifecycle

Relevant states from the approved rules: `pass`, `fail`.

Do not introduce placeholder workflow states unless an owning domain contract explicitly defines them.

## 7. Business Flow

1. Camper initiates `Cancel Booking According to Policy` through the approved UI, API, scheduled job, or integration point.
2. The backend loads the required source records and verifies authorization, ownership or assignment, current state, and all mapped BR prerequisites.
3. The backend applies the story-owned decision logic from Section 5.
4. If any mapped rule is violated, the backend rejects the operation with no partial side effects and returns an actionable error.
5. If the action changes authoritative data, the change commits atomically with required audit and post-commit notifications.
6. The client presents the committed result or the rejection reason without exposing protected data.

## 8. Data & Invariants

- Persist or return only fields required for `Cancel Booking According to Policy` and the mapped BRs.
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
| PB AC | Approved backlog acceptance path for `Cancel Booking According to Policy` | Meets the acceptance summary above | E2E |
| BR-098 | Approved rule is satisfied for `Cancel Booking According to Policy` | Accepted and persisted or returned as applicable | Integration |
| BR-098 | Approved rule is violated for `Cancel Booking According to Policy` | Rejected with no partial side effects | Boundary / Integration |
| BR-099 | Approved rule is satisfied for `Cancel Booking According to Policy` | Accepted and persisted or returned as applicable | Integration |
| BR-099 | Approved rule is violated for `Cancel Booking According to Policy` | Rejected with no partial side effects | Boundary / Integration |
| BR-100 | Approved rule is satisfied for `Cancel Booking According to Policy` | Accepted and persisted or returned as applicable | Integration |
| BR-100 | Approved rule is violated for `Cancel Booking According to Policy` | Rejected with no partial side effects | Boundary / Integration |
| BR-101 | Approved rule is satisfied for `Cancel Booking According to Policy` | Accepted and persisted or returned as applicable | Integration |
| BR-101 | Approved rule is violated for `Cancel Booking According to Policy` | Rejected with no partial side effects | Boundary / Integration |
| BR-102 | Approved rule is satisfied for `Cancel Booking According to Policy` | Accepted and persisted or returned as applicable | Integration |
| BR-102 | Approved rule is violated for `Cancel Booking According to Policy` | Rejected with no partial side effects | Boundary / Integration |
| BR-174 | Approved rule is satisfied for `Cancel Booking According to Policy` | Accepted and persisted or returned as applicable | Integration |
| BR-174 | Approved rule is violated for `Cancel Booking According to Policy` | Rejected with no partial side effects | Boundary / Integration |
| BR-175 | Approved rule is satisfied for `Cancel Booking According to Policy` | Accepted and persisted or returned as applicable | Integration |
| BR-175 | Approved rule is violated for `Cancel Booking According to Policy` | Rejected with no partial side effects | Boundary / Integration |
| BR-176 | Approved rule is satisfied for `Cancel Booking According to Policy` | Accepted and persisted or returned as applicable | Integration |
| BR-176 | Approved rule is violated for `Cancel Booking According to Policy` | Rejected with no partial side effects | Boundary / Integration |
| Remaining mapped BRs | Each mapped BR has valid and violation coverage in the owning test suite | Coverage proves the rule is enforced | Unit / Integration / E2E |

## 12. Open Decisions & References

### 12.1 Open Decisions

None.

### 12.2 References

- Product Backlog v3.1.
- CTMS Business Rules workbook.
- CTMS Architecture Overview.
