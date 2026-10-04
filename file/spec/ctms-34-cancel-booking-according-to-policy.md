# CTMS-034 — Cancel Booking According to Policy

## 1. Overview

Story: CTMS-034

Epic: EPIC 5. Booking and Payment

Use Case: Cancel Booking According to Policy

Priority: Should Have

Goal: Allow the Booking owner to cancel an eligible Booking according to its authoritative cancellation-policy snapshot while releasing commitments and determining refund entitlement consistently.

Backlog story: As a Camper, I want to cancel my Booking according to policy so my Trip slot and related reservations are handled correctly.

Acceptance Criteria:

| Source  | Criterion                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------ |
| PB AC-1 | Only an authorized Booking owner may request Camper cancellation.                                      |
| PB AC-2 | Cancellation eligibility/fee/refund is calculated from the authoritative cancellation-policy snapshot. |
| PB AC-3 | Valid cancellation transitions Booking to cancelled and records cancellation metadata.                 |
| PB AC-4 | Capacity consumed by the Booking is released exactly once.                                             |
| PB AC-5 | Reserved equipment is released according to equipment policy.                                          |
| PB AC-6 | Eligible refund is handed to the refund workflow rather than fabricated by the client.                 |
| PB AC-7 | Cancellation is audited and side effects occur only after authoritative validation.                    |

## 2. Scope

### In Scope

- Camper cancellation request.
- Cancellation policy evaluation.
- Cancellation metadata.
- Seat release.
- Equipment reservation release.
- Refund entitlement calculation/creation.
- Audit.

### Out of Scope

- Trip cancellation.
- Refund provider execution; CTMS-035.
- Booking expiry.

## 3. Actors & Authorization

- Camper / Booking owner.
- System.

Backend ownership check is authoritative.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-029.

Booking exists and is in a state from which cancellation is allowed.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                                                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-098     | Eligibility for a Camper-initiated cancellation/refund before Trip start must be calculated from the Booking's cancellation_policy_snapshot and the request time. Later changes to the Trip's current cancellation policy must not alter an existing Booking. Refunds resulting from Host or System cancellation follow the cancellation/refund policy of the relevant flow. |
| BR-099     | When a Camper cancellation before Trip start is accepted, the Booking/participation must transition to cancelled within the same transaction, and repeated requests must be idempotent. A Camper on a cancelled Booking is no longer eligible to check in or join the Trip. A pending or failed refund must not restore participation or capacity automatically.             |
| BR-100     | If a cancelled Booking is currently included in seats_taken, the system must reduce seats_taken by exactly num_people, exactly once, within the same transaction so the released capacity becomes immediately available to other Bookings.                                                                                                                                   |
| BR-101     | Any equipment_reservations still in reserved status for a cancelled Booking must transition to cancelled and release inventory. Equipment already picked_up must follow the separate return/damage flow.                                                                                                                                                                     |
| BR-102     | A cancellation/refund request must be audited with the actor, Booking, relevant timestamps, before/after state, reason, and the required refund-request context. Sensitive payment data must not be logged.                                                                                                                                                                  |
| BR-174     | All input must be validated for required fields, data type, format, length, enum membership, and cross-field relationships before processing.                                                                                                                                                                                                                                |
| BR-175     | The backend is the authoritative source for authorization, state, pricing, capacity, inventory, risk level, and transaction outcome. The client must not establish these values authoritatively.                                                                                                                                                                             |
| BR-176     | Any business operation that changes multiple tables or records must execute within a transaction. If any step fails, the entire operation must roll back.                                                                                                                                                                                                                    |
| BR-177     | A failed operation must not leave data, state, reserved capacity, money, or inventory in a partially processed condition.                                                                                                                                                                                                                                                    |
| BR-178     | Operations that may be retried, including payments, refunds, callbacks, and synchronization, must support idempotency so the same request cannot be successfully applied more than once.                                                                                                                                                                                     |
| BR-179     | When concurrent requests modify the same resource, the system must use transactions, locking, optimistic/version control, or an equivalent mechanism to prevent lost updates and violations of business limits.                                                                                                                                                              |
| BR-180     | Every stateful resource must follow its defined state transitions and must not use values outside the database enum.                                                                                                                                                                                                                                                         |
| BR-181     | Before changing state, the system must validate the current state. A request based on stale state must be rejected with a business-conflict error.                                                                                                                                                                                                                           |
| BR-188     | Absolute timestamps must be stored as timestamptz. Pure calendar dates use date, and time-of-day values use time where defined by schema. APIs must transmit timezone/offset explicitly, and the UI must display values using the configured timezone.                                                                                                                       |
| BR-191     | Critical actions must be recorded in the audit log with actor, action, target, timestamp, and either before/after data or the reason for the change.                                                                                                                                                                                                                         |
| BR-192     | Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data.                                                                                                                                                                                                                                                                     |
| BR-209     | The UI must prevent duplicate submission while a request is in progress. Financial or resource-reservation actions may be presented as successful only after backend confirmation.                                                                                                                                                                                           |
| BR-210     | When the backend rejects a request because of a concurrent data change, the UI must preserve the user's entered data, explain the conflict, and allow the user to reload or retry.                                                                                                                                                                                           |
| BR-211     | Any request rejected for authorization failure or an unmet business precondition must terminate before any state-changing commit and must not create side effects such as data updates, capacity holds, charges/refunds, notifications, or false business audit records.                                                                                                     |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                                                                        |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                                                                                 |

## 6. State & Lifecycle

Eligible Booking
→ cancel request
→ policy validation
→ `cancelled`

If refundable:
→ CTMS-035 refund lifecycle.

Cancelled Booking does not continue granting Trip participation.

