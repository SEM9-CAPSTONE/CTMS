# CTMS-002 — Verify Account via OTP or Email

## 1. Overview

Story: CTMS-002
Epic: EPIC 1. Authentication
Use Case: Verify Account via OTP or Email
Priority: Must Have

Goal:
Allow Authenticated user to complete `Verify Account via OTP or Email` within the approved CTMS v3.1 scope.

Acceptance summary:
OTP verification must enforce expiry and resend limits, and must not activate an account with a wrong or expired OTP.

## 2. Scope

### In Scope

- Story-owned behavior for `Verify Account via OTP or Email`.
- Validation, authorization, state handling, persistence, audit, and observable errors required by the mapped Business Rules.
- Story-specific acceptance tests that prove both allowed and rejected paths.

### Out of Scope

- Behavior owned by dependency stories unless a mapped BR explicitly makes it part of this story.
- Implementation of dependency stories: CTMS-001.

## 3. Actors & Authorization

- Authenticated user: primary business actor for this story.
- Backend API: authoritative enforcement point for permissions, state, and business rules.
- UI or client application: may guide the user, but must not replace backend enforcement.

Authorization must be concrete: the caller must have the role, ownership, assignment, or operational relationship required by the mapped BRs before any protected data is returned or any state-changing action is committed.

## 4. Preconditions & Dependencies

- Product Backlog v3.1 row `CTMS-002` is the story scope source.
- The mapped Primary BR IDs below exist in the latest Business Rules workbook.
- Required domain records already exist and are in states allowed by the mapped BRs.
- Dependencies:
- CTMS-001

## 5. Business Rules

| BR | Rule |
|---|---|
| BR-006 | An OTP is valid only for the correct purpose and user, is not consumed, is not expired, and uses the configured system TTL. |
| BR-007 | OTP resend and verification attempts must enforce the configured rate limit and a maximum of four attempts. When the limit is exceeded, the backend must reject the request without creating unlimited OTPs. |
| BR-008 | Wrong, expired, consumed, or over-attempt OTPs must not activate the account. A valid OTP may be consumed only once. |
| BR-185 | Passwords, OTPs, access tokens, and refresh tokens must not be stored as plaintext, and logs or API responses must not expose these values. |
| BR-188 | Date and time handling must use the authoritative timezone and ordering rules for the business workflow, and invalid or impossible time ranges must be rejected. |
| BR-190 | Expired, consumed, revoked, superseded, or stale credentials, tokens, OTPs, packages, snapshots, or assignments must not be accepted. |
| BR-212 | Any Business Rule, enum, state transition, or API contract change must update the spec, tests, and data documentation before the story is Done. |
| BR-213 | Every mapped Business Rule must have at least one valid-path test and one violation-path test; concurrency, idempotency, and transaction rules require integration or E2E coverage. |

## 6. State & Lifecycle

Relevant states from the approved rules: `expired`, `pass`.

Do not introduce placeholder workflow states unless an owning domain contract explicitly defines them.

## 7. Business Flow

1. Authenticated user initiates `Verify Account via OTP or Email` through the approved UI, API, scheduled job, or integration point.
2. The backend loads the required source records and verifies authorization, ownership or assignment, current state, and all mapped BR prerequisites.
3. The backend applies the story-owned decision logic from Section 5.
4. If any mapped rule is violated, the backend rejects the operation with no partial side effects and returns an actionable error.
5. If the action changes authoritative data, the change commits atomically with required audit and post-commit notifications.
6. The client presents the committed result or the rejection reason without exposing protected data.

## 8. Data & Invariants

- Persist or return only fields required for `Verify Account via OTP or Email` and the mapped BRs.
- Preserve authoritative identifiers, ownership links, timestamps, snapshots, status values, and audit references when they affect the business outcome.
- Derived counters, scores, release-gate metrics, and ledger amounts must be traceable to their source records and rule version.
- Do not invent tables, enum values, state machines, or audit stores solely for this story.

## 9. API / Integration Contract

Confirmed current API surface:

- `POST /auth/verify`
- `POST /auth/send-otp`
- `POST /auth/resend`

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
| PB AC | Approved backlog acceptance path for `Verify Account via OTP or Email` | Meets the acceptance summary above | E2E |
| BR-006 | Approved rule is satisfied for `Verify Account via OTP or Email` | Accepted and persisted or returned as applicable | Integration |
| BR-006 | Approved rule is violated for `Verify Account via OTP or Email` | Rejected with no partial side effects | Boundary / Integration |
| BR-007 | Approved rule is satisfied for `Verify Account via OTP or Email` | Accepted and persisted or returned as applicable | Integration |
| BR-007 | Approved rule is violated for `Verify Account via OTP or Email` | Rejected with no partial side effects | Boundary / Integration |
| BR-008 | Approved rule is satisfied for `Verify Account via OTP or Email` | Accepted and persisted or returned as applicable | Integration |
| BR-008 | Approved rule is violated for `Verify Account via OTP or Email` | Rejected with no partial side effects | Boundary / Integration |
| BR-185 | Approved rule is satisfied for `Verify Account via OTP or Email` | Accepted and persisted or returned as applicable | Integration |
| BR-185 | Approved rule is violated for `Verify Account via OTP or Email` | Rejected with no partial side effects | Boundary / Integration |
| BR-188 | Approved rule is satisfied for `Verify Account via OTP or Email` | Accepted and persisted or returned as applicable | Integration |
| BR-188 | Approved rule is violated for `Verify Account via OTP or Email` | Rejected with no partial side effects | Boundary / Integration |
| BR-190 | Approved rule is satisfied for `Verify Account via OTP or Email` | Accepted and persisted or returned as applicable | Integration |
| BR-190 | Approved rule is violated for `Verify Account via OTP or Email` | Rejected with no partial side effects | Boundary / Integration |
| BR-212 | Approved rule is satisfied for `Verify Account via OTP or Email` | Accepted and persisted or returned as applicable | Integration |
| BR-212 | Approved rule is violated for `Verify Account via OTP or Email` | Rejected with no partial side effects | Boundary / Integration |
| BR-213 | Approved rule is satisfied for `Verify Account via OTP or Email` | Accepted and persisted or returned as applicable | Integration |
| BR-213 | Approved rule is violated for `Verify Account via OTP or Email` | Rejected with no partial side effects | Boundary / Integration |

## 12. Open Decisions & References

### 12.1 Open Decisions

None.

### 12.2 References

- Product Backlog v3.1.
- CTMS Business Rules workbook.
- CTMS Architecture Overview.
