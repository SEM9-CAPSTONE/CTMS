# CTMS-080 — Acknowledge and Close SOS Handling

## 1. Overview

Story: CTMS-080

Epic: EPIC 12. SOS and Emergency Communication

Use Case: Acknowledge and Close SOS Handling

Priority: Must Have

Goal: Allow an authorized Host to acknowledge and close SOS handling for a Trip they manage while preserving the complete emergency-handling history.

Backlog story: As a Host, I want to acknowledge and close an SOS so the emergency handling status is visible and auditable.

Acceptance Criteria:

| Source  | Criterion                                                                   |
| ------- | --------------------------------------------------------------------------- |
| PB AC-1 | Only an authorized Host managing the Trip may acknowledge or close its SOS. |
| PB AC-2 | Acknowledgement transitions the SOS to `acknowledged`.                      |
| PB AC-3 | Acknowledgement stores `acknowledged_by` and `acknowledged_at`.             |
| PB AC-4 | Sender is notified after acknowledgement is successfully committed.         |
| PB AC-5 | After handling is completed, an acknowledged SOS may be closed.             |
| PB AC-6 | Closure stores `closed_by`, `closed_at`, and `resolution_note`.             |
| PB AC-7 | `closed` is terminal in MVP and cannot be reopened.                         |
| PB AC-8 | SOS transitions are audited and notifications occur only after commit.      |

## 2. Scope

### In Scope

- SOS acknowledgement.
- SOS closure.
- Authorization.
- Actor and timestamp evidence.
- Resolution note.
- Audit.
- Post-commit notification.

### Out of Scope

- SOS creation — CTMS-074/076.
- Accidental SOS cancellation — CTMS-077.
- Real-time SOS delivery — CTMS-079.
- Reopening a closed SOS.

## 3. Actors & Authorization

Primary actor:

- Host.

Host must be authorized to manage the Trip associated with the SOS.

Backend authorization is mandatory.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-074 or CTMS-076.
- CTMS-079.

SOS exists.

Host manages the associated Trip.

SOS is in a state valid for the requested transition.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-261 | Only an authorized Host may acknowledge or close an SOS for a Trip they manage. Acknowledge transitions the SOS to acknowledged, stores acknowledged_by and acknowledged_at, and notifies the sender. After handling is complete, the Host may transition acknowledged → closed; closing must store closed_by, closed_at, and resolution_note. closed is terminal in the MVP and cannot be reopened. Cancellation for an accidentally sent SOS follows the separate cancellation rule. Every transition must be audited and notifications may be sent only after commit. |
| BR-191 | Critical actions must be recorded in the audit log with actor, action, target, timestamp, and either before/after data or the reason for the change.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| BR-192 | Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                                                                                                                                                                                                                                                                    |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                                                                                                                                                                                                                                                                             |

## 6. State & Lifecycle

Applicable SOS handling lifecycle:

`active/open`
→ `acknowledged`
→ `closed`

`closed` is terminal in MVP.

Accidental cancellation follows CTMS-077 and is not equivalent to `closed`.

## 7. Business Flow

### A. Acknowledge

1. Host opens SOS.
2. Backend verifies Host authorization for the Trip.
3. Verify current SOS state.
4. Transition SOS to `acknowledged`.
5. Store `acknowledged_by`.
6. Store `acknowledged_at`.
7. Commit state change.
8. Record audit.
9. Notify sender after commit.

### B. Close

1. Host completes emergency handling.
2. Host submits closure with resolution note.
3. Backend verifies authorization.
4. Verify SOS is currently `acknowledged`.
5. Transition `acknowledged → closed`.
6. Store `closed_by`.
7. Store `closed_at`.
8. Store `resolution_note`.
9. Commit.
10. Record audit and applicable post-commit notification.

## 8. Data & Invariants

Acknowledgement requires:

- acknowledged_by;
- acknowledged_at.

Closure requires:

- closed_by;
- closed_at;
- resolution_note.

Invariants:

- receiving an SOS does not automatically acknowledge it;
- cancellation is not closure;
- closure requires acknowledged state;
- closed SOS cannot reopen in MVP;
- failed transaction must not produce a successful notification.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                          | Expected Behavior                             |
| ----------------------------- | --------------------------------------------- |
| Unauthorized Host             | Reject                                        |
| Close before acknowledgement  | Reject                                        |
| Close without resolution note | Reject                                        |
| Two concurrent transitions    | Do not silently overwrite authoritative state |
| Already closed SOS            | Reject further lifecycle mutation             |
| Accidental SOS                | Use CTMS-077 cancellation flow                |
| Commit fails                  | Do not notify success                         |

## 11. Acceptance & Test Matrix

| Source | Scenario                     | Expected Result              | Test Type   |
| ------ | ---------------------------- | ---------------------------- | ----------- |
| BR-261 | Authorized Host acknowledges | SOS becomes acknowledged     | Integration |
| BR-261 | Acknowledge succeeds         | Actor/time stored            | Data        |
| BR-261 | Acknowledge committed        | Sender notified              | Integration |
| BR-261 | acknowledged → closed        | Transition succeeds          | State       |
| BR-261 | Close                        | actor/time/resolution stored | Data        |
| BR-261 | Reopen closed SOS            | Rejected                     | Lifecycle   |
| BR-261 | Unauthorized Host            | Rejected                     | Security    |
| BR-213 | Concurrent transition        | No invalid overwrite         | Concurrency |

## 12. Open Decisions

None.
