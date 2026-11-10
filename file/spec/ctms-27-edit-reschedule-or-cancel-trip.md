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
| PB AC-2  | Host changes before publication are Edit operations. Reschedule exists only after `published`, may change only `starts_at` and/or `ends_at`, and only when `new_starts_at > rescheduled_at + 24h`. |
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

- Host edit of allowed Trip planning fields while the Trip is `draft` or `pending_approval`.
- Host cancellation of an owned Trip when the Trip lifecycle allows cancellation.
- Host reschedule of a `published`, not-started Trip where only `starts_at` and/or `ends_at` change.
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
| BR-077 | Before a Trip is published, changes to planning fields are Edit operations. `draft` edits keep the Trip in `draft`; `pending_approval` edits keep the Trip in `pending_approval`, update `updated_at`, and require Admin review of the latest version. After a Trip is `published`, any change to `starts_at` and/or `ends_at` must use the Reschedule flow and comply with BR-444 through BR-464. Other material changes, including Route/version, meeting point, province/city snapshot, capacity, price, or trip_waypoints, are not Reschedule operations and must follow the applicable Edit/reapproval flow. |
| BR-078 | Any Edit, Reschedule, or Cancel operation that affects commitments must be audited. Notifications to affected Campers, Porters, or Hosts may be queued or sent only after the transaction updating the Trip and all related states has committed successfully.                                                                                                                                                                                                                                                                                         |
| BR-079 | Admin review of a `pending_approval` Trip must target the latest Trip version. The review request must include the `updated_at` value that the Admin reviewed, and the backend must reject the decision with a business conflict if the Trip was edited after that version was loaded. |
| BR-174 | All input must be validated for required fields, data type, format, length, enum membership, and cross-field relationships before processing.                                                                                                                                                                                                                                                                                                                                                                                                          |
| BR-180 | Every stateful resource must follow its defined state transitions and must not use values outside the database enum.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| BR-181 | Before changing state, the system must validate the current state. A request based on stale state must be rejected with a business-conflict error.                                                                                                                                                                                                                                                                                                                                                                                                     |
| BR-191 | Critical actions must be recorded in the audit log with actor, action, target, timestamp, and either before/after data or the reason for the change.                                                                                                                                                                                                                                                                                                                                                                                                   |
| BR-192 | Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                                                                                                                                                                                                                                                  |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                                                                                                                                                                                                                                                           |
| BR-444 | A Host may reschedule only a Trip they manage, and only when the Trip is `published` and has not started. Reschedule may change only starts_at and/or ends_at.                                                                                                                                                                                                                                                                                                                                                                                            |
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

Pre-publication edit lifecycle:

`draft → Edit → draft`

`pending_approval → Edit → pending_approval`

For `pending_approval`, the edit updates `updated_at`. Admin review must be based on that latest value.

For a valid reschedule, the Trip remains the same business Trip while its approved schedule is replaced by the new valid schedule.

`published → Reschedule → published`

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
3. If the Trip is `draft`, Edit may change planning fields and the Trip remains `draft`.
4. If the Trip is `pending_approval`, Edit may change planning fields, the Trip remains `pending_approval`, `updated_at` changes, and Admin review must use the latest version.
5. Admin review includes the reviewed `updated_at`; stale review decisions are rejected with a business conflict.
6. If the Trip is `published`, schedule change must use Reschedule and backend verifies that only `starts_at` and/or `ends_at` change.
7. Backend validates `new_starts_at > rescheduled_at + 24h`.
8. Backend loads affected active Camper Bookings, Porter Assignments, and Equipment Reservations.
9. The new Trip schedule is committed.
10. Active Camper Bookings move to Pending Reconfirmation.
11. Assigned Porter Assignments move to Pending Reconfirmation.
12. Active Equipment Reservations are revalidated against the new schedule.
13. Available Equipment Reservations move to the new schedule while preserving quantity and paid/snapshotted amount.
14. Optional unavailable Equipment Reservations are cancelled without cancelling the Trip Booking.
15. Paid cancelled Equipment creates an idempotent Full Refund for the Equipment portion.
16. Campers and Porters must respond by T-24h.
17. Missing responses at T-24h are processed as Decline.
18. Camper Accept preserves Booking, slot, and paid/snapshotted Trip price.
19. Camper Decline/timeout cancels the Booking, releases the slot, and creates an idempotent Full Refund.
20. Porter Accept preserves the Assignment.
21. Porter Decline/timeout unassigns the Porter and opens the required position for replacement.
22. Replacement Porter may be assigned during the approved replacement window before T-12h.
23. At T-12h, the system checks required Porter staffing.
24. If staffing is insufficient, the Trip is cancelled and all remaining active Camper Bookings receive idempotent Full Refunds.
25. Audit records are persisted for the edit, reschedule, cancellation, and resulting commitment outcomes.
26. Notifications are emitted only after the corresponding authoritative changes commit successfully.

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

