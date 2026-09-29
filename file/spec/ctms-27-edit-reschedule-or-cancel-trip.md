# CTMS-027 — Edit, Reschedule, or Cancel Trip

## 1. Overview

Story: CTMS-027
Epic: EPIC 4. Trip Management
Use Case: Edit, Reschedule, or Cancel Trip
Priority: Must Have

Goal:
Allow the owning Host to edit, reschedule, or cancel a Trip they organize without breaking existing Camper, Porter, Equipment, refund, audit, or notification commitments.

Acceptance summary:
Only the owning Host may edit, reschedule, or cancel the Trip. Reschedule may change only `starts_at` and/or `ends_at`, and only when `new_starts_at > rescheduled_at + 24h`. A successful reschedule moves active Camper Bookings and Porter Assignments to Pending Reconfirmation with a T-24h response deadline. Camper acceptance preserves Booking, slot, and paid/snapshot price. Camper decline or timeout cancels the Booking, releases the slot, and creates a Full Refund. Porter acceptance preserves assignment. Porter decline or timeout unassigns the Porter and opens replacement. Required Porter coverage must be complete by T-12h or the Trip is cancelled and active Campers receive Full Refunds. Active Equipment Reservations must be revalidated against the new schedule. Available Equipment Reservations move to the new schedule with quantity and paid/snapshot amount preserved. Unavailable optional Equipment cancels only the Equipment Reservation, preserves the Trip Booking, and creates a Full Refund for the Equipment portion. Refunds must be idempotent. Reschedule and commitment changes must be audited, and notifications may be emitted only after the relevant change commits.

## 2. Scope

### In Scope

- Owning-Host edit, reschedule, and cancellation rules for an existing Trip.
- Reschedule constraints for `starts_at` and `ends_at`.
- Commitment handling for active Camper Bookings, Porter Assignments, and active Equipment Reservations affected by reschedule.
- Reconfirmation deadlines, timeout behavior, refunds, audit records, and post-commit notifications required by the approved rules.

### Out of Scope

- Creating a Trip. CTMS-021 owns Trip creation.
- Configuring Trip waypoints. CTMS-022 owns waypoint creation and ordering.
- Admin approval and publication. CTMS-023 owns approval and publish behavior.
- Ordinary refund workflow details outside the refund events explicitly triggered by cancellation or reschedule behavior here.
- Material Trip changes that are not reschedule, such as route/version, meeting point, province/city snapshot, capacity, price, or Trip waypoints. Those changes must use the edit/reapproval flow, not the reschedule path.

## 3. Actors & Authorization

- Host: may edit, reschedule, or cancel only Trips they own.
- Backend API: enforces ownership, current Trip state, allowed field changes, commitment handling, audit, refund idempotency, and post-commit notification behavior.
- Camper: responds to a rescheduled Trip through Accept, Decline, or timeout behavior.
- Porter: responds to a rescheduled Trip through Accept, Decline, or timeout behavior.
- System: processes reconfirmation timeouts, Porter staffing deadline checks, refund idempotency, audit persistence, and notification enqueueing.

Only the Host who owns the Trip may start the edit, reschedule, or cancel action. A non-owning Host, Camper, Porter, or unauthenticated caller must be rejected before any Trip or commitment state changes.

## 4. Preconditions & Dependencies

- Trip exists.
- The caller is authenticated as the owning Host for the Trip.
- The Trip is in a state that allows the requested edit, reschedule, or cancellation.
- Reschedule applies only to an approved Trip that has not started.
- Reschedule input changes only `starts_at` and/or `ends_at`.
- CTMS-021 Trip creation and CTMS-022 Trip waypoint data already exist where relevant.

## 5. Business Rules

