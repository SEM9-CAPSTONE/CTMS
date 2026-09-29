# CTMS-103 — Record Audit Logs for Critical Actions

## 1. Overview

Story: CTMS-103

Epic: EPIC 18. Administration and Audit

Use Case: Record Audit Logs for Critical Actions

Priority: Must Have

Goal: Preserve sufficient evidence of critical CTMS actions without storing unnecessary secrets or sensitive values.

Backlog story: As the System, I want to record critical actions so important state changes can be traced.

Acceptance Criteria:

| Source  | Criterion                                                 |
| ------- | --------------------------------------------------------- |
| PB AC-1 | Critical action records actor.                            |
| PB AC-2 | Critical action records action.                           |
| PB AC-3 | Critical action records target.                           |
| PB AC-4 | Critical action records timestamp.                        |
| PB AC-5 | Before/after state or reason is recorded where necessary. |
| PB AC-6 | Secrets and unnecessary sensitive values are not stored.  |

## 2. Scope

### In Scope

- Critical-action audit.
- Actor/action/target/time.
- Necessary before/after or reason.

### Out of Scope

- General application debug logging.
- Secret/token storage.

## 3. Actors & Authorization

System creates audit records from authoritative operations.

Users do not directly author arbitrary audit records.

## 4. Preconditions & Dependencies

A critical auditable operation occurs.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-285 | A critical action must record actor, action, target, timestamp, and the required before/after data or reason. Secrets and sensitive values not needed for audit must not be recorded. |
| BR-191 | Critical actions must be recorded in the audit log with actor, action, target, timestamp, and either before/after data or the reason for the change.                                  |
| BR-192 | Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data.                                                                              |

## 6. State & Lifecycle

Critical operation
→ authoritative transaction
→ audit evidence retained.

Audit is history, not an editable business lifecycle.

## 7. Business Flow

1. Critical action requested.
2. Validate and execute business operation.
3. Determine audit context.
4. Record actor/action/target/time.
5. Store required before/after or reason.
6. Exclude prohibited sensitive values.

## 8. Data & Invariants

Minimum applicable evidence:

- actor;
- action;
- target;
- timestamp;
- before/after or reason where needed.

Audit must not become a secret store.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                              | Expected Behavior             |
| --------------------------------- | ----------------------------- |
| Critical state change             | Audit created                 |
| Password/token present in request | Not copied to audit           |
| System job                        | System actor/context retained |
| Change requires reason            | Reason retained               |

## 11. Acceptance & Test Matrix

| Source | Scenario        | Expected Result                 | Test Type   |
| ------ | --------------- | ------------------------------- | ----------- |
| BR-285 | Critical action | Audit evidence created          | Integration |
| BR-285 | State change    | Necessary before/after retained | Audit       |
| BR-192 | Secret in input | Secret absent from audit        | Security    |

## 12. Open Decisions

Exact audit retention policy is not defined by this story.
