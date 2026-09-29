# CTMS-027 — Edit, Reschedule, or Cancel Trip

## 1. Overview

Story: CTMS-027

Epic: EPIC 4. Trip Management

Use Case: Edit, Reschedule, or Cancel Trip

Priority: Must Have

Goal: Allow the owning Host to adjust a Trip plan without breaking existing Camper, Porter, Equipment, refund, audit, and notification commitments.

Backlog story: As a Host, I want to edit, reschedule, or cancel a Trip I organize so I can handle plan changes without making existing commitments incorrect.

Acceptance Criteria:

| Source   | Criterion                                                                                                                                                |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PB AC-1  | Only the Host who owns the Trip may edit, reschedule, or cancel it.                                                                                      |
| PB AC-2  | Reschedule may change only `starts_at` and/or `ends_at`, and only when `new_starts_at > rescheduled_at + 24h`.                                           |
| PB AC-3  | After reschedule, active Camper Bookings and assigned Porter Assignments move to Pending Reconfirmation for the new schedule and must respond by T-24h.  |
| PB AC-4  | Missing Camper or Porter response by T-24h is treated as Decline.                                                                                        |
| PB AC-5  | Camper Accept preserves the Booking, Trip slot, and paid or snapshotted Trip price.                                                                      |
| PB AC-6  | Camper Decline or timeout cancels the Booking, releases the slot, and gives the Camper a Full Refund.                                                    |
| PB AC-7  | Porter Accept preserves the current Porter Assignment for the new schedule.                                                                              |
| PB AC-8  | Porter Decline or timeout unassigns the Porter and opens the position for replacement.                                                                   |
| PB AC-9  | Required Porter replacement may be assigned during the source-defined replacement window after reconfirmation handling and before the staffing deadline. |
| PB AC-10 | If required Porter staffing is still insufficient at T-12h, the Trip is Cancelled and remaining active Campers receive Full Refunds.                     |
| PB AC-11 | Active Equipment Reservations are revalidated against the new schedule after reschedule.                                                                 |
| PB AC-12 | Available Equipment Reservations move to the new schedule while preserving quantity and paid or snapshotted amount.                                      |
| PB AC-13 | Optional Equipment that is unavailable after reschedule cancels only the affected Equipment Reservation and preserves the Trip Booking.                  |
| PB AC-14 | Paid unavailable Equipment receives a Full Refund for the Equipment portion.                                                                             |
| PB AC-15 | Refund processing is idempotent; the same refundable Trip or Equipment amount must not be refunded twice.                                                |
| PB AC-16 | Reschedule and commitment changes are audited, and notifications are sent only after the related state changes commit successfully.                      |

## 2. Scope

### In Scope

- Host edit of allowed Trip planning fields before the Trip reaches states that block edits.
- Host cancellation of an owned Trip when the Trip lifecycle allows cancellation.
- Host reschedule of an approved, not-started Trip where only `starts_at` and/or `ends_at` change.
- Reconfirmation handling for active Camper Bookings and assigned Porter Assignments after reschedule.
- Porter replacement handling after reconfirmation and before the T-12h staffing deadline.
- Equipment Reservation revalidation, movement, cancellation, and Equipment-portion refund after reschedule.
- Refund idempotency for Trip and Equipment amounts affected by reschedule or cancellation.
- Audit and post-commit notification behavior.

### Out of Scope

- Creating a Trip. CTMS-021 owns Trip creation.
- Configuring Trip waypoints. CTMS-022 owns waypoint creation and ordering.
- Admin approval and publication. CTMS-023 owns approval and publish behavior.
- Detailed refund processing outside the refund events triggered by this flow.
- Material Trip changes outside the approved reschedule behavior.

## 3. Actors & Authorization

- Host: may edit, reschedule, or cancel only Trips they own.
- Backend API: authoritative enforcement point for ownership, lifecycle, timing, commitment, refund, audit, and notification rules.
- Camper: may Accept, Decline, or fail to respond to reschedule reconfirmation.
- Porter: may Accept, Decline, or fail to respond to reschedule reconfirmation.
- System: processes reconfirmation timeout, Porter staffing deadline, refund idempotency, Equipment revalidation, audit, and post-commit notifications.