| BR | Rule |
|---|---|
| BR-063 | A Trip may move to `cancelled` only from a Trip lifecycle state that allows cancellation. The owning Host may cancel before the Trip is `completed`. If a published Trip has Booking, Porter, or Equipment commitments, cancellation must revalidate current state, cancel or release commitments according to policy, create refunds when cancellation/refund policy requires them, record reason and audit data, and notify only after commit. A `completed` Trip must not move back to `cancelled`; `rejected` is not a valid Trip status. |
| BR-076 | Only the Host who owns the Trip may edit it. Trips in `ongoing`, `completed`, or `cancelled` must not have planned fields edited except through a specialized flow explicitly allowed by the specification. |
| BR-077 | After a Trip is published or approved, changing `starts_at` and/or `ends_at` must use the Reschedule flow and obey BR-444 through BR-464. Material changes such as route/version, meeting point, province/city snapshot, capacity, price, or Trip waypoints are not Reschedule and must use the corresponding edit/reapproval flow. |
| BR-078 | Any Edit, Reschedule, or Cancel action that affects commitments must be audited. Notifications to affected Campers, Porters, or Hosts may be enqueued or sent only after the transaction that updates the Trip and related states commits successfully. |
| BR-174 | Inputs must be validated for required fields, formats, identifiers, enum values, and cross-entity references before any write is committed. |
| BR-180 | Stateful resources must follow defined state transitions and must not use enum values outside the database or API contract. |
| BR-181 | Before updating state, the backend must verify the current persisted state; stale requests must fail with a business conflict. |
| BR-191 | Critical actions must write an audit record containing actor, action, target, timestamp, before/after values or reason, and affected business identifiers. |
| BR-192 | Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, unnecessary health data, or private payloads beyond the audit need. |
| BR-212 | Any Business Rule, enum, state transition, or API contract change must update the spec, tests, and data documentation before the story is Done. |
| BR-213 | Every mapped Business Rule must have at least one valid-path test and one violation-path test; concurrency, idempotency, and transaction rules require integration or E2E coverage. |
| BR-444 | The Host may reschedule only a Trip they manage, and only when the Trip is approved and has not started. Reschedule may change only `starts_at` and/or `ends_at`. |
| BR-445 | Reschedule must not change other approved Trip information, including Trip price, route, capacity, or Trip policies. Those changes must use their matching flow instead of Reschedule. |
| BR-446 | The Host may reschedule only when the new start time is more than 24 hours after the reschedule action time: `new_starts_at > rescheduled_at + 24h`. |
| BR-447 | `new_ends_at` must be after `new_starts_at`, and the new schedule must satisfy current Trip time constraints. If validation fails, the new schedule must not be applied. |
| BR-448 | After successful reschedule, all Campers with active Bookings and all assigned Porters must move to Pending Reconfirmation for the new schedule. |
| BR-449 | Campers and Porters must Accept or Decline the new schedule no later than 24 hours before `new_starts_at`. |
| BR-450 | If a Camper or Porter has not accepted before the reconfirmation deadline, `new_starts_at - 24h`, the system must process the missing response as Decline. |
| BR-451 | If a Camper accepts the new schedule, the Camper's Booking and slot are preserved, and the paid or snapshotted Trip price must not change because of the reschedule. |
| BR-452 | If a Camper declines or times out, the Booking must be cancelled, the slot must be released, and the Camper must receive a Full Refund for the Booking amount affected by the reschedule. |
| BR-453 | If a Porter accepts the new schedule, the current Porter Assignment remains valid for the new schedule. |
| BR-454 | If a Porter declines or times out, the Porter must be unassigned from the Trip and the corresponding Porter position must reopen for replacement. |
| BR-455 | The system may find and assign a replacement Porter from the reconfirmation deadline until 12 hours before `new_starts_at`. |
| BR-456 | All required Porter positions must be assigned and fully confirmed no later than 12 hours before `new_starts_at`. |
| BR-457 | If the Trip still lacks required Porter staffing at `new_starts_at - 12h`, the Trip must be cancelled and all Campers with remaining active Bookings must receive Full Refunds. |
| BR-458 | After successful reschedule, every active Equipment Reservation affected by the Trip schedule must be revalidated for availability under the new schedule. |
| BR-459 | If Equipment remains available for the new schedule, the Equipment Reservation must move to the new schedule and preserve quantity and the paid or snapshotted amount. |
| BR-460 | If optional Equipment is no longer available for the new schedule, the affected Equipment Reservation must be cancelled. Cancelling optional Equipment must not automatically cancel the Camper's Trip Booking. |
| BR-461 | If paid Equipment is cancelled because it is unavailable after reschedule, the system must create or record a Full Refund for the cancelled Equipment portion under the current refund process. |
| BR-462 | Equipment refunds must use the amount the Camper actually paid or the amount snapshotted at Booking time. The current Equipment price must not be used for the refund amount. |
| BR-463 | Refund processing must be idempotent. A Trip or Equipment amount that has already been refunded must not be refunded a second time if the Booking or Trip is later cancelled again. |
| BR-464 | Reschedule and resulting commitment changes must be audited with at least old schedule, new schedule, acting Host, reschedule time, and reconfirmation or revalidation outcomes. Notifications may be sent only after the corresponding change commits successfully. |