### Host Edit Before Publication

`PATCH /trips/:tripId`

Allowed statuses:

- `draft`
- `pending_approval`

Payload: existing Trip edit payload from CTMS-021/CTMS-022 planning fields.

Behavior:

- owning Host only;
- `draft` remains `draft`;
- `pending_approval` remains `pending_approval`;
- `updated_at` changes after a successful edit;
- no Camper, Porter, or Equipment reconfirmation is created because the Trip is not published yet.

### Host Reschedule After Publication

`PATCH /trips/:tripId/reschedule`

Allowed status:

- `published`

Payload:

```json
{
  "startsAt": "2026-10-30T07:00:00.000Z",
  "endsAt": "2026-10-30T16:00:00.000Z"
}
```

Behavior:

- owning Host only;
- may change only `starts_at` and/or `ends_at`;
- rejects when `new_starts_at <= rescheduled_at + 24h`;
- creates the reconfirmation, Equipment revalidation, refund, and audit side effects in the Reschedule flow.

### Admin Review Latest Version

`PATCH /trips/:tripId/review`

Payload:

```json
{
  "action": "approve",
  "reviewedUpdatedAt": "2026-09-15T00:00:00.000Z"
}
```

For request changes:

```json
{
  "action": "decline",
  "reviewedUpdatedAt": "2026-09-15T00:00:00.000Z",
  "reason": "Itinerary missing lunch stop"
}
```

Behavior:

- Admin only;
- only `pending_approval`;
- rejects with business conflict when `reviewedUpdatedAt` does not match current Trip `updated_at`.

## 10. Error & Edge Cases

| Case                                                           | Expected Behavior                                                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Non-owning Host attempts edit/reschedule/cancel                | Reject without changing Trip or commitments.                                                                 |
| Host edits `draft` Trip planning fields                        | Accept edit and keep Trip in `draft`.                                                                        |
| Host edits `pending_approval` Trip planning fields             | Accept edit, keep Trip in `pending_approval`, update `updated_at`, require Admin to review latest version.   |
| Admin approves using stale `reviewedUpdatedAt`                  | Reject with business conflict; Trip remains `pending_approval`.                                              |
| Host changes published schedule through Edit endpoint           | Reject; schedule change must use Reschedule.                                                                 |
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
| PB AC-2, BR-077  | Draft Trip edit                          | Edited and remains draft                                | Unit / Integration        |
| PB AC-2, BR-077  | Pending approval Trip edit               | Edited and remains pending_approval                     | Unit / Integration        |
| BR-079           | Admin reviews stale pending Trip version | Rejected with conflict                                  | Unit / Integration        |
| PB AC-2, BR-077  | Published Trip schedule change via edit  | Rejected; Reschedule required                           | Validation                |
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

## 13. Implementation Record — Weather decision near departure (Logic, Jira CTMS-98)

Policy: `docs/features/weather-trip-date-decision-policy.md` §5 (updated in this task: the Admin intervenes only within 3 days of departure and may pause a Trip). API only; the UI is a separate task. Host penalties (§6) are a later task, which can use the `late` flag stored here.