Only the Host who owns the Trip may initiate edit, reschedule, or cancellation.

A non-owning Host, Camper, Porter, or unauthenticated caller must be rejected before any authoritative Trip or commitment state is changed.

## 4. Preconditions & Dependencies

- Trip exists.
- Acting Host owns the Trip.
- Trip is in a lifecycle state that permits the requested operation.
- Reschedule applies to a not-started Trip.
- For the reschedule path, only `starts_at` and/or `ends_at` may change.
- `new_starts_at > rescheduled_at + 24h`.
- Existing active Camper Bookings, Porter Assignments, and Equipment Reservations must be loaded before commitment changes are committed.
- Refund operations must use the applicable paid or snapshotted amount rather than current mutable prices.
- Dependencies: CTMS-021, CTMS-022.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-063 | A Trip may move to cancelled only from lifecycle states that permit cancellation. The owning Host may cancel a Trip before it is completed. If the Trip is already published and has Booking, Porter, or Equipment commitments, cancellation must revalidate current state, cancel or release affected commitments according to policy, create refunds when required, record the reason and audit trail, and send notifications only after commit. A completed Trip must never transition back to cancelled, and the rejected status must not be used. |
| BR-076 | Only the owning Host may edit a Trip. Planning fields of a Trip in ongoing, completed, or cancelled status must not be edited unless an explicitly specified specialized flow allows it.                                                                                                                                                                                                                                                                                                                                                               |
| BR-077 | After a Trip has been published/approved, any change to starts_at and/or ends_at must use the Reschedule flow and comply with BR-444 through BR-464. Other material changes, including Route/version, meeting point, province/city snapshot, capacity, price, or trip_waypoints, are not Reschedule operations and must follow the applicable Edit/reapproval flow.                                                                                                                                                                                    |
| BR-078 | Any Edit, Reschedule, or Cancel operation that affects commitments must be audited. Notifications to affected Campers, Porters, or Hosts may be queued or sent only after the transaction updating the Trip and all related states has committed successfully.                                                                                                                                                                                                                                                                                         |
| BR-174 | All input must be validated for required fields, data type, format, length, enum membership, and cross-field relationships before processing.                                                                                                                                                                                                                                                                                                                                                                                                          |
| BR-180 | Every stateful resource must follow its defined state transitions and must not use values outside the database enum.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| BR-181 | Before changing state, the system must validate the current state. A request based on stale state must be rejected with a business-conflict error.                                                                                                                                                                                                                                                                                                                                                                                                     |
| BR-191 | Critical actions must be recorded in the audit log with actor, action, target, timestamp, and either before/after data or the reason for the change.                                                                                                                                                                                                                                                                                                                                                                                                   |
| BR-192 | Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                                                                                                                                                                                                                                                  |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                                                                                                                                                                                                                                                           |
| BR-444 | A Host may reschedule only a Trip they manage, and only when the Trip is Approved and has not started. Reschedule may change only starts_at and/or ends_at.                                                                                                                                                                                                                                                                                                                                                                                            |
| BR-445 | Reschedule must not change any other approved Trip information, including price, Route, capacity, or Trip policies. Those changes must use their respective business flows instead of Reschedule.                                                                                                                                                                                                                                                                                                                                                      |
| BR-446 | A Host may reschedule only when new_starts_at is more than 24 hours after the reschedule action time: new_starts_at > rescheduled_at + 24h.                                                                                                                                                                                                                                                                                                                                                                                                            |
| BR-447 | new_ends_at must be later than new_starts_at, and the new schedule must satisfy all current Trip time constraints. If validation fails, the new schedule must not be applied.                                                                                                                                                                                                                                                                                                                                                                          |
| BR-448 | After a successful Reschedule, all Campers with active Bookings and all currently assigned Porters must move to Pending Reconfirmation for the new schedule.                                                                                                                                                                                                                                                                                                                                                                                           |
| BR-449 | Campers and Porters must Accept or Decline the new schedule no later than 24 hours before new_starts_at.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| BR-450 | If a Camper or Porter has not accepted by the Reconfirmation Deadline, defined as new_starts_at - 24h, the system must treat the missing response as Decline.                                                                                                                                                                                                                                                                                                                                                                                          |
| BR-451 | If a Camper accepts the new schedule, the Camper's Booking and reserved slot must be preserved. The Trip price already paid or snapshotted at Booking time must not change because of Reschedule.                                                                                                                                                                                                                                                                                                                                                      |
| BR-452 | If a Camper declines, or is treated as declined after the deadline, the Booking must be cancelled, the slot released, and the Camper must receive a Full Refund of the Booking amount affected by the Reschedule.                                                                                                                                                                                                                                                                                                                                      |
| BR-453 | If a Porter accepts the new schedule, the existing Porter Assignment remains valid for the new schedule.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| BR-454 | If a Porter declines, or is treated as declined after the deadline, the Porter must be unassigned from the Trip and the corresponding Porter position must be reopened for replacement.                                                                                                                                                                                                                                                                                                                                                                |
| BR-455 | The system may search for and assign a replacement Porter during the window from the Reconfirmation Deadline until 12 hours before new_starts_at.                                                                                                                                                                                                                                                                                                                                                                                                      |
| BR-456 | All required Porter positions must be assigned and fully confirmed no later than 12 hours before new_starts_at.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| BR-457 | If the Trip still lacks the required Porter staffing at the Porter Staffing Deadline, defined as new_starts_at - 12h, the Trip must be Cancelled and all Campers with remaining active Bookings must receive Full Refunds.                                                                                                                                                                                                                                                                                                                             |
| BR-458 | After a successful Reschedule, every active Equipment Reservation affected by the Trip schedule must have availability revalidated against the new schedule.                                                                                                                                                                                                                                                                                                                                                                                           |
| BR-459 | If the Equipment remains available for the new schedule, the Equipment Reservation must move to the new schedule while preserving quantity and the amount already paid or snapshotted.                                                                                                                                                                                                                                                                                                                                                                 |
| BR-460 | If optional Equipment is no longer available for the new schedule, the corresponding Equipment Reservation must be cancelled. Cancelling that Equipment Reservation must not automatically cancel the Camper's Trip Booking.                                                                                                                                                                                                                                                                                                                           |
| BR-461 | If paid Equipment is cancelled because it is unavailable after Reschedule, the system must create or record a Full Refund for the cancelled Equipment portion through the existing refund process.                                                                                                                                                                                                                                                                                                                                                     |
| BR-462 | An Equipment Refund must be based on the amount the Camper actually paid or the amount snapshotted at Booking time, not the Equipment's current price.                                                                                                                                                                                                                                                                                                                                                                                                 |
| BR-463 | Refund processing must be idempotent. A Trip or Equipment amount that has already been refunded must not be refunded a second time if the Booking or Trip is later cancelled again.                                                                                                                                                                                                                                                                                                                                                                    |
| BR-464 | The Reschedule and all resulting commitment changes must be audited, including at minimum the previous schedule, new schedule, Host who performed the Reschedule, reschedule time, and reconfirmation/revalidation outcomes. Notifications may be sent only after the corresponding changes have committed successfully.                                                                                                                                                                                                                               |

