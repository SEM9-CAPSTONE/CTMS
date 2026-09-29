# CTMS-090 — Receive Push Notifications while App Runs in Background

## 1. Overview

Story: CTMS-090

Epic: EPIC 15. Notifications

Use Case: Receive Push Notifications while App Runs in Background

Priority: Should Have

Goal: Deliver supported high-value notifications while the application is in the background without sending the same event more than once to the same recipient.

Backlog story: As a user, I want to receive push notifications while the app is in the background so I can be informed about important Trip events.

Acceptance Criteria:

| Source  | Criterion                                                                              |
| ------- | -------------------------------------------------------------------------------------- |
| PB AC-1 | Background push supports booking updates.                                              |
| PB AC-2 | Background push supports Porter assignments.                                           |
| PB AC-3 | Background push supports weather alerts.                                               |
| PB AC-4 | Background push supports SOS.                                                          |
| PB AC-5 | Same event must not be sent more than once to the same recipient.                      |
| PB AC-6 | Recipient authorization/eligibility and applicable notification rules remain enforced. |

## 2. Scope

### In Scope

Background push for:

- booking updates;
- Porter assignments;
- weather alerts;
- SOS.

Also includes:

- recipient eligibility;
- per-event/per-recipient duplicate prevention.

### Out of Scope

- General in-app notification UI — CTMS-088.
- Missed-alert recovery — CTMS-089.
- User notification configuration — CTMS-091.

## 3. Actors & Authorization

- Eligible user.
- Push notification subsystem.

Push delivery must not expose an event to an ineligible recipient.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-088.

A supported event occurs and the user/app is eligible for background push.

## 5. Business Rules

| BR             | Rule                                                                                                                                                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-273         | Background push notifications may be used for Booking updates, Porter Assignments, weather alerts, and SOS. The same event must not be delivered more than once to the same recipient.                                                        |
| BR-194         | Notification/event side effects may be queued or emitted only after the primary business transaction commits successfully, preferably through an outbox/queue. Notification failure must not roll back the already-committed business result. |
| BR-195         | A single business event must not create duplicate notifications for the same recipient, target object, and event type.                                                                                                                        |
| BR-196         | Users may disable ordinary notifications, but mandatory safety or emergency alerts for an active related Trip must not be suppressible.                                                                                                       |
| BR-197         | When an external service times out or returns incomplete data, the system must record the failure, must not assume success, and must not fabricate unverifiable data.                                                                         |
| BR-198         | Retries to external services must be bounded and use backoff. Retrying must not create duplicate records or transactions.                                                                                                                     |
| BR-212         | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                         |
| BR-213         | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                  |

## 6. State & Lifecycle

Supported event
→ determine eligible recipient
→ create push-delivery intent
→ deduplicate by event/recipient
→ send
→ delivery outcome recorded as applicable.

Push delivery does not replace authoritative CTMS business state.

## 7. Business Flow

1. Supported event occurs.
2. Determine recipient eligibility.
3. Determine whether background push applies.
4. Identify event/recipient delivery key.
5. Check previous delivery.
6. If not previously sent, dispatch push.
7. Record delivery attempt/result as applicable.
8. If same event is processed again, do not send duplicate push to same recipient.

## 8. Data & Invariants

Supported event categories:

- booking update;
- Porter assignment;
- weather alert;
- SOS.

Critical invariant:

`same event + same recipient → at most one push`

Push content must not be treated as the authoritative source of the underlying business state.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                         | Expected Behavior                            |
| ---------------------------- | -------------------------------------------- |
| Booking update               | Eligible for push                            |
| Porter assignment            | Eligible for push                            |
| Weather alert                | Eligible for push                            |
| SOS                          | Eligible for push                            |
| Same event processed twice   | One push maximum per recipient               |
| Different recipients         | Each eligible recipient may receive own push |
| Recipient no longer eligible | Do not expose event                          |
| Push provider failure        | Do not fabricate successful delivery         |

## 11. Acceptance & Test Matrix

| Source | Scenario                | Expected Result      | Test Type   |
| ------ | ----------------------- | -------------------- | ----------- |
| BR-273 | Booking update          | Push supported       | Integration |
| BR-273 | Porter assignment       | Push supported       | Integration |
| BR-273 | Weather alert           | Push supported       | Integration |
| BR-273 | SOS                     | Push supported       | E2E         |
| BR-273 | Same event retried      | No duplicate push    | Idempotency |
| BR-273 | Two eligible recipients | Independent delivery | Integration |

## 12. Open Decisions

Push provider/platform implementation belongs to Technical Design.