- **Migration `1794700000000-AddTripWeatherDecisions`:**
  - `trips.weather_paused_at` and `weather_pause_reason`;
  - `trip_weather_decisions`: append-only log with the forecast relied on (id and risk level), decider and role, decision (`keep`, `reschedule`, `cancel`, `pause`, `resume`), mandatory reason, safety plan (required for a Host keep), `late`, and the schedule (`trip_starts_at`) it applies to;
  - `trip_weather_decision_alerts`: `UNIQUE (trip_id, trip_starts_at, recipient_id, milestone)`, so each reminder is sent once per schedule and a reschedule starts the milestones again.
- **Rules** (`trips/weather-decisions/trip-weather-decision.policy.ts`):
  - decision window: the last 72 h before departure; a Host decision at ≤ T-24h is `late`;
  - reminders while the newest forecast is Red:
    - T-48h: remind the Host;
    - Host keeps: tell the Admins at once;
    - no Host answer: tell the Admins at T-24h, T-12h ("urgent") and T-6h ("critical"), sending only the most urgent milestone reached;
  - reminders stop after a Host cancel or reschedule, or once an Admin acted for the schedule.
- **Host — `POST /trips/:tripId/weather-decision`:** only the owning Host, on a `published` Trip within 3 days, with a Red newest forecast, and only while no Admin has decided.
  - `cancel` reuses `TripsService.cancel`, which refunds 100% and adds no platform fee.
  - `reschedule` reuses `TripsService.reschedule` with the audit reason `weather_reschedule`.
  - Both record the decision in the same transaction (new `TripScheduleChangeOptions.withinTransaction`).
- **Admin — `POST /admin/trips/:tripId/weather-decision`:** within 3 days.
  - `keep`, `reschedule`, `cancel` and `pause` need a Red forecast; `resume` does not.
  - `pause` sets `weather_paused_at`. A paused Trip:
    - refuses new bookings (`BookingsService.assertTripEligible` and `TripsService.reserveSeats`);
    - is not moved to `ongoing` by the status schedule.
  - Any other Admin decision lifts the pause.
  - Cancel and reschedule pass `actingAsAdmin`, skipping the owner check.
- **Reads:**
  - `GET /trips/:tripId/weather-decisions`: decision log and pause state, for the owning Host or an Admin;
  - `GET /admin/weather-interventions`: Trips needing an Admin now (`no_response` / `host_kept`), most urgent first;
  - `GET /me/weather-decision-alerts` and `PATCH /me/weather-decision-alerts/:id/read`.
- **Realtime:** `trip.weather.decision_required` to each recipient's user room. Email is not part of this task.
- **Camper — `POST /bookings/:bookingId/weather-reschedule-response` `{ accept }`:**
  - only for the caller's `pending_reconfirmation` booking, when the Trip's latest reschedule audit is `weather_reschedule`;
  - `accept` sets the booking back to `confirmed`;
  - `decline` cancels the booking and its active equipment rentals, creates a 100% refund obligation and recomputes seats.
  - The general reconfirmation flow (CTMS-160) is not touched.
- **Worker `TripWeatherDecisionWorker`:** enabled by `TRIP_WEATHER_DECISION_WORKER_ENABLED`, interval `TRIP_WEATHER_DECISION_INTERVAL_MS` (default 15 min); integration tests turn it off.
- **Retention:** the CTMS-93 history trim keeps forecasts referenced by a decision or a reminder.
- **Small changes to existing code:**
  - `TripsRepository.createIdempotentRefund` is now public, for the decline refund;
  - `LockedTripForBooking` gets an optional `weatherPausedAt`.

## 14. Test Evidence — Weather decision near departure

- **Unit** (`trip-weather-decision.spec.ts`, 19 tests):
  - window and late flag;
  - milestones at T-48h / T-24h / T-12h / T-6h, Host keep, stop conditions;
  - urgency and wording;
  - Host keep, cancel, reschedule and refusals;
  - Admin pause, resume and cancel;
  - access to the log;
  - intervention ordering;
  - alert fan-out and failure isolation;
  - worker.
