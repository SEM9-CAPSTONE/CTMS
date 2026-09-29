# CTMS-047 — Assign Porter to Trekking Trip

## 1. Overview

Story: CTMS-047
Epic: EPIC 7. Porter Management
Use Case: Assign Porter to Trekking Trip
Priority: Must Have

Goal:
Allow Host to complete `Assign Porter to Trekking Trip` within the approved CTMS v3.1 scope.

Acceptance summary:
The Assign Porter to Trekking Trip workflow must satisfy the approved PB v3.1 acceptance criteria for this story. Do not copy the Vietnamese backlog text into this spec; implementers must preserve the approved source meaning when refining detailed tests.

## 2. Scope

### In Scope

- Story-owned behavior for `Assign Porter to Trekking Trip`.
- Validation, authorization, state handling, persistence, audit, and observable errors required by the mapped Business Rules.
- Story-specific acceptance tests that prove both allowed and rejected paths.

### Out of Scope

- Behavior owned by dependency stories unless a mapped BR explicitly makes it part of this story.
- Implementation of dependency stories: CTMS-021, CTMS-043, CTMS-046.

## 3. Actors & Authorization

- Host: primary business actor for this story.
- Backend API: authoritative enforcement point for permissions, state, and business rules.
- UI or client application: may guide the user, but must not replace backend enforcement.

Authorization must be concrete: the caller must have the role, ownership, assignment, or operational relationship required by the mapped BRs before any protected data is returned or any state-changing action is committed.

## 4. Preconditions & Dependencies

- Product Backlog v3.1 row `CTMS-047` is the story scope source.
- The mapped Primary BR IDs below exist in the latest Business Rules workbook.
- Required domain records already exist and are in states allowed by the mapped BRs.
- Dependencies:
- CTMS-021
- CTMS-043
- CTMS-046

## 5. Business Rules

| BR | Rule |
|---|---|
| BR-156 | A Porter Assignment may be created only when there is an `ACCEPTED` Porter Request for the same Trip and the same Porter. At commit time, the backend must revalidate that the Porter profile and route qualification are still valid and that the assignment has no schedule conflict. The Porter Assignment is the authoritative schedule record for the Porter. |
| BR-157 | `porter_assignment.is_lead = true` is valid only when the Porter has route proficiency `proficient` or `expert` for the assigned route. |
| BR-158 | The new assignment `work_range` must not overlap with any active or accepted assignment for the same Porter. This check must be protected by a database transaction, lock, exclusion constraint, or equivalent concurrency-safe mechanism. Multiple accepted Porter Requests may exist, but only the first non-conflicting committed Assignment reserves the schedule. |
| BR-159 | The Porter's accepted request is the consent for the Host to create the Assignment. The system must not require a second accept/decline round for the Assignment. If eligibility changes before Assignment creation, the backend must reject the Assignment without reverting the original Request back to `PENDING`. |
| BR-222 | Before committing qualification, Porter Request, or Porter Assignment changes, the backend must re-check current Porter/profile status, route qualification, request state, assignment state, and schedule-conflict rules. |
| BR-172 | Sensitive personal, health, payment, and location data may be accessed only by an authorized actor with a valid business relationship. |
| BR-175 | Clients must not self-assert server-owned state, ownership, pricing, capacity, ledger, audit, or safety outcomes. |
| BR-176 | State-changing operations must persist the authoritative result before dependent side effects are emitted. |
| BR-177 | Duplicate submissions and retries must not create duplicate authoritative records. |
| BR-179 | Multi-record operations that define one business outcome must use a transaction or equivalent atomic boundary. |
| BR-180 | Stateful resources must follow defined state transitions and must not use enum values outside the database or API contract. |
| BR-181 | Before updating state, the backend must verify the current persisted state; stale requests must fail with a business conflict. |
| BR-183 | The system must distinguish source event time, client time, provider time, and server/database commit time when the workflow depends on timing. |
| BR-191 | Critical actions must write an audit record containing actor, action, target, timestamp, before/after values or reason, and affected business identifiers. |
| BR-192 | Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, unnecessary health data, or private payloads beyond the audit need. |
| BR-194 | Notifications or event side effects may be emitted only after the main business transaction commits successfully, preferably through an outbox or queue. |
| BR-195 | A single business event must not create duplicate notifications for the same recipient, target, and event type. |
| BR-210 | When backend rejects a stale or concurrent request, the UI must preserve entered data, show the reason, and allow reload or retry. |
| BR-211 | Operational, financial, safety, authorization, and administrative decisions must be traceable to the actor, source record, rule, and timestamp that produced them. |
| BR-212 | Any Business Rule, enum, state transition, or API contract change must update the spec, tests, and data documentation before the story is Done. |
| BR-213 | Every mapped Business Rule must have at least one valid-path test and one violation-path test; concurrency, idempotency, and transaction rules require integration or E2E coverage. |