## 7. Business Flow

1. Camper requests cancellation.
2. Backend verifies ownership.
3. Reload Booking and policy snapshot.
4. Validate Booking state and time.
5. Calculate cancellation fee/refund eligibility.
6. Begin transaction.
7. Recheck state.
8. Set Booking cancelled + metadata.
9. Release applicable seats.
10. Release applicable equipment.
11. Create applicable refund obligation/request.
12. Audit.
13. Commit.
14. Notify/continue refund after commit.

## 8. Data & Invariants

- Cancellation uses policy snapshot associated with Booking.
- Client cannot choose refund amount.
- Cancelled Booking does not retain its participation slot.
- Seats released at most once.
- Reserved equipment released at most once.
- Refund cannot exceed authoritative refundable amount.
- Cancellation cannot silently produce duplicate refund.

## 9. API / Integration Contract

CTMS-174 MVP: `PATCH /api/bookings/:bookingId/cancel`.

Active authenticated Camper / Booking owner only. Body: `{ reason?: string }`;
reason is trimmed and limited to 255 characters. Other body fields are rejected.
No `Idempotency-Key` is required: cancellation is naturally idempotent per Booking.

Response: `{ bookingId, status, cancelledAt, paymentStatus, refund }`, where refund
is null or `{ obligationId, amount, status }`. Amount is a decimal string. Legacy
cancelled Bookings may return `cancelledAt: null`; no timestamp is fabricated.
Refund status is current persisted Payment state. Member PII is not included.

Errors: 401 authentication/inactive account, 403 role/ownership, 404 missing Booking,
422 malformed UUID/body, 409 policy/state/equipment/financial/capacity conflict.
Unexpected persistence errors roll back the transaction.

See [CTMS-174 implementation and data contract](../../docs/ctms-174-booking-cancellation.md).

## 10. Error & Edge Cases

| Case                                | Expected Behavior                                    |
| ----------------------------------- | ---------------------------------------------------- |
| Another Camper cancels Booking      | Reject.                                              |
| Booking already cancelled           | Idempotent/no duplicate side effects.                |
| Booking state no longer cancellable | Reject.                                              |
| Policy says no refund               | Cancel according to policy without inventing refund. |
| Capacity release fails              | Roll back applicable transaction.                    |
| Concurrent cancellation             | One authoritative outcome.                           |
| Client supplies refund amount       | Ignore/reject; backend calculates.                   |

## 11. Acceptance & Test Matrix

| Source          | Scenario                             | Expected Result                             | Test Type   |
| --------------- | ------------------------------------ | ------------------------------------------- | ----------- |
| PB AC-1         | Owner cancels                        | Authorization passes                        | E2E         |
| PB AC-1         | Non-owner cancels                    | Rejected                                    | Security    |
| PB AC-2, BR-098 | Policy snapshot applies              | Correct policy used                         | Integration |
| PB AC-3, BR-099 | Valid cancellation                   | Booking cancelled with metadata             | Integration |
| PB AC-4, BR-100 | Capacity-consuming Booking cancelled | Seats released once                         | Transaction |
| PB AC-5, BR-101 | Reserved equipment exists            | Released appropriately                      | Integration |
| PB AC-6, BR-102 | Refund eligible                      | Refund workflow created according to policy | Integration |
| PB AC-7         | Cancellation succeeds                | Audit present                               | Audit       |

## 12. Open Decisions

Exact cancellation percentages/windows are defined by the authoritative cancellation policy and are not hard-coded by this spec.

## 13. Approved CTMS-174 Project/MVP Decisions

These implementation decisions supplement the reviewed PB/BR; they are not new
Business Rules or replacements for the rules above.

- Only `confirmed/paid` and `confirmed/not_required` may newly cancel. Already
  cancelled is an owner-authorized replay. Other combinations are rejected,
  including overdue pending-payment and pending-reconfirmation Bookings.
- Use one captured request timestamp and `booking.tripStartsAtSnapshot`.
  Cancellation requires request time strictly before that snapshot.
- Supported policy: `{ version: 1, rules: [{ minHoursBeforeTrip, refundPercent }] }`.
  Thresholds are finite and nonnegative; percentages are finite in 0..100.
  Select the greatest matching threshold (`hoursBeforeTrip >= minHoursBeforeTrip`).
  No match, null, unsupported, or invalid policy causes conflict without mutation.
  Prose and legacy keys are never interpreted; there are no production defaults.
- Refund calculation uses succeeded charge evidence, exact minor-unit arithmetic,
  and approved ROUND HALF UP at the final minor-unit boundary. Existing applicable
  pending/succeeded refund obligations reduce remaining entitlement; never exceed
  the eligible charge. Preserve percentage and evaluation evidence in audit.
- The existing Payment ledger represents the durable refund obligation (`refund`,
  `pending`, parent succeeded charge). CTMS-035 owns provider execution. Cancellation
  never invokes a payment/refund provider.
- Preserve member history. Booking status controls participation; no member
  `cancelled` enum is introduced. Preserve the late-payment callback safeguard.
- Current equipment `active` state cannot distinguish reserved from picked up.
  Any such reservation causes an atomic conflict. Already-cancelled reservations
  remain unchanged; no equipment handover redesign is part of this task.
- Use one transaction, Trip then Booking locks, deterministic Payment/reservation
  locks, and an exact seat decrement. Preserve seats held by other Bookings,
  including pending reconfirmation; do not call global capacity recomputation.
- Persist nullable Booking cancellation timestamp/reason and one success audit.
  A replay performs no policy recalculation, release, refund creation, or new audit.
- Automatic expiry, reschedule decline, notification/UI work, and provider refund
  execution remain outside CTMS-174.
