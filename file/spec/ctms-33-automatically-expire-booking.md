# CTMS-033 — Automatically Expire Booking

## 1. Overview

Story: CTMS-033

Epic: EPIC 5. Booking and Payment

Use Case: Automatically Expire Booking

Priority: Must Have

Goal: Automatically expire an unpaid Booking after its authoritative hold deadline and release reserved resources exactly once.

Backlog story: As the System, I want unpaid Bookings to expire automatically so seats and equipment are not held indefinitely.

Acceptance Criteria:

| Source  | Criterion                                                               |
| ------- | ----------------------------------------------------------------------- |
| PB AC-1 | Eligible `pending_payment` Booking expires after `hold_expires_at`.     |
| PB AC-2 | A paid Booking must not be expired.                                     |
| PB AC-3 | Expiry releases seats held by the Booking.                              |
| PB AC-4 | Reserved equipment is released/cancelled according to equipment policy. |
| PB AC-5 | Expiry is idempotent and concurrency-safe.                              |
| PB AC-6 | Expiry is audited and notification occurs only after commit.            |

## 2. Scope

### In Scope

- Background expiry job.
- Deadline evaluation.
- Booking expiry transition.
- Seat release.
- Equipment reservation release.
- Audit.
- Post-commit notification.
- Retry/idempotency.

### Out of Scope

- User cancellation.
- Refund.
- Payment initiation.

## 3. Actors & Authorization

- System/background worker.

No client may directly impersonate the authoritative expiry worker.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-029.
- CTMS-032.

Booking must be eligible for automated expiry.

## 5. Business Rules

| BR             | Rule                                                                                                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-093         | A pending_payment Booking with hold_expires_at < now and no successful payment must be moved to expired by an idempotent job. The job must re-check the current state before updating.                                                                 |
| BR-094         | When a Booking expires, the capacity it held must be released exactly once within the same transaction.                                                                                                                                                |
| BR-095         | Any equipment_reservations still in reserved status for an expired Booking must move to cancelled and release inventory. Reservations already picked_up must not be automatically cancelled by the expiry flow.                                        |
| BR-096         | Booking expiry must be audited with actor_id = NULL/system, action = booking_expired, the Booking target, before/after state, and a reason.                                                                                                            |
| BR-097         | Expiry notifications must be queued after commit for the person who made the Booking. Retrying notification delivery must not rerun the Booking-expiry business operation.                                                                             |
| BR-176         | Any business operation that changes multiple tables or records must execute within a transaction. If any step fails, the entire operation must roll back.                                                                                              |
| BR-177         | A failed operation must not leave data, state, reserved capacity, money, or inventory in a partially processed condition.                                                                                                                              |
| BR-178         | Operations that may be retried, including payments, refunds, callbacks, and synchronization, must support idempotency so the same request cannot be successfully applied more than once.                                                               |
| BR-180         | Every stateful resource must follow its defined state transitions and must not use values outside the database enum.                                                                                                                                   |
| BR-181         | Before changing state, the system must validate the current state. A request based on stale state must be rejected with a business-conflict error.                                                                                                     |
| BR-188         | Absolute timestamps must be stored as timestamptz. Pure calendar dates use date, and time-of-day values use time where defined by schema. APIs must transmit timezone/offset explicitly, and the UI must display values using the configured timezone. |
| BR-190         | OTP TTL, token TTL, attempt limits, rate limits, Booking hold duration, and retry deadlines must come from configuration and must not be hard-coded in business logic.                                                                                 |
| BR-191         | Critical actions must be recorded in the audit log with actor, action, target, timestamp, and either before/after data or the reason for the change.                                                                                                   |
| BR-192         | Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data.                                                                                                                                               |
| BR-193         | Automated actions must record actor_id = NULL or a system actor and must include a clear reason for execution.                                                                                                                                         |
| BR-194         | Notification/event side effects may be queued or emitted only after the primary business transaction commits successfully, preferably through an outbox/queue. Notification failure must not roll back the already-committed business result.          |
| BR-195         | A single business event must not create duplicate notifications for the same recipient, target object, and event type.                                                                                                                                 |
| BR-205         | A background job must re-evaluate business preconditions at execution time and must not rely solely on previously observed state.                                                                                                                      |
| BR-206         | Background jobs must be safely retryable. Multiple workers must not expire, cancel, refund, or notify the same record more than once.                                                                                                                  |
| BR-212         | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                  |
| BR-213         | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                           |

## 6. State & Lifecycle

`pending_payment`
→ deadline passes and still unpaid
→ `expired`

Paid/confirmed Booking:
→ never transitions to expired through this flow.

## 7. Business Flow

1. Worker selects expiry candidates.
2. For each candidate, begin protected transaction.
3. Reload Booking.
4. Recheck status/payment/deadline.
5. If no longer eligible, no-op.
6. Transition Booking to expired.
7. Release applicable seats.
8. Release/cancel applicable equipment reservations.
9. Write audit.
10. Commit.
11. Queue notification after commit.
12. Retry notification independently if needed.

## 8. Data & Invariants

- Paid Booking never expires through unpaid-expiry job.
- Capacity is released at most once.
- Equipment reservation is released at most once.
- Job retry is safe.
- Notification failure does not roll back already committed expiry.
- Notification must not be sent before successful commit.

## 9. API / Integration Contract

TBD — Technical Design.

This is primarily a worker/scheduler contract rather than a client API.

## 10. Error & Edge Cases

| Case                                 | Expected Behavior                                   |
| ------------------------------------ | --------------------------------------------------- |
| Booking paid just before worker lock | Recheck → do not expire.                            |
| Booking already expired              | No-op.                                              |
| Two workers process same Booking     | One authoritative transition; no duplicate release. |
| Seat release fails                   | Roll back expiry transaction.                       |
| Notification fails                   | Keep expiry committed; retry notification.          |
| Worker retries                       | No duplicate side effects.                          |

## 11. Acceptance & Test Matrix

| Source          | Scenario                        | Expected Result                             | Test Type   |
| --------------- | ------------------------------- | ------------------------------------------- | ----------- |
| PB AC-1, BR-093 | Deadline passed, unpaid         | Expired                                     | Worker E2E  |
| PB AC-2, BR-181 | Payment succeeded before expiry | No expiry                                   | Concurrency |
| PB AC-3, BR-094 | Booking expires                 | Seats released once                         | Transaction |
| PB AC-4, BR-095 | Reserved equipment exists       | Reservation released appropriately          | Integration |
| PB AC-5, BR-178 | Worker runs twice               | Same final state, no duplicate side effects | Idempotency |
| PB AC-6, BR-097 | Expiry commits                  | Audit recorded                              | Audit       |
| PB AC-6         | Notification processing fails   | Expiry remains committed                    | Integration |

## 12. Open Decisions

Exact scheduler frequency and retry/backoff configuration belong to Technical Design/configuration.