- **Integration** (`test/trip-weather-decisions.integration-spec.ts`, real PostgreSQL, 5 tests):
  - Host keep → Admin reminder and socket push → listed in the interventions → Admin cancel → Trip cancelled with a 500 000đ refund, and the log shows both decisions;
  - no Host answer → T-48h Host reminder and T-24h Admin reminder, sent once, then T-12h "urgent"; read flow with 404 for another user; a late Host cancel is flagged `late`;
  - refusals: outside 3 days, Green forecast, another Host, an invalid decision;
  - Admin pause blocks `reserveSeats` and further Host decisions; resume after the forecast turned Green re-opens booking;
  - weather reschedule: accept → `confirmed`; decline → `cancelled` with a 100% refund; an ordinary reschedule cannot use the decline.
- **Gates:**
  - `pnpm lint:all`: 0 errors (12 warnings, all pre-existing).
  - `pnpm build:all`: passed.
  - API unit: 2221/2223. The 2 failures are the known `package-readiness.spec.ts` ones.
  - Integration, 8 shards with `--runInBand`: only failures that already exist on develop.
    - The 28 baseline failures: sync-evaluation 4, overbooking-evaluation 4, trekking-route-checkpoints 2, incidents.report 1, trip-reviews 1, review-analysis 16.
    - `gps-tracking` 1: stale test after CTMS-64.
    - Shard 4 crashed Jest on the first run (known on this machine); rerun alone it gave 136/137 with only `trip-reviews` failing.
  - Related suites (bookings.create, bookings.cancel, trips.auto-cancel, trips.status-schedule, trip-weather-monitoring): all passed.
  - Default E2E: 56 passed / 38 failed / 32 did not run, the same as the baseline.

## 15. Implementation Record — Weather decision near departure (UI, Jira CTMS-60)

- **Scope:** web only (`apps/web`), on top of the CTMS-98 API; no API change, no mobile. It reuses the existing cards, buttons, `ConfirmModal`, `Modal`, `StatusBadge` and the admin layout.
- **API wiring:**
  - `core/api/endpoints.ts`: Trip decision, decision log and Admin decision endpoints; reminders, interventions and the Camper reschedule answer.
  - `core/api/queryKeys.ts`: `weather.decisionAlerts`, `weather.interventions`, `weather.decisionLog`.
- **New feature `features/weather-decisions`:**
  - `types.ts` and `services/weather-decisions.service.ts`.
  - `hooks/useWeatherDecisions.ts`:
    - log, mutation (refreshes the log, the intervention list and the reminders) and interventions;
    - reminders poll every 60 s, and `trip.weather.decision_required` refreshes the reminders, the interventions and that Trip's log;
    - Camper reschedule answer.
  - `utils/weather-decision-labels.ts`: decision and urgency labels, the T-24h check, and Vietnamese messages for each CTMS-98 refusal (outside 3 days, not Red, Admin already decided, pause state, not a weather reschedule…).
  - `components/WeatherDecisionForm.tsx`: Keep / Reschedule / Cancel (plus Admin Pause / Resume).
    - Validation: mandatory reason; safety plan for a Host keep; new dates at least 24 h ahead with the end after the start.
    - A confirm dialog states the consequence.
  - `components/WeatherDecisionLog.tsx`: decider, decision, risk level, late flag, reason and safety plan.
  - `components/HostWeatherDecisionCard.tsx`, on the Trip detail page above "Vận hành chuyến đi", for the owning Host of a published Trip:
    - shown only when the Trip is within 3 days and the latest forecast is Red, or when it already has decisions;
    - warns after T-24h that the decision is recorded as late;
    - shows the Admin pause, and locks the form once an Admin acted;
    - reloads the Trip after a cancel or reschedule.
  - `pages/AdminWeatherInterventionsPage.tsx`, at `/admin/weather-interventions`, new "Can thiệp thời tiết" item in `AdminSidebar`:
    - list sorted by the server, with urgency badge, reason and pause state;
    - `components/AdminWeatherDecisionDialog.tsx` shows the Host's keep reason and safety plan, the decision form (Resume first when paused) and the log.
  - `components/WeatherRescheduleResponseCard.tsx`, on the Booking detail page while the booking is `pending_reconfirmation`:
    - shows the new dates and "Giữ chỗ ở lịch mới" / "Huỷ và hoàn 100%";
    - the server's 409 for an ordinary reschedule is explained in Vietnamese.
    - The booking API does not say whether a reschedule was for weather, so the card is shown for every pending reconfirmation. Hiding it for ordinary reschedules needs an API field (separate task).
