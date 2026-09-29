# CTMS-001 — Register with Email or Phone Number

## 1. Overview

Story: CTMS-001
Epic: EPIC 1. Authentication
Use Case: Register with Email or Phone Number
Priority: Must Have

Goal:
Allow Camper to complete `Register with Email or Phone Number` within the approved CTMS v3.1 scope.

Acceptance summary:
Reject duplicate email or phone values, validate formats, hash the password, and create the account only when submitted data is valid.

## 2. Scope

### In Scope

- Story-owned behavior for `Register with Email or Phone Number`.
- Validation, authorization, state handling, persistence, audit, and observable errors required by the mapped Business Rules.
- Story-specific acceptance tests that prove both allowed and rejected paths.

### Out of Scope

- Behavior owned by dependency stories unless a mapped BR explicitly makes it part of this story.

## 3. Actors & Authorization

- Camper: primary business actor for this story.
- Backend API: authoritative enforcement point for permissions, state, and business rules.
- UI or client application: may guide the user, but must not replace backend enforcement.

Authorization must be concrete: the caller must have the role, ownership, assignment, or operational relationship required by the mapped BRs before any protected data is returned or any state-changing action is committed.

## 4. Preconditions & Dependencies

- Product Backlog v3.1 row `CTMS-001` is the story scope source.
- The mapped Primary BR IDs below exist in the latest Business Rules workbook.
- Required domain records already exist and are in states allowed by the mapped BRs.
- Dependencies:
None.

## 5. Business Rules

| BR | Rule |
|---|---|
| BR-001 | After normalizing email or phone number, the system must not create an account when the email or phone number already belongs to a non-deleted user. Uniqueness must be checked by the backend and protected by a database unique constraint or index. |
| BR-002 | Email registration must trim and lowercase the email before comparison or storage, reject whitespace, require exactly one at-sign, require a valid local part and domain, and keep total length at or below 254 characters. |
| BR-003 | Vietnam phone registration must accept only a 10-digit mobile number starting with 03, 05, 07, 08, or 09, or the equivalent +84 format. The backend must normalize the value to E.164 before comparison or storage. |
| BR-004 | Passwords must never be stored in plaintext. The backend must hash passwords with a salted configurable password-hashing algorithm before persistence, and must not write raw passwords to logs, audit logs, or API responses. |
| BR-005 | Registration succeeds only when at least one of email or phone is provided, every submitted field is valid, uniqueness checks pass, and the user creation transaction completes. The new account remains `pending_verification` until verification is completed. |
| BR-174 | Inputs must be validated for required fields, formats, identifiers, enum values, and cross-entity references before any write is committed. |
| BR-184 | Email must be normalized before comparison and storage. Phone numbers must be normalized to one consistent format, preferably E.164. |
| BR-185 | Passwords, OTPs, access tokens, and refresh tokens must not be stored as plaintext, and logs or API responses must not expose these values. |
| BR-199 | APIs must return consistent error codes: 401 for authentication failure, 403 for missing permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-200 | Error messages must explain the problem and the user action needed, while never exposing stack traces, secrets, or resources the user is not allowed to view. |
| BR-212 | Any Business Rule, enum, state transition, or API contract change must update the spec, tests, and data documentation before the story is Done. |
| BR-213 | Every mapped Business Rule must have at least one valid-path test and one violation-path test; concurrency, idempotency, and transaction rules require integration or E2E coverage. |

## 6. State & Lifecycle

Relevant states from the approved rules: `pending_verification`, `completed`, `pass`, `fail`.

Do not introduce placeholder workflow states unless an owning domain contract explicitly defines them.

## 7. Business Flow

1. Camper initiates `Register with Email or Phone Number` through the approved UI, API, scheduled job, or integration point.
2. The backend loads the required source records and verifies authorization, ownership or assignment, current state, and all mapped BR prerequisites.
3. The backend applies the story-owned decision logic from Section 5.
4. If any mapped rule is violated, the backend rejects the operation with no partial side effects and returns an actionable error.
5. If the action changes authoritative data, the change commits atomically with required audit and post-commit notifications.
6. The client presents the committed result or the rejection reason without exposing protected data.

## 8. Data & Invariants

- Persist or return only fields required for `Register with Email or Phone Number` and the mapped BRs.
- Preserve authoritative identifiers, ownership links, timestamps, snapshots, status values, and audit references when they affect the business outcome.
- Derived counters, scores, release-gate metrics, and ledger amounts must be traceable to their source records and rule version.
- Do not invent tables, enum values, state machines, or audit stores solely for this story.

## 9. API / Integration Contract

Confirmed current API surface:

- `POST /auth/register`

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
| PB AC | Approved backlog acceptance path for `Register with Email or Phone Number` | Meets the acceptance summary above | E2E |
| BR-001 | Approved rule is satisfied for `Register with Email or Phone Number` | Accepted and persisted or returned as applicable | Integration |
| BR-001 | Approved rule is violated for `Register with Email or Phone Number` | Rejected with no partial side effects | Boundary / Integration |
| BR-002 | Approved rule is satisfied for `Register with Email or Phone Number` | Accepted and persisted or returned as applicable | Integration |
| BR-002 | Approved rule is violated for `Register with Email or Phone Number` | Rejected with no partial side effects | Boundary / Integration |
| BR-003 | Approved rule is satisfied for `Register with Email or Phone Number` | Accepted and persisted or returned as applicable | Integration |
| BR-003 | Approved rule is violated for `Register with Email or Phone Number` | Rejected with no partial side effects | Boundary / Integration |
| BR-004 | Approved rule is satisfied for `Register with Email or Phone Number` | Accepted and persisted or returned as applicable | Integration |
| BR-004 | Approved rule is violated for `Register with Email or Phone Number` | Rejected with no partial side effects | Boundary / Integration |
| BR-005 | Approved rule is satisfied for `Register with Email or Phone Number` | Accepted and persisted or returned as applicable | Integration |
| BR-005 | Approved rule is violated for `Register with Email or Phone Number` | Rejected with no partial side effects | Boundary / Integration |
| BR-174 | Approved rule is satisfied for `Register with Email or Phone Number` | Accepted and persisted or returned as applicable | Integration |
| BR-174 | Approved rule is violated for `Register with Email or Phone Number` | Rejected with no partial side effects | Boundary / Integration |
| BR-184 | Approved rule is satisfied for `Register with Email or Phone Number` | Accepted and persisted or returned as applicable | Integration |
| BR-184 | Approved rule is violated for `Register with Email or Phone Number` | Rejected with no partial side effects | Boundary / Integration |
| BR-185 | Approved rule is satisfied for `Register with Email or Phone Number` | Accepted and persisted or returned as applicable | Integration |
| BR-185 | Approved rule is violated for `Register with Email or Phone Number` | Rejected with no partial side effects | Boundary / Integration |
| Remaining mapped BRs | Each mapped BR has valid and violation coverage in the owning test suite | Coverage proves the rule is enforced | Unit / Integration / E2E |

## 12. Open Decisions & References

### 12.1 Open Decisions

None.

### 12.2 References

- Product Backlog v3.1.
- CTMS Business Rules workbook.
- CTMS Architecture Overview.
