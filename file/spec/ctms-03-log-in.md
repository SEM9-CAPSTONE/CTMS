# CTMS-003 — Log In

## 1. Overview

Story: CTMS-003
Epic: EPIC 1. Authentication
Use Case: Log In
Priority: Must Have

Goal:
Allow Authenticated user to complete `Log In` within the approved CTMS v3.1 scope.

Acceptance summary:
Valid login returns access and refresh tokens; invalid login returns an appropriate error; locked accounts cannot log in.

## 2. Scope

### In Scope

- Story-owned behavior for `Log In`.
- Validation, authorization, state handling, persistence, audit, and observable errors required by the mapped Business Rules.
- Story-specific acceptance tests that prove both allowed and rejected paths.

### Out of Scope

- Behavior owned by dependency stories unless a mapped BR explicitly makes it part of this story.
- Implementation of dependency stories: CTMS-002.

## 3. Actors & Authorization

- Authenticated user: primary business actor for this story.
- Backend API: authoritative enforcement point for permissions, state, and business rules.
- UI or client application: may guide the user, but must not replace backend enforcement.

Authorization must be concrete: the caller must have the role, ownership, assignment, or operational relationship required by the mapped BRs before any protected data is returned or any state-changing action is committed.

## 4. Preconditions & Dependencies

- Product Backlog v3.1 row `CTMS-003` is the story scope source.
- The mapped Primary BR IDs below exist in the latest Business Rules workbook.
- Required domain records already exist and are in states allowed by the mapped BRs.
- Dependencies:
- CTMS-002

## 5. Business Rules

| BR | Rule |
|---|---|
| BR-009 | Login succeeds only with valid credentials and `user.status = active`. A successful login must issue an access token and a refresh token bound to the corresponding session or device. |
| BR-010 | Failed login must not create a refresh token, session, or business side effect, and the response must not reveal whether an email or phone exists in the system. |
| BR-011 | Users with `pending_verification`, `suspended`, or `deleted` status must be rejected when creating a new authentication session, except for approved verification or recovery flows. |
| BR-170 | Backend authorization is authoritative and must be checked on every protected operation. |
| BR-171 | Client-visible actions must not replace backend permission, account-status, and state validation. |
| BR-185 | Passwords, OTPs, access tokens, and refresh tokens must not be stored as plaintext, and logs or API responses must not expose these values. |
| BR-199 | APIs must return consistent error codes: 401 for authentication failure, 403 for missing permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-200 | Error messages must explain the problem and the user action needed, while never exposing stack traces, secrets, or resources the user is not allowed to view. |
| BR-212 | Any Business Rule, enum, state transition, or API contract change must update the spec, tests, and data documentation before the story is Done. |
| BR-213 | Every mapped Business Rule must have at least one valid-path test and one violation-path test; concurrency, idempotency, and transaction rules require integration or E2E coverage. |

## 6. State & Lifecycle

Relevant states from the approved rules: `pending_verification`, `active`, `suspended`, `pass`, `fail`.

Do not introduce placeholder workflow states unless an owning domain contract explicitly defines them.

## 7. Business Flow

1. Authenticated user initiates `Log In` through the approved UI, API, scheduled job, or integration point.
2. The backend loads the required source records and verifies authorization, ownership or assignment, current state, and all mapped BR prerequisites.
3. The backend applies the story-owned decision logic from Section 5.
4. If any mapped rule is violated, the backend rejects the operation with no partial side effects and returns an actionable error.
5. If the action changes authoritative data, the change commits atomically with required audit and post-commit notifications.
6. The client presents the committed result or the rejection reason without exposing protected data.

## 8. Data & Invariants

- Persist or return only fields required for `Log In` and the mapped BRs.
- Preserve authoritative identifiers, ownership links, timestamps, snapshots, status values, and audit references when they affect the business outcome.
- Derived counters, scores, release-gate metrics, and ledger amounts must be traceable to their source records and rule version.
- Do not invent tables, enum values, state machines, or audit stores solely for this story.

## 9. API / Integration Contract

Confirmed current API surface:

- `POST /auth/login`

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
| PB AC | Approved backlog acceptance path for `Log In` | Meets the acceptance summary above | E2E |
| BR-009 | Approved rule is satisfied for `Log In` | Accepted and persisted or returned as applicable | Integration |
| BR-009 | Approved rule is violated for `Log In` | Rejected with no partial side effects | Boundary / Integration |
| BR-010 | Approved rule is satisfied for `Log In` | Accepted and persisted or returned as applicable | Integration |
| BR-010 | Approved rule is violated for `Log In` | Rejected with no partial side effects | Boundary / Integration |
| BR-011 | Approved rule is satisfied for `Log In` | Accepted and persisted or returned as applicable | Integration |
| BR-011 | Approved rule is violated for `Log In` | Rejected with no partial side effects | Boundary / Integration |
| BR-170 | Approved rule is satisfied for `Log In` | Accepted and persisted or returned as applicable | Integration |
| BR-170 | Approved rule is violated for `Log In` | Rejected with no partial side effects | Boundary / Integration |
| BR-171 | Approved rule is satisfied for `Log In` | Accepted and persisted or returned as applicable | Integration |
| BR-171 | Approved rule is violated for `Log In` | Rejected with no partial side effects | Boundary / Integration |
| BR-185 | Approved rule is satisfied for `Log In` | Accepted and persisted or returned as applicable | Integration |
| BR-185 | Approved rule is violated for `Log In` | Rejected with no partial side effects | Boundary / Integration |
| BR-199 | Approved rule is satisfied for `Log In` | Accepted and persisted or returned as applicable | Integration |
| BR-199 | Approved rule is violated for `Log In` | Rejected with no partial side effects | Boundary / Integration |
| BR-200 | Approved rule is satisfied for `Log In` | Accepted and persisted or returned as applicable | Integration |
| BR-200 | Approved rule is violated for `Log In` | Rejected with no partial side effects | Boundary / Integration |
| Remaining mapped BRs | Each mapped BR has valid and violation coverage in the owning test suite | Coverage proves the rule is enforced | Unit / Integration / E2E |

## 12. Open Decisions & References

### 12.1 Open Decisions

None.

### 12.2 References

- Product Backlog v3.1.
- CTMS Business Rules workbook.
- CTMS Architecture Overview.
