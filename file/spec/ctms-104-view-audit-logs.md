# CTMS-104 — View Audit Logs

## 1. Overview

Story: CTMS-104

Epic: EPIC 18. Administration and Audit

Use Case: View Audit Logs

Priority: Must Have

Goal: Allow only authorized Admin to inspect immutable audit history using supported filters and pagination.

Backlog story: As an Admin, I want to view audit logs so I can investigate critical system actions.

Acceptance Criteria:

| Source  | Criterion                                            |
| ------- | ---------------------------------------------------- |
| PB AC-1 | Only authorized Admin may view audit logs.           |
| PB AC-2 | Filter by actor/user.                                |
| PB AC-3 | Filter by action.                                    |
| PB AC-4 | Filter by target.                                    |
| PB AC-5 | Filter by time range.                                |
| PB AC-6 | Results are paginated.                               |
| PB AC-7 | View functionality cannot edit/delete audit records. |

## 2. Scope

### In Scope

- Audit search/view.
- Filters.
- Pagination.

### Out of Scope

- Editing audit.
- Deleting audit.
- Creating arbitrary audit entries.

## 3. Actors & Authorization

Primary actor:

- Authorized Admin only.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-103.

Audit records exist.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-286     | Only an authorized Admin may view audit logs. The system must support filtering by actor/user, action, target, and time range, paginate results, and must not allow audit records to be edited or deleted through the log-viewing function. |
| BR-191     | Critical actions must be recorded in the audit log with actor, action, target, timestamp, and either before/after data or the reason for the change.                                                                                        |
| BR-192     | Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data.                                                                                                                                    |

## 6. State & Lifecycle

Read-only query:

audit store
→ authorization
→ filter
→ pagination
→ display.

## 7. Business Flow

1. Admin opens audit view.
2. Verify permission.
3. Select filters.
4. Query immutable audit records.
5. Apply pagination.
6. Display permitted audit data.

## 8. Data & Invariants

Audit view is read-only.

No view operation may mutate authoritative audit history.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                               | Expected Behavior      |
| ---------------------------------- | ---------------------- |
| Non-Admin                          | Reject                 |
| Invalid time range                 | Reject                 |
| No result                          | Empty page             |
| Large result                       | Paginate               |
| Edit/delete attempt through viewer | Not supported/rejected |

## 11. Acceptance & Test Matrix

| Source | Scenario          | Expected Result | Test Type   |
| ------ | ----------------- | --------------- | ----------- |
| BR-286 | Authorized Admin  | Logs visible    | Security    |
| BR-286 | Unauthorized user | Rejected        | Security    |
| BR-286 | Apply filters     | Correct subset  | Integration |
| BR-286 | Large dataset     | Paginated       | Functional  |
| BR-286 | Mutation attempt  | Rejected        | Integrity   |

## 12. Open Decisions

None.
