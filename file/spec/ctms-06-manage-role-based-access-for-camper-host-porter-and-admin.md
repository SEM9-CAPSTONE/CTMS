# CTMS-006 — Manage Role-Based Access for Camper, Host, Porter, and Admin

## 1. Overview

Story: CTMS-006

Epic: EPIC 1. Authentication

Use Case: Manage Role-Based Access

Priority: Must Have

Goal: Enforce backend authorization for Camper, Host, Porter, and Admin using role, ownership, and business scope.

Backlog story:
As the System, I want to enforce role-based access so CTMS data and actions are available only to authorized actors.

Acceptance Criteria:

| Source  | Criterion                                                                              |
| ------- | -------------------------------------------------------------------------------------- |
| PB AC-1 | Protected functions authenticate the actor and enforce applicable authorization rules. |
| PB AC-2 | Unauthorized actors cannot produce a successful protected business outcome.            |
| PB AC-3 | Role, ownership, and business scope are evaluated by the backend.                      |
| PB AC-4 | UI visibility is not treated as an authorization control.                              |

## 2. Scope

### In Scope

- Backend authentication boundary.
- Role authorization.
- Ownership authorization.
- Business-scope authorization.
- Minimum-necessary sensitive-data access.
- Prevent side effects after authorization failure.

### Out of Scope

- Defining every individual feature's business eligibility.
- Authentication credential issuance.
- UI navigation design.

## 3. Actors & Authorization

Actors:

- Camper
- Host
- Porter
- Admin

Authorization must combine the applicable:

- Role.
- Ownership.
- Business relationship.
- Resource scope.

A role alone does not automatically authorize every resource.

## 4. Preconditions & Dependencies

Dependencies: CTMS-003.

Protected workflows require an authenticated actor unless the specific endpoint is explicitly public.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-017 | Every protected endpoint or function must authenticate the caller and enforce authorization on the backend before reading or modifying data.                                                                                                                             |
| BR-018 | Authorization must evaluate role, ownership, and the relevant business relationship together. Hiding a button or route in the UI does not constitute access control.                                                                                                     |
| BR-019 | An authenticated request whose actor lacks the required role, ownership, or scope must return HTTP 403. The system must not use 404 or 422 to mask authorization failures unless a defined security policy explicitly requires otherwise.                                |
| BR-172 | Access control must be enforced by the backend using role, ownership, and business scope. Hiding or disabling functionality in the UI is not a substitute for backend authorization.                                                                                     |
| BR-173 | A user may view or modify only data they own unless the user's role and business relationship explicitly authorize access to another user's data.                                                                                                                        |
| BR-175 | The backend is the authoritative source for authorization, state, pricing, capacity, inventory, risk level, and transaction outcome. The client must not establish these values authoritatively.                                                                         |
| BR-191 | Critical actions must be recorded in the audit log with actor, action, target, timestamp, and either before/after data or the reason for the change.                                                                                                                     |
| BR-199 | APIs must use consistent error semantics: 401 for authentication failures, 403 for insufficient authorization, 404 for not found, 409 for business conflicts, and 422 for invalid input.                                                                                 |
| BR-200 | Error messages must clearly describe the problem and the user action required, while never exposing stack traces, secrets, or resources the user is not authorized to see.                                                                                               |
| BR-211 | Any request rejected for authorization failure or an unmet business precondition must terminate before any state-changing commit and must not create side effects such as data updates, capacity holds, charges/refunds, notifications, or false business audit records. |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                    |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                             |

## 6. State & Lifecycle

Authenticated + authorized
→ protected workflow may continue.

Unauthenticated
→ authentication failure.

Authenticated + unauthorized
→ authorization failure
→ no protected state change.

## 7. Business Flow

1. Protected request reaches backend.
2. System authenticates actor.
3. System resolves target resource.
4. System evaluates required role.
5. System evaluates ownership/business relationship/scope.
6. If unauthorized, request stops before state-changing side effects.
7. If authorized, request proceeds to feature-specific business validation.
8. Critical actions are audited where required.

## 8. Data & Invariants

- UI visibility does not grant permission.
- Role alone does not override ownership/business scope.
- Unauthorized request cannot mutate protected state.
- Unauthorized request cannot trigger charge/refund/notification or false business audit.
- Sensitive data must be minimized.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                      | Expected Behavior                            |
| ----------------------------------------- | -------------------------------------------- |
| Unauthenticated protected request         | Reject according to authentication contract. |
| Correct role, wrong ownership             | Reject.                                      |
| Correct role, wrong business scope        | Reject.                                      |
| UI manually bypassed/direct API call      | Backend still rejects unauthorized action.   |
| Unauthorized access to sensitive data     | Data not returned.                           |
| Authorization fails during write workflow | No state-changing commit/side effect.        |

## 11. Acceptance & Test Matrix

| Source  | Scenario                                 | Expected Result                       | Test Type   |
| ------- | ---------------------------------------- | ------------------------------------- | ----------- |
| BR-017  | Unauthenticated protected API            | Rejected.                             | Security    |
| BR-018  | Correct role, wrong ownership            | Rejected.                             | Integration |
| BR-019  | Authenticated but unauthorized           | Authorization failure.                | Integration |
| BR-173  | Sensitive-data response                  | Only required fields returned.        | Security    |
| BR-211  | Unauthorized state-changing request      | No persistence/side effect.           | E2E         |
| PB AC-4 | Invoke hidden UI action directly via API | Backend authorization still enforced. | Security    |

## 12. Open Decisions

None.