## 6. State & Lifecycle

### Trip

For a valid reschedule, the Trip remains the same business Trip while its approved schedule is replaced by the new valid schedule.

If required Porter staffing is insufficient at T-12h:

`Trip → Cancelled`

### Camper Booking

After reschedule:

`Active → Pending Reconfirmation`

Then:

`Pending Reconfirmation → Active`
when Camper Accepts.

or:

`Pending Reconfirmation → Cancelled`
when Camper Declines or does not respond by T-24h.

Cancellation releases the Trip slot and creates the applicable Full Refund obligation.

### Porter Assignment

After reschedule:

`Assigned → Pending Reconfirmation`

Then:

`Pending Reconfirmation → Assigned`
when Porter Accepts.

or:

`Pending Reconfirmation → Unassigned`
when Porter Declines or does not respond by T-24h.

An unassigned required Porter position becomes available for replacement until the T-12h staffing deadline.

### Equipment Reservation

After reschedule, active reservations are revalidated.

If available:

`Active → Active on new schedule`

If optional Equipment is unavailable:

`Active → Cancelled`

The Trip Booking remains active.

If the cancelled Equipment was paid, the Equipment portion enters the applicable Full Refund process.

## 7. Business Flow

1. Host requests edit, reschedule, or cancellation for a Trip they own.
2. Backend verifies authentication, ownership, Trip lifecycle, and operation eligibility.
3. For reschedule, backend verifies that only `starts_at` and/or `ends_at` change.
4. Backend validates `new_starts_at > rescheduled_at + 24h`.
5. Backend loads affected active Camper Bookings, Porter Assignments, and Equipment Reservations.
6. The new Trip schedule is committed.
7. Active Camper Bookings move to Pending Reconfirmation.
8. Assigned Porter Assignments move to Pending Reconfirmation.
9. Active Equipment Reservations are revalidated against the new schedule.
10. Available Equipment Reservations move to the new schedule while preserving quantity and paid/snapshotted amount.
11. Optional unavailable Equipment Reservations are cancelled without cancelling the Trip Booking.
12. Paid cancelled Equipment creates an idempotent Full Refund for the Equipment portion.
13. Campers and Porters must respond by T-24h.
14. Missing responses at T-24h are processed as Decline.
15. Camper Accept preserves Booking, slot, and paid/snapshotted Trip price.
16. Camper Decline/timeout cancels the Booking, releases the slot, and creates an idempotent Full Refund.
17. Porter Accept preserves the Assignment.
18. Porter Decline/timeout unassigns the Porter and opens the required position for replacement.
19. Replacement Porter may be assigned during the approved replacement window before T-12h.
20. At T-12h, the system checks required Porter staffing.
21. If staffing is insufficient, the Trip is cancelled and all remaining active Camper Bookings receive idempotent Full Refunds.
22. Audit records are persisted for the reschedule and resulting commitment outcomes.
23. Notifications are emitted only after the corresponding authoritative changes commit successfully.