## 6. State & Lifecycle

Trip:

```text
approved/published
    ├── Reschedule before start -> schedule updated, commitments enter reconfirmation
    ├── Cancel before completed -> cancelled
    └── Start/complete handled outside this story

completed and cancelled are terminal for this story.
```

Camper Booking after successful reschedule:

```text
Active Booking
    -> Pending Reconfirmation
        ├── Accept before T-24h -> Active Booking preserved
        └── Decline or timeout at T-24h -> Booking cancelled, slot released, Full Refund created
```

Porter Assignment after successful reschedule:

```text
Assigned Porter
    -> Pending Reconfirmation
        ├── Accept before T-24h -> Assignment preserved
        └── Decline or timeout at T-24h -> Porter unassigned, position reopened

Required Porter positions must be confirmed by T-12h or the Trip is cancelled.
```

Equipment Reservation after successful reschedule:

```text
Active Equipment Reservation
    ├── Available under new schedule -> move reservation, preserve quantity and paid/snapshot amount
    └── Optional Equipment unavailable -> cancel Equipment Reservation only and refund Equipment portion
```

## 7. Business Flow

### 7.1 Edit Non-Schedule Trip Details

1. Owning Host submits an edit request for a Trip.
2. Backend verifies the Host owns the Trip and the current Trip state allows the requested edit.
3. Backend rejects edits to `ongoing`, `completed`, or `cancelled` Trips unless a specialized approved flow allows the change.
4. If the requested change is a material non-reschedule change, such as route/version, meeting point, province/city snapshot, capacity, price, or waypoints, backend routes it to the matching edit/reapproval flow instead of treating it as Reschedule.
5. If the edit affects commitments, backend audits the change and sends notifications only after the state transaction commits.

### 7.2 Reschedule Trip

1. Owning Host submits new `starts_at` and/or `ends_at`.
2. Backend confirms the Trip is approved, has not started, and the payload changes no other approved Trip data.
3. Backend verifies `new_starts_at > rescheduled_at + 24h`, `new_ends_at > new_starts_at`, and all Trip time constraints.
4. Backend commits the new schedule and moves active Camper Bookings and assigned Porters to Pending Reconfirmation.
5. Backend revalidates active Equipment Reservations against the new schedule.
6. Available Equipment Reservations move to the new schedule with quantity and paid/snapshot amount preserved.
7. Unavailable optional Equipment Reservations are cancelled without cancelling the Camper Trip Booking, and paid Equipment portions receive Full Refunds.
8. Backend writes audit records for the schedule and commitment changes.
9. Notifications are enqueued only after the corresponding committed changes exist.

### 7.3 Reconfirmation and Staffing Deadlines

1. Camper Accept before T-24h preserves Booking, slot, and paid/snapshot Trip price.
2. Camper Decline or no acceptance by T-24h cancels the Booking, releases the slot, and creates a Full Refund.
3. Porter Accept before T-24h preserves the current assignment.
4. Porter Decline or no acceptance by T-24h unassigns the Porter and opens the position for replacement.
5. Replacement Porter assignment may occur after the reconfirmation deadline and before T-12h.
6. If all required Porter positions are not assigned and confirmed by T-12h, backend cancels the Trip and creates Full Refunds for active Campers.

### 7.4 Cancel Trip

1. Owning Host submits cancellation with a reason.
2. Backend verifies the Trip is in a cancellable lifecycle state and is not `completed`.
3. Backend revalidates active Booking, Porter, and Equipment commitments.
4. Backend cancels or releases affected commitments according to policy and creates required refunds idempotently.
5. Backend commits Trip cancellation, audit, and commitment outcomes before notifications are emitted.

## 8. Data & Invariants

