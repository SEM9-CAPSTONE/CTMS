# CTMS-174 Booking cancellation: MVP implementation/data contract

The reviewed rules remain in `file/spec/ctms-34-cancel-booking-according-to-policy.md`.
The decisions below are approved **PROJECT/MVP DECISIONS**, not PB/BR replacements.

## Mentor review amendment — 2026-10-22

This amendment implements the user's mentor feedback and supersedes the conflicting
MVP decisions below. It does not retroactively rewrite existing Booking policies.

- Cancellation reason is required, trimmed, nonblank and at most 255 characters.
- The built-in Trip policy is 100% at >=72 hours, 30% at >=48 and <72 hours,
  and 0% below 48 hours, strictly before departure. Booking snapshots remain authoritative.
- Booking hold configuration defaults to 120 minutes. Existing hold deadlines are unchanged.
- In the release where CTMS-041 handover tracking is explicitly cut, `active` is the
  application's rental allocation. An ordinary cancellation may release this allocation
  only while the live Trip is published and both live and snapshotted departure times
  are in the future. Physical handover/return remains an off-platform Host responsibility.
  No picked_up/returned states or speculative handover subsystem are introduced.
- Active allocations transition to cancelled atomically with Booking cancellation,
  exact seat release, refund obligation, audit, and transactional notification inbox rows.
  Already-cancelled allocations remain unchanged. Requests after departure reject before writes.
- Each active owning Host and active Admin receives one persisted inbox row per Booking.
  Reads are recipient-scoped. `PATCH /api/booking-cancellation-notices/:id/read` records
  an idempotent read timestamp; a different recipient gets 404. Delivery is in-app polling
  after commit; no email, push or unauthenticated global WebSocket broadcast is added.
- All cancellation refund entry points use the entitlement fixed at cancelled_at.
  Pending/succeeded refunds consume that entitlement; retrying cannot claim the retained
  percentage. Host/System Trip cancellation retains its separate refund origin.
- Migration 1792627200001 upgrades only exact previous built-in rules on future draft,
  pending-review and published Trips, backing up affected policies for rollback. Custom
  policies, unknown legacy formats, every existing Booking snapshot and expired hold
  remain unchanged. Legacy unsupported policies still fail closed for manual resolution.
- The cancellation UI preserves entered reasons after a conflict, allows keeping the
  Booking, and links to the Trip for a new Booking subject to current capacity/eligibility.

Schema: `booking_cancellation_notices` stores recipient_id, booking_id, trip_id,
trip_title, camper_name, reason, read_at, created_at and a unique (booking_id, recipient_id)
constraint. Foreign keys cascade only when their referenced test/business data is deleted.
`mentor_default_policy_backups` is migration rollback data, not an application ledger.

## API

`PATCH /api/bookings/:bookingId/cancel` requires an active authenticated Camper
who owns the Booking. Participant membership does not authorize cancellation.
Ownership is checked before returning a replay. Missing Booking is 404; foreign
Booking is 403; invalid UUID/body is 422; business/integrity conflicts are 409.

Request body contains only required `reason: string`, trimmed, nonblank, maximum 255 chars.
Omitted, blank, null/non-string reasons and server-owned fields are rejected. There is no cancellation request key.

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

The built-in default follows the mentor amendment above; custom persisted snapshots
remain authoritative. Historical synthetic policy tests also remain supported. The current Trip policy and Booking total are not used to
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

Current reservation states are active/cancelled. Pre-departure application allocations
are cancelled under the live/snapshot guards in the mentor amendment. Already-cancelled
records remain unchanged. No catalog stock counter is increased or member history rewritten.

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

Provider execution, reschedule decline, physical equipment pickup/return tracking,
background push/email delivery and interpretation of unknown legacy policies remain excluded.