- **Weather inbox (`WeatherChangeNotices`):**
  - new `includeChanges` / `includeDecisions` options;
  - Hosts see "Cần quyết định" reminders above "Thay đổi dự báo", and the unread count adds both;
  - Admins get the bell in `AdminSidebar` with reminders only, linking to the intervention page;
  - Campers are unchanged.

## 16. Test Evidence — CTMS-60

- **Vitest:**
  - `WeatherDecisionComponents.test.tsx` (9): Host card hidden when not Red; keep validation and payload; cancel after T-24h with the late warning and a Trip reload; reschedule date checks; Vietnamese 409; locked after an Admin pause with the log; Camper keep, decline and the not-weather 409.
  - `AdminWeatherInterventionsPage.test.tsx` (4): list with urgency, reason and pause; empty state; pause with a reason refreshes the list; Resume first for a paused Trip with the Host's keep reason.
  - `WeatherChangeNotices.test.tsx` (+3): Host sees both sections and counts both; Admin reminders only, linking to the intervention page and marked read; `trip.weather.decision_required` reloads them.
- **Playwright** (`tests/e2e/ctms-60-weather-decision-ui.spec.ts`, mocked backend, 3 tests):
  - Host keeps a Red Trip with a reason and a safety plan;
  - Admin pauses from the intervention list, then resumes;
  - Camper declines a weather reschedule.
- **Gates:**
  - `lint:all`: 0 errors (12 pre-existing warnings in files not touched by this task).
  - `build:all`: passed.
  - Web `test:all`: 257 files, 1720/1720 tests passed.
  - Default Playwright E2E: 59 passed / 38 failed / 32 did not run. Baseline was 56 / 38 / 32; the 3 new CTMS-60 tests pass and the 38 failures are the same known real-backend and map failures.

## 17. Implementation Record — Host weather penalty (Logic, Jira CTMS-94)

Policy: `docs/features/weather-trip-date-decision-policy.md` §6 and §7. The leader agreed to reuse the Done key CTMS-94 for this task.

- **Migration `1794800000000-AddHostWeatherPenalties`:** table `host_weather_penalties`, one row per (Trip, schedule) (`UQ_host_weather_penalties_schedule`). Each row stores:
  - violation number, paid booking value, rate, cap, amount, deducted amount;
  - status `applied` / `waived` and the tier-2 `hosting_blocked_until`;
  - the waiver request (reason, evidence URLs, deadline, review due date) and the Admin review (decision, reviewer, note).
- **Rules (`host-weather-penalty.policy.ts`, all numbers in one place):**
  - tiers 5% / 10% / 15% with caps 2M / 5M / 10M đ; violation 3+ uses the last tier;
  - violations counted over 90 days, waived ones excluded;
  - the amount is computed in integer minor units, like the settlement.
- **When a penalty is created:** in the same transaction as the **first** Admin decision for the current schedule, only when the decision is at or after T-24h and the Host has no on-time decision (no answer, or only a late one). The paid booking value (`payment_status = 'paid'`, booking still confirmed / pending reconfirmation / completed) is read before a cancel or reschedule changes the bookings. A Postgres advisory lock per Host keeps violation numbers unique. The Host gets the socket event `host.weather_penalty.created`.
- **Hosting restriction:** `TripsService.create` and `submitForApproval` return 403 with `blockedUntil` while:
  - a tier-2 block (14 days) is running, or
  - 3 or more applied penalties fall in the last 90 days (tier 3, see PD-2).
