# CTMS-004 — Refresh Authentication Session

## 1. Overview

Story: CTMS-004
Epic: EPIC 1. Authentication
Use Case: Refresh Authentication Session
Priority: Must Have

Goal:
Allow Authenticated user to complete `Refresh Authentication Session` within the approved CTMS v3.1 scope.

Acceptance summary:
A valid refresh token creates a new access token; expired or revoked refresh tokens are rejected.

## 2. Scope

### In Scope

- Story-owned behavior for `Refresh Authentication Session`.
- Validation, authorization, state handling, persistence, audit, and observable errors required by the mapped Business Rules.
- Story-specific acceptance tests that prove both allowed and rejected paths.

### Out of Scope

- Behavior owned by dependency stories unless a mapped BR explicitly makes it part of this story.
- Implementation of dependency stories: CTMS-003.

## 3. Actors & Authorization

- Authenticated user: primary business actor for this story.
- Backend API: authoritative enforcement point for permissions, state, and business rules.
- UI or client application: may guide the user, but must not replace backend enforcement.

Authorization must be concrete: the caller must have the role, ownership, assignment, or operational relationship required by the mapped BRs before any protected data is returned or any state-changing action is committed.

## 4. Preconditions & Dependencies

- Product Backlog v3.1 row `CTMS-004` is the story scope source.
- The mapped Primary BR IDs below exist in the latest Business Rules workbook.
- Required domain records already exist and are in states allowed by the mapped BRs.
- Dependencies:
- CTMS-003

## 5. Business Rules

| BR | Rule |
|---|---|
| BR-012 | A refresh token may issue a new access token only when it is unexpired, not revoked, bound to the correct user/device, and passes rotation checks. Successful refresh must apply token rotation when configured. |
| BR-013 | Expired, revoked, mismatched, or rotation-replaced refresh tokens must be rejected and must not issue a new access token. |
| BR-170 | Backend authorization is authoritative and must be checked on every protected operation. |
| BR-171 | Client-visible actions must not replace backend permission, account-status, and state validation. |
| BR-185 | Passwords, OTPs, access tokens, and refresh tokens must not be stored as plaintext, and logs or API responses must not expose these values. |
| BR-188 | Date and time handling must use the authoritative timezone and ordering rules for the business workflow, and invalid or impossible time ranges must be rejected. |
| BR-190 | Expired, consumed, revoked, superseded, or stale credentials, tokens, OTPs, packages, snapshots, or assignments must not be accepted. |
| BR-212 | Any Business Rule, enum, state transition, or API contract change must update the spec, tests, and data documentation before the story is Done. |
| BR-213 | Every mapped Business Rule must have at least one valid-path test and one violation-path test; concurrency, idempotency, and transaction rules require integration or E2E coverage. |

## 6. State & Lifecycle

Relevant states from the approved rules: `expired`, `pass`.

Do not introduce placeholder workflow states unless an owning domain contract explicitly defines them.

## 7. Business Flow

1. Authenticated user initiates `Refresh Authentication Session` through the approved UI, API, scheduled job, or integration point.
2. The backend loads the required source records and verifies authorization, ownership or assignment, current state, and all mapped BR prerequisites.
3. The backend applies the story-owned decision logic from Section 5.
4. If any mapped rule is violated, the backend rejects the operation with no partial side effects and returns an actionable error.
5. If the action changes authoritative data, the change commits atomically with required audit and post-commit notifications.
6. The client presents the committed result or the rejection reason without exposing protected data.

## 8. Data & Invariants

- Persist or return only fields required for `Refresh Authentication Session` and the mapped BRs.
- Preserve authoritative identifiers, ownership links, timestamps, snapshots, status values, and audit references when they affect the business outcome.
- Derived counters, scores, release-gate metrics, and ledger amounts must be traceable to their source records and rule version.
- Do not invent tables, enum values, state machines, or audit stores solely for this story.

## 9. API / Integration Contract

Confirmed current API surface:

- `POST /auth/refresh`

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
| PB AC | Approved backlog acceptance path for `Refresh Authentication Session` | Meets the acceptance summary above | E2E |
| BR-012 | Approved rule is satisfied for `Refresh Authentication Session` | Accepted and persisted or returned as applicable | Integration |
| BR-012 | Approved rule is violated for `Refresh Authentication Session` | Rejected with no partial side effects | Boundary / Integration |
| BR-013 | Approved rule is satisfied for `Refresh Authentication Session` | Accepted and persisted or returned as applicable | Integration |
| BR-013 | Approved rule is violated for `Refresh Authentication Session` | Rejected with no partial side effects | Boundary / Integration |
| BR-170 | Approved rule is satisfied for `Refresh Authentication Session` | Accepted and persisted or returned as applicable | Integration |
| BR-170 | Approved rule is violated for `Refresh Authentication Session` | Rejected with no partial side effects | Boundary / Integration |
| BR-171 | Approved rule is satisfied for `Refresh Authentication Session` | Accepted and persisted or returned as applicable | Integration |
| BR-171 | Approved rule is violated for `Refresh Authentication Session` | Rejected with no partial side effects | Boundary / Integration |
| BR-185 | Approved rule is satisfied for `Refresh Authentication Session` | Accepted and persisted or returned as applicable | Integration |
| BR-185 | Approved rule is violated for `Refresh Authentication Session` | Rejected with no partial side effects | Boundary / Integration |
| BR-188 | Approved rule is satisfied for `Refresh Authentication Session` | Accepted and persisted or returned as applicable | Integration |
| BR-188 | Approved rule is violated for `Refresh Authentication Session` | Rejected with no partial side effects | Boundary / Integration |
| BR-190 | Approved rule is satisfied for `Refresh Authentication Session` | Accepted and persisted or returned as applicable | Integration |
| BR-190 | Approved rule is violated for `Refresh Authentication Session` | Rejected with no partial side effects | Boundary / Integration |
| BR-212 | Approved rule is satisfied for `Refresh Authentication Session` | Accepted and persisted or returned as applicable | Integration |
| BR-212 | Approved rule is violated for `Refresh Authentication Session` | Rejected with no partial side effects | Boundary / Integration |
| Remaining mapped BRs | Each mapped BR has valid and violation coverage in the owning test suite | Coverage proves the rule is enforced | Unit / Integration / E2E |

## 12. Open Decisions & References

### 12.1 Open Decisions

None.

### 12.2 References

- Product Backlog v3.1.
- CTMS Business Rules workbook.
- CTMS Architecture Overview.
