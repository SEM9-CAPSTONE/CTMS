# CTMS-036 — Cancel Trip Due to Insufficient Participants

## 1. Overview

Story: CTMS-036

Epic: EPIC 4. Trip Management

Use Case: Cancel Trip Due to Insufficient Participants

Priority: Must Have

Goal: Automatically cancel a published Trip after `booking_deadline` when authoritative confirmed participation is below `capacity_min`, while consistently resolving Booking, equipment and refund commitments.

Backlog story: As the System, I want to cancel a Trip that does not reach minimum participation so affected commitments can be released and Campers handled according to policy.

Acceptance Criteria:

| Source  | Criterion                                                                                                                          |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| PB AC-1 | Evaluation occurs after `booking_deadline`.                                                                                        |
| PB AC-2 | Only eligible published Trips below `capacity_min` are automatically cancelled.                                                    |
| PB AC-3 | Confirmed participation is calculated from authoritative confirmed participant state; pending payment is not counted as confirmed. |
| PB AC-4 | Affected Booking/equipment commitments are resolved according to policy.                                                           |
| PB AC-5 | Eligible paid Bookings enter the refund workflow.                                                                                  |
| PB AC-6 | Job is idempotent, concurrency-safe, audited and notifies only after commit.                                                       |

## 2. Scope

### In Scope

- Deadline-triggered Trip evaluation.
- Confirmed participant count.
- Auto-cancel Trip.
- Resolve Bookings.
- Release unused equipment.
- Trigger eligible refunds.
- Audit.
- Notification.

### Out of Scope

- Host discretionary cancellation; CTMS-027.
- Booking payment.
- Refund provider implementation beyond CTMS-035.

## 3. Actors & Authorization

- System/background worker.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-023.
- CTMS-032.
- CTMS-035.

Trip must have passed its booking deadline.

## 5. Business Rules

| BR             | Rule                                                                                                                                                                                                                                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-107         | After booking_deadline, a background job may auto-cancel a still-published Trip only when confirmed_participant_count < capacity_min. confirmed_participant_count includes only eligible participants from confirmed Bookings and excludes pending_payment Bookings that merely hold seats. The job must be idempotent and must re-check the condition within the transaction. |
| BR-108         | When a Trip is auto-cancelled, unused equipment_reservations must be released/cancelled and related porter_assignments must transition according to the applicable cancellation flow.                                                                                                                                                                                          |
| BR-109         | When a Trip is cancelled, related Bookings must be transitioned/cancelled according to the applicable cancellation policy. Refunds must be created when required by the refund policy, and notifications may be sent only after commit. The system must not create duplicate refunds for the same refund obligation.                                                           |
| BR-176         | Any business operation that changes multiple tables or records must execute within a transaction. If any step fails, the entire operation must roll back.                                                                                                                                                                                                                      |
| BR-177         | A failed operation must not leave data, state, reserved capacity, money, or inventory in a partially processed condition.                                                                                                                                                                                                                                                      |
| BR-180         | Every stateful resource must follow its defined state transitions and must not use values outside the database enum.                                                                                                                                                                                                                                                           |
| BR-181         | Before changing state, the system must validate the current state. A request based on stale state must be rejected with a business-conflict error.                                                                                                                                                                                                                             |
| BR-191         | Critical actions must be recorded in the audit log with actor, action, target, timestamp, and either before/after data or the reason for the change.                                                                                                                                                                                                                           |
| BR-192         | Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data.                                                                                                                                                                                                                                                                       |
| BR-193         | Automated actions must record actor_id = NULL or a system actor and must include a clear reason for execution.                                                                                                                                                                                                                                                                 |
| BR-194         | Notification/event side effects may be queued or emitted only after the primary business transaction commits successfully, preferably through an outbox/queue. Notification failure must not roll back the already-committed business result.                                                                                                                                  |
| BR-195         | A single business event must not create duplicate notifications for the same recipient, target object, and event type.                                                                                                                                                                                                                                                         |
| BR-205         | A background job must re-evaluate business preconditions at execution time and must not rely solely on previously observed state.                                                                                                                                                                                                                                              |
| BR-206         | Background jobs must be safely retryable. Multiple workers must not expire, cancel, refund, or notify the same record more than once.                                                                                                                                                                                                                                          |
| BR-212         | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                                                                          |
| BR-213         | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                                                                                   |

## 6. State & Lifecycle

Eligible published Trip
→ booking deadline passes
→ confirmed participants < `capacity_min`
→ `cancelled`

If count ≥ minimum:
→ Trip remains in current valid state.

## 7. Business Flow

1. Worker identifies Trip after booking deadline.
2. Begin protected processing.
3. Reload Trip.
4. Verify current published state.
5. Calculate confirmed participants.
6. Exclude pending-payment holds from confirmed count.
7. Compare against `capacity_min`.
8. If minimum reached, no cancellation.
9. Otherwise cancel Trip.
10. Resolve affected Bookings.
11. Release applicable equipment.
12. Create eligible refund obligations.
13. Audit system action.
14. Commit.
15. Notify after commit.

## 8. Data & Invariants

- Pending-payment Booking does not count as confirmed participation.
- Job does not cancel Trip before booking deadline.
- Trip meeting minimum is not auto-cancelled by this rule.
- Same Trip cannot be auto-cancelled twice.
- Same Booking cannot be refunded twice.
- Notification occurs after commit.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                                 | Expected Behavior                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| Minimum reached just before worker                   | Recheck → do not cancel.                                                  |
| Trip already cancelled                               | No-op.                                                                    |
| Trip no longer published                             | Do not apply this transition.                                             |
| Pending-payment seats make apparent count sufficient | Do not count them as confirmed.                                           |
| Two workers process same Trip                        | One authoritative transition.                                             |
| Refund provider unavailable                          | Trip cancellation remains committed; refund follows recoverable workflow. |
| Notification fails                                   | Do not undo cancellation.                                                 |

## 11. Acceptance & Test Matrix

| Source          | Scenario                       | Expected Result                  | Test Type             |
| --------------- | ------------------------------ | -------------------------------- | --------------------- |
| PB AC-1, BR-108 | Before deadline                | No auto-cancel                   | Boundary              |
| PB AC-2, BR-108 | After deadline, below minimum  | Cancel                           | Worker E2E            |
| PB AC-2         | Minimum reached                | No cancellation                  | Boundary              |
| PB AC-3, BR-107 | Pending-payment Booking exists | Not counted confirmed            | Integration           |
| PB AC-4, BR-109 | Equipment reserved             | Released according to policy     | Integration           |
| PB AC-5         | Paid affected Booking          | Refund workflow invoked          | Financial Integration |
| PB AC-6         | Worker retries                 | No duplicate cancellation/refund | Idempotency           |

## 12. Open Decisions

None beyond the authoritative Booking/refund/equipment policies.