- Trip ownership controls who may edit, reschedule, or cancel.
- Reschedule may mutate only `starts_at` and/or `ends_at`.
- `rescheduled_at` is the authoritative server/database time used for the `new_starts_at > rescheduled_at + 24h` check.
- Existing Trip price, route, capacity, policies, and material approved fields must not change through Reschedule.
- An active Camper Booking in Pending Reconfirmation continues to reserve its slot until Accept, Decline, or timeout behavior resolves it.
- Camper Accept preserves Booking ID, slot, and paid/snapshot Trip price.
- Camper Decline or timeout releases the slot and creates a Full Refund for the affected Booking amount.
- Porter Accept preserves the assignment.
- Porter Decline or timeout removes the Porter from the assignment and reopens the required position.
- Required Porter staffing is evaluated at `new_starts_at - 12h`.
- Equipment Reservation movement preserves quantity and paid/snapshot amount when Equipment remains available.
- Optional Equipment unavailability cancels only the Equipment Reservation, not the Trip Booking.
- Refund records must be idempotent by refunded Trip or Equipment amount so later cancellation cannot refund the same amount twice.
- Audit records must capture old schedule, new schedule, acting Host, reschedule time, and reconfirmation or revalidation outcomes without storing unnecessary sensitive data.

## 9. API / Integration Contract

TBD — Technical Design.

No current controller contract for edit, reschedule, or cancel Trip was confirmed in the implementation. Do not treat endpoint or DTO names as product Open Decisions.

## 10. Error & Edge Cases

| Case | Expected Behavior |
|---|---|
| Caller is not authenticated | Reject before reading protected Trip details. |
| Caller is not the owning Host | Reject with no Trip, Booking, Porter, Equipment, refund, audit, or notification side effects. |
| Trip is `completed` | Reject cancellation or edit; do not move the Trip back to `cancelled`. |
| Trip is `ongoing`, `completed`, or `cancelled` and Host edits planned fields | Reject unless a specialized approved flow explicitly allows that change. |
| Reschedule request changes price, route, capacity, policy, meeting point, province/city snapshot, or waypoints | Reject as Reschedule; require the matching edit/reapproval flow. |
| `new_starts_at = rescheduled_at + 24h` | Reject because the rule requires strictly greater than 24 hours. |
| `new_starts_at < rescheduled_at + 24h` | Reject and keep the existing schedule unchanged. |
| `new_ends_at <= new_starts_at` | Reject and keep the existing schedule unchanged. |
| Camper does not respond by T-24h | Treat as Decline, cancel Booking, release slot, and create Full Refund. |
| Porter does not respond by T-24h | Treat as Decline, unassign Porter, and reopen the position. |
| Required Porter positions remain unconfirmed at T-12h | Cancel Trip and create Full Refunds for active Camper Bookings. |
| Optional Equipment unavailable under new schedule | Cancel only the Equipment Reservation, preserve the Trip Booking, and refund the paid Equipment portion. |
| Refund already exists for the same Trip or Equipment amount | Do not create a second refund. |
| Audit write fails for a commitment-changing action | Do not report successful edit, reschedule, or cancel completion. |
| Notification enqueue fails before transaction commit | Do not emit pre-commit notifications; retry or surface failure according to the post-commit notification mechanism. |

## 11. Acceptance & Test Matrix

