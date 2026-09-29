# CTMS-006 — Manage Role-Based Access for Camper, Host, Porter, and Admin

## 1. Overview

Story: CTMS-006
Epic: EPIC 1. Authentication
Use Case: Manage Role-Based Access for Camper, Host, Porter, and Admin
Priority: Must Have

Goal:
Allow Admin to complete `Manage Role-Based Access for Camper, Host, Porter, and Admin` within the approved CTMS v3.1 scope.

Acceptance summary:
Backend APIs enforce role permissions, users cannot access functionality outside their role, and unauthorized actions return 403.

## 2. Scope

### In Scope

- Story-owned behavior for `Manage Role-Based Access for Camper, Host, Porter, and Admin`.
- Validation, authorization, state handling, persistence, audit, and observable errors required by the mapped Business Rules.
- Story-specific acceptance tests that prove both allowed and rejected paths.

### Out of Scope

- Behavior owned by dependency stories unless a mapped BR explicitly makes it part of this story.
- Implementation of dependency stories: CTMS-003.

## 3. Actors & Authorization

- Admin: primary business actor for this story.
- Backend API: authoritative enforcement point for permissions, state, and business rules.
- UI or client application: may guide the user, but must not replace backend enforcement.

Authorization must be concrete: the caller must have the role, ownership, assignment, or operational relationship required by the mapped BRs before any protected data is returned or any state-changing action is committed.

## 4. Preconditions & Dependencies

- Product Backlog v3.1 row `CTMS-006` is the story scope source.
- The mapped Primary BR IDs below exist in the latest Business Rules workbook.
- Required domain records already exist and are in states allowed by the mapped BRs.
- Dependencies:
- CTMS-003

## 5. Business Rules

| BR | Rule |
|---|---|
| BR-017 | Every protected endpoint or function must authenticate the actor and check backend authorization before reading or changing data. |
| BR-018 | Authorization must evaluate role, ownership, and the relevant business relationship together. Hidden UI buttons or routes are not authorization controls. |
| BR-019 | Authenticated requests from actors without the required role, ownership, or scope must return 403 unless a specific security policy requires otherwise. |
| BR-170 | Backend authorization is authoritative and must be checked on every protected operation. |
| BR-171 | Client-visible actions must not replace backend permission, account-status, and state validation. |
| BR-172 | Sensitive personal, health, payment, and location data may be accessed only by an authorized actor with a valid business relationship. |
| BR-173 | A user must not read or modify another user's protected data unless a specific role or workflow authorizes it. |
| BR-175 | Clients must not self-assert server-owned state, ownership, pricing, capacity, ledger, audit, or safety outcomes. |
| BR-191 | Critical actions must write an audit record containing actor, action, target, timestamp, before/after values or reason, and affected business identifiers. |
| BR-199 | APIs must return consistent error codes: 401 for authentication failure, 403 for missing permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-200 | Error messages must explain the problem and the user action needed, while never exposing stack traces, secrets, or resources the user is not allowed to view. |
| BR-211 | Operational, financial, safety, authorization, and administrative decisions must be traceable to the actor, source record, rule, and timestamp that produced them. |
| BR-212 | Any Business Rule, enum, state transition, or API contract change must update the spec, tests, and data documentation before the story is Done. |
| BR-213 | Every mapped Business Rule must have at least one valid-path test and one violation-path test; concurrency, idempotency, and transaction rules require integration or E2E coverage. |

## 6. State & Lifecycle

Relevant states from the approved rules: `fail`.

Do not introduce placeholder workflow states unless an owning domain contract explicitly defines them.

## 7. Business Flow

1. Admin initiates `Manage Role-Based Access for Camper, Host, Porter, and Admin` through the approved UI, API, scheduled job, or integration point.
2. The backend loads the required source records and verifies authorization, ownership or assignment, current state, and all mapped BR prerequisites.
3. The backend applies the story-owned decision logic from Section 5.
4. If any mapped rule is violated, the backend rejects the operation with no partial side effects and returns an actionable error.
5. If the action changes authoritative data, the change commits atomically with required audit and post-commit notifications.
6. The client presents the committed result or the rejection reason without exposing protected data.

## 8. Data & Invariants

- Persist or return only fields required for `Manage Role-Based Access for Camper, Host, Porter, and Admin` and the mapped BRs.
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
| PB AC | Approved backlog acceptance path for `Manage Role-Based Access for Camper, Host, Porter, and Admin` | Meets the acceptance summary above | E2E |
| BR-017 | Approved rule is satisfied for `Manage Role-Based Access for Camper, Host, Porter, and Admin` | Accepted and persisted or returned as applicable | Integration |
| BR-017 | Approved rule is violated for `Manage Role-Based Access for Camper, Host, Porter, and Admin` | Rejected with no partial side effects | Boundary / Integration |
| BR-018 | Approved rule is satisfied for `Manage Role-Based Access for Camper, Host, Porter, and Admin` | Accepted and persisted or returned as applicable | Integration |
| BR-018 | Approved rule is violated for `Manage Role-Based Access for Camper, Host, Porter, and Admin` | Rejected with no partial side effects | Boundary / Integration |
| BR-019 | Approved rule is satisfied for `Manage Role-Based Access for Camper, Host, Porter, and Admin` | Accepted and persisted or returned as applicable | Integration |
| BR-019 | Approved rule is violated for `Manage Role-Based Access for Camper, Host, Porter, and Admin` | Rejected with no partial side effects | Boundary / Integration |
| BR-170 | Approved rule is satisfied for `Manage Role-Based Access for Camper, Host, Porter, and Admin` | Accepted and persisted or returned as applicable | Integration |
| BR-170 | Approved rule is violated for `Manage Role-Based Access for Camper, Host, Porter, and Admin` | Rejected with no partial side effects | Boundary / Integration |
| BR-171 | Approved rule is satisfied for `Manage Role-Based Access for Camper, Host, Porter, and Admin` | Accepted and persisted or returned as applicable | Integration |
| BR-171 | Approved rule is violated for `Manage Role-Based Access for Camper, Host, Porter, and Admin` | Rejected with no partial side effects | Boundary / Integration |
| BR-172 | Approved rule is satisfied for `Manage Role-Based Access for Camper, Host, Porter, and Admin` | Accepted and persisted or returned as applicable | Integration |
| BR-172 | Approved rule is violated for `Manage Role-Based Access for Camper, Host, Porter, and Admin` | Rejected with no partial side effects | Boundary / Integration |
| BR-173 | Approved rule is satisfied for `Manage Role-Based Access for Camper, Host, Porter, and Admin` | Accepted and persisted or returned as applicable | Integration |
| BR-173 | Approved rule is violated for `Manage Role-Based Access for Camper, Host, Porter, and Admin` | Rejected with no partial side effects | Boundary / Integration |
| BR-175 | Approved rule is satisfied for `Manage Role-Based Access for Camper, Host, Porter, and Admin` | Accepted and persisted or returned as applicable | Integration |
| BR-175 | Approved rule is violated for `Manage Role-Based Access for Camper, Host, Porter, and Admin` | Rejected with no partial side effects | Boundary / Integration |
| Remaining mapped BRs | Each mapped BR has valid and violation coverage in the owning test suite | Coverage proves the rule is enforced | Unit / Integration / E2E |

## 12. Open Decisions & References

### 12.1 Open Decisions

None.

### 12.2 References

- Product Backlog v3.1.
- CTMS Business Rules workbook.
- CTMS Architecture Overview.
