# CTMS-040 — Add Services and Equipment Rental to Booking

## 1. Overview

Story: CTMS-040
Epic: EPIC 6. Equipment and Logistics
Use Case: Add Services and Equipment Rental to Booking
Priority: Should Have

Goal:
Allow Camper to complete `Add Services and Equipment Rental to Booking` within the approved CTMS v3.1 scope.

Acceptance summary:
The Add Services and Equipment Rental to Booking workflow must satisfy the approved PB v3.1 acceptance criteria for this story. Do not copy the Vietnamese backlog text into this spec; implementers must preserve the approved source meaning when refining detailed tests.

## 2. Scope

### In Scope

- Story-owned behavior for `Add Services and Equipment Rental to Booking`.
- Validation, authorization, state handling, persistence, audit, and observable errors required by the mapped Business Rules.
- Story-specific acceptance tests that prove both allowed and rejected paths.

### Out of Scope

- Behavior owned by dependency stories unless a mapped BR explicitly makes it part of this story.
- Implementation of dependency stories: CTMS-029, CTMS-039.

## 3. Actors & Authorization

- Camper: primary business actor for this story.
- Backend API: authoritative enforcement point for permissions, state, and business rules.
- UI or client application: may guide the user, but must not replace backend enforcement.

Authorization must be concrete: the caller must have the role, ownership, assignment, or operational relationship required by the mapped BRs before any protected data is returned or any state-changing action is committed.

## 4. Preconditions & Dependencies

- Product Backlog v3.1 row `CTMS-040` is the story scope source.
- The mapped Primary BR IDs below exist in the latest Business Rules workbook.
- Required domain records already exist and are in states allowed by the mapped BRs.
- Dependencies:
- CTMS-029
- CTMS-039

## 5. Business Rules

| BR | Rule |
|---|---|
| BR-121 | This BR is the authoritative story rule for `Add Services and Equipment Rental to Booking`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: >. |
| BR-122 | This BR is the authoritative story rule for `Add Services and Equipment Rental to Booking`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-123 | This BR is the authoritative story rule for `Add Services and Equipment Rental to Booking`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-127 | This BR is the authoritative story rule for `Add Services and Equipment Rental to Booking`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-128 | This BR is the authoritative story rule for `Add Services and Equipment Rental to Booking`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-129 | This BR is the authoritative story rule for `Add Services and Equipment Rental to Booking`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-174 | Inputs must be validated for required fields, formats, identifiers, enum values, and cross-entity references before any write is committed. |
| BR-175 | Clients must not self-assert server-owned state, ownership, pricing, capacity, ledger, audit, or safety outcomes. |
| BR-183 | The system must distinguish source event time, client time, provider time, and server/database commit time when the workflow depends on timing. |
| BR-212 | Any Business Rule, enum, state transition, or API contract change must update the spec, tests, and data documentation before the story is Done. |
| BR-213 | Every mapped Business Rule must have at least one valid-path test and one violation-path test; concurrency, idempotency, and transaction rules require integration or E2E coverage. |

## 6. State & Lifecycle

No new lifecycle is defined by this story. Existing entity states from the owning domain remain authoritative.

Do not introduce placeholder workflow states unless an owning domain contract explicitly defines them.

## 7. Business Flow

1. Camper initiates `Add Services and Equipment Rental to Booking` through the approved UI, API, scheduled job, or integration point.
2. The backend loads the required source records and verifies authorization, ownership or assignment, current state, and all mapped BR prerequisites.
3. The backend applies the story-owned decision logic from Section 5.
4. If any mapped rule is violated, the backend rejects the operation with no partial side effects and returns an actionable error.
5. If the action changes authoritative data, the change commits atomically with required audit and post-commit notifications.
6. The client presents the committed result or the rejection reason without exposing protected data.

## 8. Data & Invariants

- Persist or return only fields required for `Add Services and Equipment Rental to Booking` and the mapped BRs.
- Preserve authoritative identifiers, ownership links, timestamps, snapshots, status values, and audit references when they affect the business outcome.
- Derived counters, scores, release-gate metrics, and ledger amounts must be traceable to their source records and rule version.
- Do not invent tables, enum values, state machines, or audit stores solely for this story.

## 9. API / Integration Contract

Confirmed current API surface:

- `POST /bookings/:bookingId/items`
- `GET /bookings/:bookingId/items`
- `GET /equipment-catalog/for-trip/:tripId`

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
| PB AC | Approved backlog acceptance path for `Add Services and Equipment Rental to Booking` | Meets the acceptance summary above | E2E |
| BR-121 | Approved rule is satisfied for `Add Services and Equipment Rental to Booking` | Accepted and persisted or returned as applicable | Integration |
| BR-121 | Approved rule is violated for `Add Services and Equipment Rental to Booking` | Rejected with no partial side effects | Boundary / Integration |
| BR-122 | Approved rule is satisfied for `Add Services and Equipment Rental to Booking` | Accepted and persisted or returned as applicable | Integration |
| BR-122 | Approved rule is violated for `Add Services and Equipment Rental to Booking` | Rejected with no partial side effects | Boundary / Integration |
| BR-123 | Approved rule is satisfied for `Add Services and Equipment Rental to Booking` | Accepted and persisted or returned as applicable | Integration |
| BR-123 | Approved rule is violated for `Add Services and Equipment Rental to Booking` | Rejected with no partial side effects | Boundary / Integration |
| BR-127 | Approved rule is satisfied for `Add Services and Equipment Rental to Booking` | Accepted and persisted or returned as applicable | Integration |
| BR-127 | Approved rule is violated for `Add Services and Equipment Rental to Booking` | Rejected with no partial side effects | Boundary / Integration |
| BR-128 | Approved rule is satisfied for `Add Services and Equipment Rental to Booking` | Accepted and persisted or returned as applicable | Integration |
| BR-128 | Approved rule is violated for `Add Services and Equipment Rental to Booking` | Rejected with no partial side effects | Boundary / Integration |
| BR-129 | Approved rule is satisfied for `Add Services and Equipment Rental to Booking` | Accepted and persisted or returned as applicable | Integration |
| BR-129 | Approved rule is violated for `Add Services and Equipment Rental to Booking` | Rejected with no partial side effects | Boundary / Integration |
| BR-174 | Approved rule is satisfied for `Add Services and Equipment Rental to Booking` | Accepted and persisted or returned as applicable | Integration |
| BR-174 | Approved rule is violated for `Add Services and Equipment Rental to Booking` | Rejected with no partial side effects | Boundary / Integration |
| BR-175 | Approved rule is satisfied for `Add Services and Equipment Rental to Booking` | Accepted and persisted or returned as applicable | Integration |
| BR-175 | Approved rule is violated for `Add Services and Equipment Rental to Booking` | Rejected with no partial side effects | Boundary / Integration |
| Remaining mapped BRs | Each mapped BR has valid and violation coverage in the owning test suite | Coverage proves the rule is enforced | Unit / Integration / E2E |

## 12. Open Decisions & References

### 12.1 Open Decisions

None.

### 12.2 References

- Product Backlog v3.1.
- CTMS Business Rules workbook.
- CTMS Architecture Overview.
