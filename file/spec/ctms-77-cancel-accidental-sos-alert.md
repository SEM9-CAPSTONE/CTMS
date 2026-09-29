# CTMS-077 — Cancel Accidental SOS Alert

## 1. Overview

Story: CTMS-077

Epic: EPIC 12. SOS and Emergency Communication

Use Case: Cancel Accidental SOS Alert

Priority: Must Have

Goal: Allow an accidentally created SOS to be cancelled only when the configured cancellation policy permits, while preserving complete emergency history.

Backlog story: As a Camper, I want to cancel an accidental SOS when allowed so responders know that the alert was sent by mistake.

Acceptance Criteria:

| Source  | Criterion                                                                     |
| ------- | ----------------------------------------------------------------------------- |
| PB AC-1 | SOS cancellation is allowed only when configured cancellation policy permits. |
| PB AC-2 | Cancellation records `cancelled_by`.                                          |
| PB AC-3 | Cancellation records `cancelled_at`.                                          |
| PB AC-4 | Cancellation records reason.                                                  |
| PB AC-5 | Original SOS history is preserved.                                            |
| PB AC-6 | Cancellation must not delete the SOS record.                                  |

## 2. Scope

### In Scope

- Accidental SOS cancellation.
- Cancellation-policy validation.
- Cancellation actor/time/reason.
- History preservation.

### Out of Scope

- SOS acknowledgement.
- SOS closure after handling.
- Physical emergency-response cancellation outside CTMS.

## 3. Actors & Authorization

- Authorized SOS sender/user according to configured cancellation policy.
- System.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-074 or CTMS-076.

SOS exists and cancellation policy permits cancellation.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-258     | An SOS sent by mistake may be cancelled only when the configured cancellation policy permits it. Cancellation must store cancelled_by, cancelled_at, and reason, and must preserve SOS history. |
| BR-191     | Critical actions must be recorded in the audit log with actor, action, target, timestamp, and either before/after data or the reason for the change.                                            |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.           |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                    |

## 6. State & Lifecycle

Active SOS
→ cancellation requested
→ validate policy
→ cancelled.

SOS record/history remains retained.

If policy disallows:
→ state unchanged.

## 7. Business Flow

1. User selects Cancel SOS.
2. Verify SOS identity and authorization.
3. Evaluate configured cancellation policy.
4. If not permitted, reject.
5. Require/capture cancellation reason according to source rule.
6. Store cancelled_by.
7. Store cancelled_at.
8. Transition SOS to cancelled.
9. Preserve original SOS/history.
10. Trigger applicable downstream status update/notification.

## 8. Data & Invariants

Cancellation stores:

- cancelled_by;
- cancelled_at;
- reason.

Invariant:

`cancel SOS != delete SOS`

Emergency history remains auditable.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                     | Expected Behavior                                   |
| ------------------------ | --------------------------------------------------- |
| Policy permits           | Cancel                                              |
| Policy rejects           | SOS remains active                                  |
| Unauthorized user        | Reject                                              |
| Cancellation succeeds    | History retained                                    |
| User tries delete        | Not equivalent to cancellation                      |
| Concurrent Host handling | Resolve using authoritative state/concurrency rules |

## 11. Acceptance & Test Matrix

| Source | Scenario                | Expected Result          | Test Type  |
| ------ | ----------------------- | ------------------------ | ---------- |
| BR-258 | Policy permits          | SOS cancelled            | Functional |
| BR-258 | Policy denies           | Rejected                 | Policy     |
| BR-258 | Successful cancellation | Actor/time/reason stored | Data       |
| BR-258 | Cancelled SOS queried   | History retained         | Audit      |
| BR-258 | Delete attempted        | No history deletion      | Integrity  |

## 12. Open Decisions

Exact cancellation window/conditions are configuration-policy concerns and are not defined numerically by BR-258.
