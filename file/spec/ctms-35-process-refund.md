# CTMS-035 — Process Refund

## 1. Overview

Story: CTMS-035
Epic: EPIC 5. Booking and Payment
Use Case: Process Refund
Priority: Must Have

Goal:
Allow Authenticated user to complete `Process Refund` within the approved CTMS v3.1 scope.

Acceptance summary:
The Process Refund workflow must satisfy the approved PB v3.1 acceptance criteria for this story. Do not copy the Vietnamese backlog text into this spec; implementers must preserve the approved source meaning when refining detailed tests.

## 2. Scope

### In Scope

- Story-owned behavior for `Process Refund`.
- Validation, authorization, state handling, persistence, audit, and observable errors required by the mapped Business Rules.
- Story-specific acceptance tests that prove both allowed and rejected paths.

### Out of Scope

- Behavior owned by dependency stories unless a mapped BR explicitly makes it part of this story.
- Implementation of dependency stories: CTMS-032, CTMS-034, CTMS-038.

## 3. Actors & Authorization

- Authenticated user: primary business actor for this story.
- Backend API: authoritative enforcement point for permissions, state, and business rules.
- UI or client application: may guide the user, but must not replace backend enforcement.

Authorization must be concrete: the caller must have the role, ownership, assignment, or operational relationship required by the mapped BRs before any protected data is returned or any state-changing action is committed.

## 4. Preconditions & Dependencies

- Product Backlog v3.1 row `CTMS-035` is the story scope source.
- The mapped Primary BR IDs below exist in the latest Business Rules workbook.
- Required domain records already exist and are in states allowed by the mapped BRs.
- Dependencies:
- CTMS-032
- CTMS-034
- CTMS-038

## 5. Business Rules

| BR | Rule |
|---|---|
| BR-103 | This BR is the authoritative story rule for `Process Refund`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: 24 hours. |
| BR-104 | This BR is the authoritative story rule for `Process Refund`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: 24 hours. |
| BR-105 | Payment transactions may use only `pending`, `succeeded`, or `failed`. `bookings.payment_status` is derived from total succeeded refunds as `partially_refunded` or `refunded`; do not use `payments.status = refunded`. |
| BR-106 | The total amount of succeeded and pending refunds allowed by policy must not exceed the refundable succeeded charge amount. The same cancellation or refund request must not be refunded twice. |
| BR-336 | Every succeeded refund before settlement must reduce Held Funds and settlement base. Approved refunds pending provider result must continue blocking settlement; pending or failed refunds must not be treated as succeeded. |
| BR-343 | Ordinary Camper refunds must be processed before settlement within the defined request windows; succeeded refunds reduce Held Funds and settlement base and must not be paid out. |
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
| BR-225 | Every operational action must resolve to success, pending, or failure. On conflict or connectivity failure, user-entered or local data must remain recoverable. |

## 6. State & Lifecycle

Relevant states from the approved rules: `pass`, `fail`.

Do not introduce placeholder workflow states unless an owning domain contract explicitly defines them.

## 7. Business Flow

1. Authenticated user initiates `Process Refund` through the approved UI, API, scheduled job, or integration point.
2. The backend loads the required source records and verifies authorization, ownership or assignment, current state, and all mapped BR prerequisites.
3. The backend applies the story-owned decision logic from Section 5.
4. If any mapped rule is violated, the backend rejects the operation with no partial side effects and returns an actionable error.
5. If the action changes authoritative data, the change commits atomically with required audit and post-commit notifications.
6. The client presents the committed result or the rejection reason without exposing protected data.

## 8. Data & Invariants

- Persist or return only fields required for `Process Refund` and the mapped BRs.
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
| PB AC | Approved backlog acceptance path for `Process Refund` | Meets the acceptance summary above | E2E |
| BR-103 | Approved rule is satisfied for `Process Refund` | Accepted and persisted or returned as applicable | Integration |
| BR-103 | Approved rule is violated for `Process Refund` | Rejected with no partial side effects | Boundary / Integration |
| BR-104 | Approved rule is satisfied for `Process Refund` | Accepted and persisted or returned as applicable | Integration |
| BR-104 | Approved rule is violated for `Process Refund` | Rejected with no partial side effects | Boundary / Integration |
| BR-105 | Approved rule is satisfied for `Process Refund` | Accepted and persisted or returned as applicable | Integration |
| BR-105 | Approved rule is violated for `Process Refund` | Rejected with no partial side effects | Boundary / Integration |
| BR-106 | Approved rule is satisfied for `Process Refund` | Accepted and persisted or returned as applicable | Integration |
| BR-106 | Approved rule is violated for `Process Refund` | Rejected with no partial side effects | Boundary / Integration |
| BR-336 | Approved rule is satisfied for `Process Refund` | Accepted and persisted or returned as applicable | Integration |
| BR-336 | Approved rule is violated for `Process Refund` | Rejected with no partial side effects | Boundary / Integration |
| BR-343 | Approved rule is satisfied for `Process Refund` | Accepted and persisted or returned as applicable | Integration |
| BR-343 | Approved rule is violated for `Process Refund` | Rejected with no partial side effects | Boundary / Integration |
| BR-174 | Approved rule is satisfied for `Process Refund` | Accepted and persisted or returned as applicable | Integration |
| BR-174 | Approved rule is violated for `Process Refund` | Rejected with no partial side effects | Boundary / Integration |
| BR-175 | Approved rule is satisfied for `Process Refund` | Accepted and persisted or returned as applicable | Integration |
| BR-175 | Approved rule is violated for `Process Refund` | Rejected with no partial side effects | Boundary / Integration |
| Remaining mapped BRs | Each mapped BR has valid and violation coverage in the owning test suite | Coverage proves the rule is enforced | Unit / Integration / E2E |

## 12. Open Decisions & References

### 12.1 Open Decisions

None.

### 12.2 References

- Product Backlog v3.1.
- CTMS Business Rules workbook.
- CTMS Architecture Overview.