- **Settlement (CTMS-112):**
  - `settleTrip` still stores the 95% snapshot and credits the wallet as before;
  - right after, `deductOutstandingWeatherPenalties` takes outstanding penalties from the balance, oldest first, writing one `penalty_debit` ledger row each;
  - what does not fit stays as debt (`outstandingAmount`) for the next settlement. A Trip the Admin cancelled has no settlement, so its penalty is taken from the Host's next ones.
- **Waiver:**
  - `POST /host/weather-penalties/:id/waiver-request` (Host, once, until 72 h after T-24h, reason and 1–5 evidence URLs from `POST /uploads/document`); Admins get `weather_penalty.waiver_requested`;
  - `POST /admin/weather-penalties/:id/waiver-review` (`approve`, mandatory `note`):
    - approve: status `waived`, not counted any more, block lifted, the deducted amount goes back to the wallet as `penalty_refund`;
    - reject: the penalty stays, with the note;
  - `reviewDueAt` = 5 working days after the request (display only).
- **Read APIs:**
  - `GET /me/weather-penalties` (Host): items, `outstandingTotal`, `hostingBlockedUntil`, `suspended`;
  - `GET /admin/weather-penalties?status=applied|waived|waiver_pending` and `GET /admin/weather-penalties/:id`.
- **Audit:** `host.weather_penalty_created`, `host.weather_penalty_waiver_requested`, `host.weather_penalty_waiver_reviewed`; the settlement audit adds `weatherPenaltyDeducted`.
- **Camper refunds are unchanged** and never depend on a waiver.

### Pending Decisions (for the leader)
- **PD-1:** A late Host decision with no Admin intervention is **not** penalised (only flagged `late`), reading §6 "Admin phải can thiệp" literally.
- **PD-2:** Tier 3 "đình chỉ Host" = cannot create or submit Trips while 3+ applied penalties fall in 90 days. The account is not locked automatically; the Admin can use the existing account lock.
- **PD-3:** "Trừ điểm uy tín Host" is not implemented: the system has no Host reputation score yet.
- **PD-4:** The §6 numbers are still marked "đề xuất" (§8); they live only in `host-weather-penalty.policy.ts`.
- **PD-5:** Waiving a penalty does not renumber penalties created after it.

## 18. Test Evidence — CTMS-94

- **Unit:**
  - `host-weather-penalty.policy.spec.ts` (6): tiers and caps, minor-unit amount, 14-day block, 90-day suspension and when it lifts, when a penalty is due, waiver deadline and 5 working days;
  - `trip-weather-decision.spec.ts` (+2): penalty on the first late Admin decision with the booking value read first; none before T-24h, after an on-time Keep, or on a second Admin decision;
  - `trips.service.spec.ts` (+1): create refused with 403 while blocked;
  - `settlements.service.spec.ts`: unchanged cases still pass with the deduction step.
- **Integration** (`test/host-weather-penalties.integration-spec.ts`, real Postgres, 5):
  - no answer → 5% of 50M capped at 2M, audit row and socket event; pause → resume penalises once;
  - no penalty before T-24h or after an on-time Host Keep;
  - 2nd violation → 10% and 14-day block, `submitForApproval` 403; waiver approved → waived, block lifted, not counted (next one is violation 2); late waiver 409, other Host 404;
  - real `settleTrip`: 570,000đ net fully taken by a 1,000,000đ penalty, 430,000đ debt left, ledger rows; waiver approved → 570,000đ back in the wallet;
  - rejected waiver stays applied with the note.
- **Gates:**
  - API `lint` (eslint): passed; `build`: passed.
  - API unit (`jest`): 189 suites, 2303/2303 tests passed.
  - API integration (8 shards, `--runInBand --forceExit`): 781 passed, 29 failed. All 29 are the known failures already on develop: sync-evaluation 4, overbooking-evaluation 4, trekking-route-checkpoints 2, incidents.report 1, trip-reviews 1, review-analysis 16, gps-tracking 1.
  - Shards 1 and 2 crashed Jest on this machine, so their 20 suites were run one by one: all pass except sync-evaluation (known). In shard 8, trip-weather-monitoring failed only in its cleanup (a leftover forecast still used its weather rule); run alone it passes 4/4.
  - New suite `host-weather-penalties.integration-spec.ts`: 5/5; `trip-weather-decisions.integration-spec.ts`: 5/5.