## 6. State & Lifecycle

Relevant states from the approved rules: `active`, `pass`, `fail`.

Do not introduce placeholder workflow states unless an owning domain contract explicitly defines them.

## 7. Business Flow

1. Host initiates `Assign Porter to Trekking Trip` through the approved UI, API, scheduled job, or integration point.
2. The backend loads the required source records and verifies authorization, ownership or assignment, current state, and all mapped BR prerequisites.
3. The backend applies the story-owned decision logic from Section 5.
4. If any mapped rule is violated, the backend rejects the operation with no partial side effects and returns an actionable error.
5. If the action changes authoritative data, the change commits atomically with required audit and post-commit notifications.
6. The client presents the committed result or the rejection reason without exposing protected data.

## 8. Data & Invariants

- Persist or return only fields required for `Assign Porter to Trekking Trip` and the mapped BRs.
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
| PB AC | Approved backlog acceptance path for `Assign Porter to Trekking Trip` | Meets the acceptance summary above | E2E |
| BR-156 | Approved rule is satisfied for `Assign Porter to Trekking Trip` | Accepted and persisted or returned as applicable | Integration |
| BR-156 | Approved rule is violated for `Assign Porter to Trekking Trip` | Rejected with no partial side effects | Boundary / Integration |
| BR-157 | Approved rule is satisfied for `Assign Porter to Trekking Trip` | Accepted and persisted or returned as applicable | Integration |
| BR-157 | Approved rule is violated for `Assign Porter to Trekking Trip` | Rejected with no partial side effects | Boundary / Integration |
| BR-158 | Approved rule is satisfied for `Assign Porter to Trekking Trip` | Accepted and persisted or returned as applicable | Integration |
| BR-158 | Approved rule is violated for `Assign Porter to Trekking Trip` | Rejected with no partial side effects | Boundary / Integration |
| BR-159 | Approved rule is satisfied for `Assign Porter to Trekking Trip` | Accepted and persisted or returned as applicable | Integration |
| BR-159 | Approved rule is violated for `Assign Porter to Trekking Trip` | Rejected with no partial side effects | Boundary / Integration |
| BR-222 | Approved rule is satisfied for `Assign Porter to Trekking Trip` | Accepted and persisted or returned as applicable | Integration |
| BR-222 | Approved rule is violated for `Assign Porter to Trekking Trip` | Rejected with no partial side effects | Boundary / Integration |
| BR-172 | Approved rule is satisfied for `Assign Porter to Trekking Trip` | Accepted and persisted or returned as applicable | Integration |
| BR-172 | Approved rule is violated for `Assign Porter to Trekking Trip` | Rejected with no partial side effects | Boundary / Integration |
| BR-175 | Approved rule is satisfied for `Assign Porter to Trekking Trip` | Accepted and persisted or returned as applicable | Integration |
| BR-175 | Approved rule is violated for `Assign Porter to Trekking Trip` | Rejected with no partial side effects | Boundary / Integration |
| BR-176 | Approved rule is satisfied for `Assign Porter to Trekking Trip` | Accepted and persisted or returned as applicable | Integration |
| BR-176 | Approved rule is violated for `Assign Porter to Trekking Trip` | Rejected with no partial side effects | Boundary / Integration |
| Remaining mapped BRs | Each mapped BR has valid and violation coverage in the owning test suite | Coverage proves the rule is enforced | Unit / Integration / E2E |

## 12. Open Decisions & References

### 12.1 Open Decisions

None.

### 12.2 References

- Product Backlog v3.1.
- CTMS Business Rules workbook.
- CTMS Architecture Overview.
