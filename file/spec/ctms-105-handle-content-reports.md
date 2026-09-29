# CTMS-105 — Handle Content Reports

## 1. Overview

Story: CTMS-105

Epic: EPIC 18. Administration and Audit

Use Case: Handle Content Reports

Priority: Must Have

Goal: Allow authorized Admin to review and resolve content reports through the approved moderation lifecycle while preserving report and audit history.

Backlog story: As an Admin, I want to handle content reports so reported content can be reviewed and resolved consistently.

Acceptance Criteria:

| Source  | Criterion                                                                 |
| ------- | ------------------------------------------------------------------------- |
| PB AC-1 | Admin can view reporter.                                                  |
| PB AC-2 | Admin can view target type/ID.                                            |
| PB AC-3 | Admin can view reason.                                                    |
| PB AC-4 | Admin can view report status.                                             |
| PB AC-5 | Only valid `Pending/Reviewing/Actioned/Rejected` transitions are allowed. |
| PB AC-6 | Moderation decisions are audited.                                         |
| PB AC-7 | Report/review history is not hard-deleted during moderation.              |

## 2. Scope

### In Scope

- Report review.
- Moderation status.
- Valid transitions.
- Audit.

### Out of Scope

- Report creation — CTMS-094.
- Hard deletion of report history.

## 3. Actors & Authorization

Primary actor:

- Authorized Admin.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-094.

A content report exists.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-287     | Admin moderation must display reporter, target type/ID, reason, and status; only valid Pending/Reviewing/Actioned/Rejected transitions are allowed, and every moderation decision must be audited. |
| BR-306     | A reported review must be handled through the moderation policy. Review history and audit records must not be hard-deleted during content handling.                                                |
| BR-191     | Critical actions must be recorded in the audit log with actor, action, target, timestamp, and either before/after data or the reason for the change.                                               |
| BR-192     | Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data.                                                                                           |

## 6. State & Lifecycle

Supported moderation states:

`Pending`
→ `Reviewing`
→ `Actioned`

or

`Pending/Reviewing`
→ `Rejected`

Only authoritative valid transitions are allowed.

## 7. Business Flow

1. Admin opens moderation queue.
2. Verify permission.
3. Review reporter, target, reason and status.
4. Move report through valid moderation state.
5. Record moderation decision.
6. Preserve report/content history as required.
7. Audit decision.

## 8. Data & Invariants

Moderation preserves:

- reporter;
- target;
- reason;
- status;
- decision history.

No moderation operation silently destroys required history.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                     | Expected Behavior       |
| ------------------------ | ----------------------- |
| Unauthorized Admin       | Reject                  |
| Valid transition         | Accept                  |
| Invalid transition       | Reject                  |
| Reported review actioned | Apply moderation policy |
| Historical evidence      | Preserve                |

## 11. Acceptance & Test Matrix

| Source | Scenario             | Expected Result  | Test Type |
| ------ | -------------------- | ---------------- | --------- |
| BR-287 | Pending → Reviewing  | Accepted         | State     |
| BR-287 | Reviewing → Actioned | Accepted         | State     |
| BR-287 | Invalid transition   | Rejected         | Negative  |
| BR-306 | Moderated review     | History retained | Audit     |
| BR-287 | Decision             | Audited          | Audit     |

## 12. Open Decisions

Exact moderation action applied to each target type follows target-specific moderation policy.