## 19. Implementation Record — Host weather penalty (UI, Jira CTMS-102)

UI of §17 (CTMS-94 API). The leader agreed to reuse the Done key CTMS-102 for this task.

- **API gap filled (minimal):** `POST /uploads/document` (JWT, image JPG/PNG/WEBP or PDF, 5 MB) in `uploads.controller.ts`, calling the existing `UploadsService.uploadDocument`. Before this only `/uploads/image` was public, so a Host could not attach a PDF as waiver evidence. Unit test `uploads.controller.spec.ts`.
- **New web feature `apps/web/src/features/weather-penalties/`:** types, service, hooks (React Query and realtime), labels and error mapping, components, Admin page.
- **Host (Ví Host page, `/host/wallet`):** `HostWeatherPenaltiesCard`, placed between the balance card and the bank accounts.
  - **Hidden when the Host has no penalty**, so the page is unchanged for everyone else.
  - Shows the debt still to deduct, a red banner while hosting is blocked or suspended, and each penalty: Trip, violation number, booking value, rate and cap, amount and deducted amount, debt, and status (Đang áp dụng / Chờ duyệt miễn / Bị từ chối miễn / Đã miễn) with the Admin's note.
  - The "Xin miễn phạt" button appears only while the waiver is still allowed (applied, not yet asked, before the deadline). It opens `WeatherPenaltyWaiverModal`:
    - reason (required);
    - 1–5 evidence files (JPG / PNG / WEBP / PDF, 5 MB each, checked before upload, uploaded one by one to `/uploads/document?folder=weather-penalty-waivers`, removable);
    - confirm dialog;
    - server 409s shown in Vietnamese.
  - `host.weather_penalty.created` reloads the card and shows a toast.
- **Wallet history:** labels for `penalty_debit` ("Trừ phạt thời tiết") and `penalty_refund` ("Hoàn phạt thời tiết đã miễn") in `settlements/constants.ts`.
- **Admin page `/admin/weather-penalties`:** sidebar item "Phạt thời tiết" under "Can thiệp thời tiết".
  - Filter tabs: Chờ duyệt miễn (default) / Đang áp dụng / Đã miễn / Tất cả.
  - Each row shows Host, violation, amount, debt, status, review due date, and "Quá hạn xem xét" after the 5 working days.
  - `AdminWeatherPenaltyDialog` shows the whole penalty, the Host's reason and evidence links, and the Duyệt miễn / Từ chối form (note required, confirm dialog; approving warns that the deducted amount goes back to the Host wallet).
  - `weather_penalty.waiver_requested` reloads the list.
- **Blocked Host on Trip create / submit:** `mapCreateTripError` and `mapConfigureTripWaypointsError` turn the 403 with `blockedUntil` into "Bạn đang bị khoá tạo Trip do phạt thời tiết đến dd/mm/yyyy" (or the suspension text). Other errors are unchanged.

## 20. Test Evidence — CTMS-102

- **Vitest:**
  - `WeatherPenaltyComponents.test.tsx` (7): card hidden without penalties; debt, block banner and statuses; no waiver button after the deadline or once asked, and the suspension text; waiver flow (reason and file checks, upload, payload after confirm); Vietnamese 409 for a closed window; `host.weather_penalty.created` reload; `hostingBlockedMessage` for block, suspension and other errors.
  - `AdminWeatherPenaltiesPage.test.tsx` (4): pending waivers first and filter switching; overdue flag; approve with evidence link, mandatory note and refund warning; reject, and no form when the Host has not asked.
- **API unit:** `uploads.controller.spec.ts` (1).
- **Playwright** (`tests/e2e/ctms-102-weather-penalty-ui.spec.ts`, mocked backend, 2 tests):
  - Host sees the penalty and the `penalty_debit` row on the wallet, asks for a waiver with a PDF;
  - Admin approves a waiver from the list.
