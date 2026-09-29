# CTMS-007 — Update Personal Profile and Emergency Contact

## 1. Overview

Story: CTMS-007
Epic: EPIC 1. Authentication
Use Case: Update Personal Profile and Emergency Contact
Priority: Must Have

Goal:
Allow Authenticated user to complete `Update Personal Profile and Emergency Contact` within the approved CTMS v3.1 scope.

Acceptance summary:
Valid profile and emergency-contact updates are saved, and access to sensitive data is permission-checked.

## 2. Scope

### In Scope

- Story-owned behavior for `Update Personal Profile and Emergency Contact`.
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

- Product Backlog v3.1 row `CTMS-007` is the story scope source.
- The mapped Primary BR IDs below exist in the latest Business Rules workbook.
- Required domain records already exist and are in states allowed by the mapped BRs.
- Dependencies:
- CTMS-003

## 5. Business Rules

| BR | Rule |
|---|---|
| BR-020 | A user may update only allowed profile fields. The backend must validate submitted data and update `updated_at` only after a successful update. |
| BR-021 | `emergency_contacts` may contain at most two contacts. Each contact must include name, phone, relationship, and `is_primary`; at most one contact may be primary. |
| BR-022 | Sensitive personal data must be returned only on a minimum-necessary basis for the correct actor and business relationship; APIs must not return the full profile when a subset is enough. |
| BR-170 | Backend authorization is authoritative and must be checked on every protected operation. |
| BR-171 | Client-visible actions must not replace backend permission, account-status, and state validation. |
| BR-172 | Sensitive personal, health, payment, and location data may be accessed only by an authorized actor with a valid business relationship. |
| BR-173 | A user must not read or modify another user's protected data unless a specific role or workflow authorizes it. |
| BR-174 | Inputs must be validated for required fields, formats, identifiers, enum values, and cross-entity references before any write is committed. |
| BR-184 | Email must be normalized before comparison and storage. Phone numbers must be normalized to one consistent format, preferably E.164. |
| BR-186 | Sensitive payloads must be minimized in responses, logs, audit records, analytics, and notifications. |
| BR-212 | Any Business Rule, enum, state transition, or API contract change must update the spec, tests, and data documentation before the story is Done. |
| BR-213 | Every mapped Business Rule must have at least one valid-path test and one violation-path test; concurrency, idempotency, and transaction rules require integration or E2E coverage. |

## 6. State & Lifecycle

No new lifecycle is defined by this story. Existing entity states from the owning domain remain authoritative.

Do not introduce placeholder workflow states unless an owning domain contract explicitly defines them.

## 7. Business Flow

1. Authenticated user initiates `Update Personal Profile and Emergency Contact` through the approved UI, API, scheduled job, or integration point.
2. The backend loads the required source records and verifies authorization, ownership or assignment, current state, and all mapped BR prerequisites.
3. The backend applies the story-owned decision logic from Section 5.
4. If any mapped rule is violated, the backend rejects the operation with no partial side effects and returns an actionable error.
5. If the action changes authoritative data, the change commits atomically with required audit and post-commit notifications.
6. The client presents the committed result or the rejection reason without exposing protected data.

## 8. Data & Invariants

- Persist or return only fields required for `Update Personal Profile and Emergency Contact` and the mapped BRs.
- Preserve authoritative identifiers, ownership links, timestamps, snapshots, status values, and audit references when they affect the business outcome.
- Derived counters, scores, release-gate metrics, and ledger amounts must be traceable to their source records and rule version.
- Do not invent tables, enum values, state machines, or audit stores solely for this story.

## 9. API / Integration Contract

Confirmed current API surface:

- `GET /profiles/me`
- `PATCH /profiles/me`

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
| PB AC | Approved backlog acceptance path for `Update Personal Profile and Emergency Contact` | Meets the acceptance summary above | E2E |
| BR-020 | Approved rule is satisfied for `Update Personal Profile and Emergency Contact` | Accepted and persisted or returned as applicable | Integration |
| BR-020 | Approved rule is violated for `Update Personal Profile and Emergency Contact` | Rejected with no partial side effects | Boundary / Integration |
| BR-021 | Approved rule is satisfied for `Update Personal Profile and Emergency Contact` | Accepted and persisted or returned as applicable | Integration |
| BR-021 | Approved rule is violated for `Update Personal Profile and Emergency Contact` | Rejected with no partial side effects | Boundary / Integration |
| BR-022 | Approved rule is satisfied for `Update Personal Profile and Emergency Contact` | Accepted and persisted or returned as applicable | Integration |
| BR-022 | Approved rule is violated for `Update Personal Profile and Emergency Contact` | Rejected with no partial side effects | Boundary / Integration |
| BR-170 | Approved rule is satisfied for `Update Personal Profile and Emergency Contact` | Accepted and persisted or returned as applicable | Integration |
| BR-170 | Approved rule is violated for `Update Personal Profile and Emergency Contact` | Rejected with no partial side effects | Boundary / Integration |
| BR-171 | Approved rule is satisfied for `Update Personal Profile and Emergency Contact` | Accepted and persisted or returned as applicable | Integration |
| BR-171 | Approved rule is violated for `Update Personal Profile and Emergency Contact` | Rejected with no partial side effects | Boundary / Integration |
| BR-172 | Approved rule is satisfied for `Update Personal Profile and Emergency Contact` | Accepted and persisted or returned as applicable | Integration |
| BR-172 | Approved rule is violated for `Update Personal Profile and Emergency Contact` | Rejected with no partial side effects | Boundary / Integration |
| BR-173 | Approved rule is satisfied for `Update Personal Profile and Emergency Contact` | Accepted and persisted or returned as applicable | Integration |
| BR-173 | Approved rule is violated for `Update Personal Profile and Emergency Contact` | Rejected with no partial side effects | Boundary / Integration |
| BR-174 | Approved rule is satisfied for `Update Personal Profile and Emergency Contact` | Accepted and persisted or returned as applicable | Integration |
| BR-174 | Approved rule is violated for `Update Personal Profile and Emergency Contact` | Rejected with no partial side effects | Boundary / Integration |
| Remaining mapped BRs | Each mapped BR has valid and violation coverage in the owning test suite | Coverage proves the rule is enforced | Unit / Integration / E2E |

## 12. Open Decisions & References

### 12.1 Open Decisions

None.

### 12.2 References

- Product Backlog v3.1.
- CTMS Business Rules workbook.
- CTMS Architecture Overview.
