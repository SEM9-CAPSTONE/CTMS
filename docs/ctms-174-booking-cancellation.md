# CTMS-174 Booking cancellation: MVP implementation/data contract

The reviewed rules remain in `file/spec/ctms-34-cancel-booking-according-to-policy.md`.
The decisions below are approved **PROJECT/MVP DECISIONS**, not PB/BR replacements.

## API

`PATCH /api/bookings/:bookingId/cancel` requires an active authenticated Camper
who owns the Booking. Participant membership does not authorize cancellation.
Ownership is checked before returning a replay. Missing Booking is 404; foreign
Booking is 403; invalid UUID/body is 422; business/integrity conflicts are 409.

Request body contains only optional `reason: string`, trimmed, maximum 255 chars.
Omitted or blank reason becomes `camper_cancel_booking`. Explicit null/non-string
reason and server-owned fields are rejected. There is no cancellation request key.

Response:

```typescript
{
  bookingId: string;
  status: "cancelled";
  cancelledAt: string | null; // ISO timestamp with offset; null for unknown legacy history
  paymentStatus: "paid" | "unpaid" | "not_required" | null;
  refund: null | {
    obligationId: string;
    amount: string; // two decimal places
    status: "pending" | "succeeded" | "failed";
  };
}
```

New cancellation accepts only confirmed/paid or confirmed/not_required Bookings.
All other states/payment combinations conflict, except already-cancelled replay.
Historical/current Booking Details GET remains a pure read with its existing DTO.

## Policy and arithmetic

Supported persisted snapshot:

```typescript
type CancellationPolicySnapshotV1 = {
  version: 1;
  rules: Array<{ minHoursBeforeTrip: number; refundPercent: number }>;
};
```

Rules must be nonempty with finite nonnegative thresholds and finite percentages
in 0..100. Identical duplicate rules are harmless; conflicting percentages for an
identical threshold are rejected as ambiguous policy. No rule ordering assumption
is required: select the greatest threshold not exceeding hours before the Booking
start snapshot. No matching rule is a conflict. No prose/legacy fallback exists.

One timestamp is captured on service entry, before transaction lock waits. It is
used for eligibility, evaluation, persisted cancellation time and audit. It must be
strictly earlier than `trip_starts_at_snapshot`; equality is rejected.

The selected persisted numeric percentage is converted from its decimal string
representation into an exact BigInt numerator/denominator, including exponent
notation. No basis-point truncation is applied. Money never uses Number arithmetic.
The JSON number schema cannot recover precision already lost before persistence.

For eligible charge minor units C and exact percent ratio P:

- E = HALF_UP(C × P / 100), rounded once to whole minor units.
- R = total applicable pending + succeeded refund minor units.
- Additional obligation = min(max(E − R, 0), C − R).
- R > C is an integrity conflict, not a silent correction.
- Failed refund attempts do not consume approved pending/succeeded entitlement.

A paid Booking requires one unambiguous succeeded charge. Missing/multiple
succeeded charge records, inconsistent refund-parent linkage, or a conflicting
operation key are rejected instead of guessing an allocation. A not-required
Booking with no succeeded charge has no refund obligation. Succeeded charge
evidence inconsistent with not-required status is rejected.

No fee/percentage table or policy is seeded in production. Percentages in tests
are synthetic fixtures. The current Trip policy and Booking total are not used to
replace policy/charge evidence. Equipment fees are never separately added.

## Persistence and ownership

Migration `1787150000000-AddBookingCancellationMetadata` adds:

| Table/column | Type | Meaning |
| --- | --- | --- |
| bookings.cancelled_at | nullable timestamptz | First accepted ordinary cancellation request/evaluation time |
| bookings.cancellation_reason | nullable varchar(255) | First accepted normalized reason |

Existing rows remain null; no historical timestamp/reason is fabricated. There
is no `cancelled_by`, refund percentage/status/amount duplication on Booking, or
new member enum. Actor identity and evaluated policy evidence live in AuditLog.

A positive approved amount creates one Payment: type=refund, status=pending,
parent_payment_id=eligible charge, provider_reference=null. Its deterministic key
is `ctms-174:cancel:<bookingId>` with a SHA-256 fingerprint. The existing unique
index `(booking_id, idempotency_key)` provides uniqueness. Creation's Booking
idempotency key is untouched. No zero-value Payment is inserted.

This pending Payment is a durable approved obligation for CTMS-035, **not evidence
of submission to or success from a provider**. CTMS-174 does not execute refunds
or create provider transactions. CTMS-035 must retain parent-charge locking and
the cumulative cap when consuming/retrying obligations.

Replay returns the original Booking cancellation timestamp plus current status
of this operation's refund Payment. It does not create an obligation for a legacy
or Host-cancelled Booking. Other workflows' refunds are not represented as this
operation's refund. No client-controlled field replaces the original result.

## Transaction and resources

One transaction reads Trip identity, locks Trip then Booking, validates ownership,
handles replay, validates eligibility/policy/capacity, locks Payment rows in ID
order and reservation rows in ID order, and validates equipment. Only then does
it save cancellation, subtract exactly num_people, insert a positive refund and
write `booking.cancelled` audit. Any failure rolls back all writes.

Seats below num_people cause a conflict. No clamping, lazy expiry, reconciliation,
or global recompute function is used. Other reconfirmation seats are preserved.

Current reservation states are active/cancelled. Active does not prove physically
uncollected equipment, so it blocks cancellation without mutation. A Booking with
no reservations or only already-cancelled reservations can proceed. No stock
counter is increased and no reservation/member history is rewritten.

Audit includes actor/Booking, before/after status, evaluation time, schedule
snapshot, selected policy, exact percentage and rational monetary result, rounding,
seat count, equipment context, charge/refund identity and amount, and reason.
It excludes member PII and raw provider payloads. Replays add no success audit.

Late successful payment callbacks retain the preceding CTMS-174 safeguard:
financial success may be recorded but cancelled Booking participation stays
cancelled. Existing roster initialization rejects cancelled Bookings. No check-in
endpoint exists; a future writer must check Booking eligibility under lock.

## Verification and limits

Unit tests cover policy/time boundaries, malformed policies, exact HALF_UP cases,
prior-refund caps, ownership, state eligibility, replay, equipment conflicts and
failure propagation. PostgreSQL API integration tests cover atomic success,
concurrent/sequential duplicate requests, actual refund/audit failure rollback,
privacy, reconfirmation capacity preservation and callback/member regressions.

Automatic expiry, reschedule decline, provider refund execution, equipment pickup
tracking, notification/UI work and migration of legacy policies remain excluded.