- **Screenshots:** Host penalty card, waiver modal, Admin list, Admin review dialog.
- **Gates:** API `lint` / `build` pass; API unit 190 suites / 2305 tests pass; web `lint:all` 0 errors (12 warnings, none in CTMS-102 files); `build:all` pass (a first run caught 2 test-only mock typing errors, fixed with `vi.mocked`); web Vitest 259 files / 1731 tests pass; `test:all` stops at `@ctms/ai` because this machine has no `pytest` (unrelated to this change). Integration shards 1–8: only the 29 known baseline failures (sync-evaluation 4, overbooking-evaluation 4, trekking-route-checkpoints 2, incidents.report 1, trip-reviews 1, review-analysis 16, gps-tracking 1). Default Playwright E2E: 61 passed / 38 failed / 32 did not run, i.e. baseline 59 / 38 / 32 plus the 2 new `ctms-102-weather-penalty-ui.spec.ts` tests passing.

## 21. Implementation Record — Weather reschedule marker on the Booking (API, Jira CTMS-58)

- **Problem:** the CTMS-60 Camper card ("Giữ chỗ ở lịch mới" / "Huỷ và hoàn 100%") was shown for every `pending_reconfirmation` Booking, because the Booking API did not say whether the reschedule was for weather. After an ordinary Host reschedule the decline button only returned a 409.
- **API:** `GET /bookings/:bookingId` (and `POST /bookings/:bookingId/sync-payment`, which uses the same query) now returns `weatherReschedulePending: boolean`.
  - `true` only when the Booking is `pending_reconfirmation` **and** the Trip's latest `trip.rescheduled` audit log has the reason `weather_reschedule`;
  - this is the same rule as `TripWeatherDecisionsRepository.lastRescheduleWasForWeather`, which guards `POST /bookings/:bookingId/weather-reschedule-response`, so the flag is `true` exactly when that endpoint accepts the answer;
  - computed in `BookingsRepository.findDetailsByIdForOwner` with a subquery on `audit_logs` (indexed on `target_type`, `target_id`); no migration, no new table.
- **Web:** `BookingDetails.weatherReschedulePending?` added; `BookingDetailsView` shows `WeatherRescheduleResponseCard` only when the flag is `true`. The card itself and the general reconfirmation flow (CTMS-160) are unchanged.
- **Out of scope:** the Booking list endpoint and the mobile app; CTMS-62 (Camper mobile weather) reads the flag from the Booking detail.

## 22. Test Evidence — CTMS-58

- **API unit:** `bookings.repository.spec.ts` checks the detail SQL selects `weatherReschedulePending` with the status, reason, action and latest-row conditions.
- **Integration** (`test/trip-weather-decisions.integration-spec.ts`, weather reschedule case): flag `false` before the decision, `true` for both Campers after the Host's weather reschedule, `false` after accept and after decline, and `false` after an ordinary Host reschedule.
- **Web unit:** `BookingDetailsView.test.tsx` — card shown when the flag is `true`, hidden when `false` or missing.
- **Playwright:** the CTMS-60 Camper mock now returns `weatherReschedulePending: true`.
- **Gates:** `lint:all` 0 errors (12 existing warnings, none in CTMS-58 files); `build:all` pass; web Vitest 259 files / 1732 tests pass; API unit 190 suites / 2305 tests pass (`test:all` is run per package because this machine has no `pytest` for `@ctms/ai`). Integration shards 1–8: only the 29 known baseline failures (sync-evaluation 4, overbooking-evaluation 4, trekking-route-checkpoints 2, incidents.report 1, trip-reviews 1, review-analysis 16, gps-tracking 1); shards 2 and 4 crashed Jest, so their suites were run one by one (`trip-weather-decisions` 5/5, `bookings.detail` pass; `demand-insights` failed once after the crash and passed 52/52 on rerun; `trip-weather-monitoring` 4/4 alone). Default Playwright E2E: 61 passed / 38 failed / 32 did not run, same as the baseline; the 3 CTMS-60 tests pass.