## 8. Data & Invariants

### Trip schedule

A valid reschedule must satisfy:

`new_starts_at > rescheduled_at + 24h`

Only:

- `starts_at`
- `ends_at`

may be changed through the reschedule path.

### Camper commitment

Camper Accept must preserve:

- Booking identity;
- reserved slot;
- amount actually paid or snapshotted for the Trip.

Camper Decline/timeout must:

- cancel the affected Booking;
- release the slot;
- create the applicable Full Refund obligation.

### Porter commitment

Porter Accept preserves the Assignment.

Porter Decline/timeout removes the Assignment and allows replacement only within the approved replacement window before T-12h.

### Equipment commitment

Available Equipment preserves:

- reservation identity where applicable;
- quantity;
- paid/snapshotted amount.

Unavailable optional Equipment cancellation must not cancel the Trip Booking.

### Refund

Refund amount must derive from the applicable paid/snapshotted amount.

The same refundable obligation must not be refunded more than once.

### Audit and notification

Audit must retain the required reschedule and commitment context.

Notification is post-commit only.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                                           | Expected Behavior                                                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Non-owning Host attempts edit/reschedule/cancel                | Reject without changing Trip or commitments.                                                                 |
| Reschedule changes a field other than `starts_at` or `ends_at` | Reject the reschedule path; use the applicable edit/reapproval flow instead.                                 |
| `new_starts_at <= rescheduled_at + 24h`                        | Reject reschedule.                                                                                           |
| Camper accepts by T-24h                                        | Preserve Booking, slot, and paid/snapshotted Trip price.                                                     |
| Camper declines                                                | Cancel Booking, release slot, create Full Refund.                                                            |
| Camper gives no response by T-24h                              | Treat as Decline.                                                                                            |
| Porter accepts by T-24h                                        | Preserve Assignment.                                                                                         |
| Porter declines                                                | Unassign and open replacement.                                                                               |
| Porter gives no response by T-24h                              | Treat as Decline.                                                                                            |
| Required Porter remains missing at T-12h                       | Cancel Trip and Full Refund remaining active Campers.                                                        |
| Equipment remains available                                    | Move reservation to new schedule and preserve quantity/amount.                                               |
| Optional Equipment unavailable                                 | Cancel only Equipment Reservation; Booking remains active.                                                   |
| Paid Equipment unavailable                                     | Full Refund only the affected Equipment portion.                                                             |
| Same refund is retried                                         | Do not refund twice.                                                                                         |
| Transaction fails before commit                                | Do not emit success notification or expose partially committed business state.                               |
| Notification delivery fails after commit                       | Authoritative committed state remains valid; notification handling follows its own delivery/retry mechanism. |

