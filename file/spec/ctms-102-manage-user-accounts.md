# CTMS-102 — Manage User Accounts

## 1. Overview

Story: CTMS-102

Epic: EPIC 18. Administration and Audit

Use Case: Manage User Accounts

Priority: Must Have

Goal: Allow authorized Admin to search, view, lock, and unlock user accounts without deleting referenced business history.

Backlog story: As an Admin, I want to manage user accounts so access can be controlled while business records remain intact.

Acceptance Criteria:

| Source  | Criterion                                         |
| ------- | ------------------------------------------------- |
| PB AC-1 | Authorized Admin may search user accounts.        |
| PB AC-2 | Authorized Admin may view user accounts.          |
| PB AC-3 | Authorized Admin may lock an account.             |
| PB AC-4 | Authorized Admin may unlock an account.           |
| PB AC-5 | Related business data is preserved.               |
| PB AC-6 | Referenced user records must not be hard-deleted. |

## 2. Scope

### In Scope

- Search.
- View.
- Lock.
- Unlock.
- Audit of critical account actions.

### Out of Scope

- Hard deletion of referenced users.
- Editing unrelated business records.

## 3. Actors & Authorization

Primary actor:

- Authorized Admin.

## 4. Preconditions & Dependencies

Target user exists.

Admin has account-management permission.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                            |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-284 | An authorized Admin may search, view, lock, and unlock user accounts. Account management must preserve related business data and must not hard-delete a referenced user record. |
| BR-191 | Critical actions must be recorded in the audit log with actor, action, target, timestamp, and either before/after data or the reason for the change.                            |
| BR-192 | Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data.                                                                        |

## 6. State & Lifecycle

Applicable access lifecycle:

`active ↔ locked`

Locking does not delete the user or related business history.

## 7. Business Flow

1. Admin searches account.
2. System checks authorization.
3. Admin views account.
4. Admin requests lock/unlock.
5. Backend validates current state.
6. Apply state transition.
7. Preserve related records.
8. Audit action.

## 8. Data & Invariants

User identity remains stable.

Lock/unlock must not cascade-delete Booking, Trip, review, financial, or audit history.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                 | Expected Behavior |
| -------------------- | ----------------- |
| Unauthorized actor   | Reject            |
| Lock active user     | Lock              |
| Unlock locked user   | Unlock            |
| Repeated same action | No corrupt state  |
| Referenced user      | No hard delete    |

## 11. Acceptance & Test Matrix

| Source | Scenario        | Expected Result  | Test Type   |
| ------ | --------------- | ---------------- | ----------- |
| BR-284 | Search account  | Results returned | Functional  |
| BR-284 | Lock account    | Account locked   | Integration |
| BR-284 | Unlock          | Account active   | Integration |
| BR-284 | Referenced data | Preserved        | Data        |
| BR-191 | Lock/unlock     | Audited          | Audit       |

## 12. Open Decisions

None.