| BR / AC | Scenario | Expected Result | Test Type |
|---|---|---|---|
| PB AC, BR-076 | Non-owning Host attempts to edit, reschedule, or cancel another Host's Trip | Request is rejected and no Trip or commitment state changes | Authorization |
| PB AC, BR-076 | Owning Host edits a planned field on an `ongoing`, `completed`, or `cancelled` Trip | Edit is rejected unless an approved specialized flow allows it | State / Integration |
| BR-063 | Owning Host cancels a cancellable published Trip with active commitments | Trip moves to `cancelled`, affected commitments are released or cancelled by policy, required refunds are created, reason/audit are recorded, and notifications occur only after commit | Integration |
| BR-063 | Owning Host attempts to cancel a `completed` Trip | Cancellation is rejected and Trip remains `completed` | Boundary |
| BR-077, BR-445 | Host includes price, route, capacity, policy, meeting point, province/city snapshot, or waypoint changes in a Reschedule request | Reschedule is rejected or routed to the correct edit/reapproval flow; approved Trip data is not silently changed | Integration |
| BR-444 | Owning Host reschedules an approved Trip that has not started and changes only `starts_at` and/or `ends_at` | Schedule change proceeds to validation and reconfirmation handling | Integration |
| BR-444 | Host tries to reschedule a Trip that has already started | Reschedule is rejected and existing schedule remains unchanged | Boundary |
| BR-446 | Host sets `new_starts_at` more than 24 hours after `rescheduled_at` | Reschedule timing rule passes | Boundary |
| BR-446 | Host sets `new_starts_at` exactly 24 hours after `rescheduled_at` | Reschedule is rejected and existing schedule remains unchanged | Boundary |
| BR-446 | Host sets `new_starts_at` less than 24 hours after `rescheduled_at` | Reschedule is rejected and existing schedule remains unchanged | Boundary |
| BR-447 | Host sets `new_ends_at` after `new_starts_at` and current Trip time constraints are satisfied | Schedule validation passes | Boundary |
| BR-447 | Host sets `new_ends_at` equal to or before `new_starts_at` | Reschedule is rejected and existing schedule remains unchanged | Boundary |
| BR-448 | Reschedule commits for a Trip with active Camper Bookings and assigned Porters | Those Bookings and Assignments move to Pending Reconfirmation for the new schedule | Integration |
| BR-449, BR-451 | Camper accepts the new schedule before T-24h | Booking, slot, and paid/snapshot Trip price are preserved | Integration |
| BR-450, BR-452 | Camper does not accept by T-24h | Camper is treated as Decline; Booking is cancelled, slot is released, and Full Refund is created | Scheduled job / Boundary |
| BR-452 | Camper explicitly declines before T-24h | Booking is cancelled, slot is released, and Full Refund is created | Integration |
| BR-449, BR-453 | Porter accepts the new schedule before T-24h | Existing Porter Assignment remains valid for the new schedule | Integration |
| BR-450, BR-454 | Porter does not accept by T-24h | Porter is treated as Decline, unassigned from the Trip, and the position is reopened | Scheduled job / Boundary |
| BR-454 | Porter explicitly declines before T-24h | Porter is unassigned and the position is reopened | Integration |
| BR-455 | Replacement Porter is assigned after T-24h and before T-12h | Replacement assignment is allowed if qualification and conflict checks pass | Integration |
| BR-456 | All required Porter positions are assigned and confirmed before T-12h | Trip remains active for the rescheduled departure | Scheduled job / Integration |
| BR-457 | Required Porter coverage is still insufficient at T-12h | Trip is cancelled and remaining active Campers receive Full Refunds | Scheduled job / Integration |
| BR-458, BR-459 | Active Equipment Reservation is available under the new schedule | Reservation moves to the new schedule and preserves quantity and paid/snapshot amount | Integration |
| BR-458, BR-460, BR-461 | Optional Equipment is unavailable under the new schedule and has been paid | Equipment Reservation is cancelled, Trip Booking remains active, and Full Refund is created for the Equipment portion only | Integration |
| BR-462 | Equipment refund is calculated after Equipment price changed since Booking | Refund uses paid/snapshot amount from Booking, not current Equipment price | Boundary |
| BR-463 | Trip or Equipment amount was already refunded, then a later cancellation path is triggered | No duplicate refund is created for the already refunded amount | Idempotency |
| BR-078, BR-191, BR-464 | Reschedule changes schedule and commitment states | Audit captures old schedule, new schedule, acting Host, reschedule time, and reconfirmation or revalidation outcomes | Integration |
| BR-078, BR-464 | Notification worker observes changes before the transaction commits | No Camper, Porter, or Host notification is emitted before the corresponding state change commits | Transaction / Integration |
| BR-174 | Reschedule request references malformed identifiers or invalid date values | Request is rejected before any write | Validation |
| BR-180, BR-181 | Two clients submit conflicting changes based on stale Trip state | Stale request fails with business conflict and authoritative state remains consistent | Concurrency |
| BR-192 | Audit is written for cancellation, reschedule, refund, or commitment changes | Audit includes required business identifiers and excludes secrets, payment secrets, unnecessary health data, and private payloads beyond audit need | Security |
| BR-212, BR-213 | A rule, enum, state transition, or API contract changes for this story | Spec, tests, and data documentation are updated, and valid/violation coverage exists for affected BRs before Done | Process |

## 12. Open Decisions & References

### 12.1 Open Decisions

None.

### 12.2 References

- Product Backlog v3.1.
- CTMS Business Rules workbook.
- CTMS Architecture Overview.