## 11. Acceptance & Test Matrix

| Source           | Scenario                                 | Expected Result                                         | Test Type                 |
| ---------------- | ---------------------------------------- | ------------------------------------------------------- | ------------------------- |
| PB AC-1, BR-063  | Non-owner attempts Trip mutation         | Rejected                                                | Authorization / E2E       |
| PB AC-2, BR-077  | Reschedule changes only schedule fields  | Accepted when other conditions pass                     | Validation                |
| PB AC-2, BR-078  | `new_starts_at > rescheduled_at + 24h`   | Accepted                                                | Boundary                  |
| BR-078           | `new_starts_at = rescheduled_at + 24h`   | Rejected                                                | Boundary                  |
| PB AC-3, BR-444  | Active Camper Booking after reschedule   | Pending Reconfirmation                                  | Integration               |
| PB AC-3, BR-450  | Assigned Porter after reschedule         | Pending Reconfirmation                                  | Integration               |
| PB AC-4, BR-446  | Camper has no response by T-24h          | Treat as Decline                                        | Scheduled / E2E           |
| PB AC-4, BR-452  | Porter has no response by T-24h          | Treat as Decline                                        | Scheduled / E2E           |
| PB AC-5, BR-447  | Camper Accept                            | Booking, slot and snapshot price preserved              | Integration               |
| PB AC-6, BR-448  | Camper Decline                           | Booking cancelled and slot released                     | Integration               |
| PB AC-6, BR-449  | Camper Decline/timeout                   | Full Refund created                                     | Financial / E2E           |
| PB AC-7, BR-453  | Porter Accept                            | Assignment preserved                                    | Integration               |
| PB AC-8, BR-454  | Porter Decline/timeout                   | Porter unassigned and replacement opened                | Integration               |
| PB AC-9, BR-455  | Replacement before staffing deadline     | Assignment permitted when otherwise valid               | Boundary / Integration    |
| PB AC-10, BR-456 | Staffing check at T-12h                  | Required staffing evaluated                             | Scheduled                 |
| PB AC-10, BR-457 | Staffing insufficient at T-12h           | Trip cancelled                                          | E2E                       |
| PB AC-10, BR-458 | Trip cancelled for staffing shortage     | Remaining active Campers Full Refunded                  | Financial / E2E           |
| PB AC-11, BR-459 | Active Equipment after reschedule        | Revalidated                                             | Integration               |
| PB AC-12, BR-460 | Equipment available                      | Reservation moved; quantity/amount preserved            | Integration               |
| PB AC-13, BR-461 | Optional Equipment unavailable           | Equipment cancelled; Booking preserved                  | Integration               |
| PB AC-14, BR-462 | Paid Equipment unavailable               | Equipment portion Full Refunded using snapshot amount   | Financial                 |
| PB AC-15, BR-463 | Refund operation retried                 | No duplicate refund                                     | Idempotency / Integration |
| PB AC-16, BR-464 | Reschedule commits                       | Audit contains required context                         | Audit / Integration       |
| PB AC-16, BR-464 | Notification is evaluated                | Sent only after related commit                          | Transaction / Integration |
| BR-212           | Business Rule/state/API contract changes | Spec, tests, and data documentation updated before Done | DoD                       |
| BR-213           | Valid and violation paths                | Required test coverage exists                           | Test Governance           |

## 12. Open Decisions

None.
