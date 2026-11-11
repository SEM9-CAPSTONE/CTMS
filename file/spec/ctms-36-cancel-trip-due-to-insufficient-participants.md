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

No HTTP endpoint -- this is a background worker, not a client-triggered action (matches Section 3's "System/background worker" actor).

`TripAutoCancelWorker` (`services/api/src/modules/trips/services/trip-auto-cancel.worker.ts`): an env-gated `setInterval` tick (`TRIP_AUTO_CANCEL_WORKER_ENABLED`, `TRIP_AUTO_CANCEL_INTERVAL_MS`, `TRIP_AUTO_CANCEL_BATCH_SIZE`), mirroring the already-proven `BookingExpiryWorker` (CTMS-172) exactly -- overlap-guarded (skips a tick if the previous one is still running) and drains the in-flight tick on `OnApplicationShutdown` before the process exits. No new scheduler dependency (`@nestjs/schedule` or similar) was added; this `setInterval`-based pattern was already established and did not need reinventing.

`TripAutoCancelService.autoCancelDueTrips(batchSize)` (`trip-auto-cancel.service.ts`): fetches candidate Trip ids (`TripsRepository.findAutoCancelCandidateIds`, `status = 'published' AND booking_deadline < now() AND participation_evaluated_at IS NULL`) and evaluates each independently via `evaluateTrip(tripId)`, catching and logging per-Trip failures so one bad Trip cannot block the batch.

`evaluateTrip(tripId)`: one `dataSource.transaction()` per Trip --
1. Locks the Trip row (`FOR UPDATE`) and re-verifies eligibility inside the transaction (BR-107, BR-205): still `published`, deadline passed, not already evaluated.
2. Computes confirmed participation as `SUM(num_people)` over `bookings` with `status = 'confirmed'` only.
3. If `confirmed >= capacity_min`: stamps `participation_evaluated_at` and stops (`SUFFICIENT`) -- no cancellation, no audit entry (nothing changed).
4. Otherwise: calls `TripsRepository.cancelTripWithCommitments(tripId, evaluatedAt, reason, { refundIdempotencyPrefix, refundReason })` -- the same helper CTMS-027's Host-cancel flow already uses -- to cancel the Trip, cancel its Bookings, unassign Porters, release active equipment reservations, and create one `pending` refund-obligation `payments` row per paid Booking (BR-108, BR-109). Then writes one `audit_logs` row (`actor_id = NULL`, BR-193) and one `trip_auto_cancel_outbox_events` row per cancelled Booking (BR-194/195 post-commit notification, deduplicated by a `(event_type, booking_id)` unique index).

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

**Resolved during implementation (2026-10-11):**

- **`pending_reconfirmation` Bookings (from the reschedule flow, CTMS-160) are excluded from confirmed participation**, the same as `pending_payment`. BR-107 only names `pending_payment` explicitly because it was written before the reschedule feature existed; a Booking still awaiting the Camper's reconfirmation after a Host reschedule is not authoritative confirmed participation either.
- **Refund-obligation idempotency keys are prefixed `ctms-036:trip-cancel:...`**, distinct from CTMS-027's `ctms-027:trip-cancel:...`, so an auto-cancellation's refund rows are attributable to this story rather than silently inheriting the Host-cancel flow's own tag. `cancelTripWithCommitments` gained an optional `{ refundIdempotencyPrefix, refundReason }` parameter for this (default values preserve CTMS-027's existing behavior unchanged).
- **Refund execution is deliberately NOT automated by this worker** -- it stops at creating the `pending` refund-obligation row (Section 9, step 4) and never calls `RefundsService.processRefund`. Calling it automatically would have silently marked every refund "succeeded" with no real PayOS call for any non-Camper-initiated request (`RefundsService.submitProviderRefund` is a stub for that code path), which is a real financial-integrity risk for a fully unattended job. This matches Section 2's own "Out of Scope: Refund provider implementation beyond CTMS-035" -- the created obligation is picked up through the existing Admin refunds queue (`/admin/refunds`, CTMS-035/CTMS-177).

## 13. Implementation Record

- **Reused `cancelTripWithCommitments` (CTMS-027) rather than duplicating Trip/Booking/Porter/Equipment cancellation logic.** The only change needed was making the refund idempotency-key prefix and refund reason parameterizable (see Open Decisions above); CTMS-027's own call sites are unaffected (new parameter is optional, defaults preserve the exact prior behavior and prior idempotency keys).
- **Two real, pre-existing bugs were found and fixed in `cancelTripWithCommitments`/`createIdempotentRefund` while building on them** (both confirmed via `git diff develop` to already exist before this story touched the file -- not something introduced here):
  1. **TypeORM returns `[rows, affectedRowCount]` for `UPDATE ... RETURNING` (not just `rows`, unlike `SELECT`/`INSERT ... RETURNING`)** -- confirmed directly in `PostgresQueryRunner.query()`'s own source (`result.raw = [raw.rows, raw.rowCount]` for the `UPDATE`/`DELETE` command case). `cancelTripWithCommitments`'s three `UPDATE ... RETURNING` queries (bookings, trip_porters, equipment_reservations) were never destructuring this tuple, so `bookingsCancelled`/`portersUnassigned`/`equipmentReservationsCancelled` were always silently off-by-one, and `.cancelledBookings` was unusable. CTMS-027's own refund-creation loop tolerated this silently (`if (booking.totalAmount)` happened to also be falsy for the bogus extra tuple entry, so it was skipped without error) -- which is why this went unnoticed until this story's integration test asserted on `cancelledBookings[0].id` directly. Fixed by destructuring `const [rows] = await this.query(...)` for all three.
  2. **`createIdempotentRefund`'s idempotency-key `md5(...)` expression mixed a `$2::numeric`-cast usage of the amount parameter with bare (implicit-text) usages of the same parameter inside string concatenation**, which Postgres's parameter-type unification rejects with "inconsistent types deduced for parameter". This path was previously only reachable through CTMS-027's Host-cancel flow, which has unit tests only (mocked repository, raw SQL never actually executes) -- no real-Postgres integration test had ever exercised a Host-cancel-with-a-succeeded-charge scenario before. Fixed with explicit `::text` casts on every bare usage.
- **No new scheduler dependency.** `TripAutoCancelWorker` mirrors `BookingExpiryWorker`'s (CTMS-172) already-proven `setInterval` + `OnApplicationBootstrap`/`OnApplicationShutdown` pattern exactly, rather than introducing `@nestjs/schedule` or any cron library.
- **New `trips.participation_evaluated_at` column and partial index** (migration `1787190000000-AddTripAutoCancelInfrastructure`) so a Trip the worker already found sufficiently funded is excluded from the candidate query on every future tick -- nothing else in this codebase transitions a Trip out of `published` on its own (`TripStatus.ONGOING` exists but is not wired to any transition anywhere), so without this a satisfied Trip would be re-scanned forever.
- **New `trip_auto_cancel_outbox_events` table**, mirroring `booking_expiry_outbox_events` (CTMS-172) exactly, for post-commit notification (BR-194/195), one row per cancelled Booking, deduplicated by a `(event_type, booking_id)` unique index.

## 14. Test Evidence

- Unit: `trip-auto-cancel.service.spec.ts` (9: cancels below capacity_min with correct audit/outbox/idempotency-prefix wiring; NO_OP for not-published/before-deadline/already-evaluated/Trip-not-found; SUFFICIENT at and above capacity_min boundary; no outbox write when zero Bookings were cancelled; continues the batch after one Trip's transaction fails) + `trip-auto-cancel.worker.spec.ts` (5, mirrors `booking-expiry.worker.spec.ts`'s own enable/disable, interval, overlap-guard, and graceful-shutdown-drain cases exactly) = 14 new tests -- `pnpm --filter @ctms/api test` -> 1086 passed (all suites green).
- Integration (`test/trips.auto-cancel.integration-spec.ts`, 5 passed, real Postgres, no mocking): before-deadline no-op; cancels below `capacity_min` and creates a **`pending` (never `succeeded`)** refund obligation -- directly proving the Open Decisions' "no automated refund execution" design; marks `participation_evaluated_at` and does not cancel when `capacity_min` is met exactly; `pending_payment` Bookings excluded from confirmed participation (BR-107); concurrent evaluations of the same Trip never double-cancel or double-refund (one `CANCELLED`, one `NO_OP`, exactly one refund row, exactly one audit row). Re-ran the full `bookings.cancel`/`bookings.refund` integration suites (29 passed) after the two repository bug fixes above to confirm no regression to CTMS-027/034/035's own behavior.
- `pnpm --filter @ctms/api build` and `pnpm --filter @ctms/api lint` both pass clean.

### Logic Subtask DoD

- [x] Logic implementation completed.
- [x] Applicable business rules and invariants implemented.
- [x] Task-specific unit tests added or updated.
- [x] Task-specific unit tests passed.
- [x] Applicable backend or integration tests passed.

## 15. CTMS-179 (UI) Implementation Record

CTMS-36-T02 -- makes the Camper/Host-facing UI reflect a Trip the CTMS-036 worker (above) auto-cancelled, instead of silently showing stale "still open" state or mislabeling the resulting refund.

**Scope delivered (3 fixes, matching the approved plan):**

1. **`TripResponseDto`/`TripsRepository` expose `cancellationReason`/`cancelledAt`** (detail DTO only, not the list/summary DTO) so the frontend can distinguish "why" a Trip is cancelled, not just that it is.
2. **Fixed a refund **origin-mislabeling** bug in `RefundsService.getBookingRefundInfo`**: it checked `booking.status === CANCELLED` (-> always `CAMPER_CANCELLATION`) before ever checking whether the *Trip* was cancelled. Since `cancelTripWithCommitments` always cancels the Booking as a side effect of cancelling the Trip (shared by CTMS-027's Host-cancel and CTMS-036's auto-cancel), every Trip-cancellation-caused refund was being mislabeled as the Camper's own cancellation. Fixed by checking `trip.status === CANCELLED` first, branching to `SYSTEM_TRIP_CANCELLATION` (when `trip.cancellationReason === AUTO_CANCEL_REASON`) or `HOST_TRIP_CANCELLATION` (any other reason), and falling back to `CAMPER_CANCELLATION` only when the Trip itself was not cancelled.
3. **Removed a stale, contradictory line from `BookingCancellationPanel`'s already-cancelled-Booking message** ("Thông tin hoàn tiền không có trong dữ liệu chi tiết hiện tại.") -- `BookingRefundPanel`, rendered on the same page, already shows accurate live refund data, so the old line was actively misleading.

**Judgment calls surfaced while verifying end-to-end (both raised with and resolved by the user/product owner before implementing):**

- **A Camper cannot load `GET /trips/:id` for a cancelled Trip at all**, regardless of this story: `trips.service.ts`'s `getTripDetails` throws 404 for any non-`published` Trip unless the caller is the owning Host or an Admin (`BR-073`/`BR-075`, from CTMS-023/024, with its own dedicated unit tests -- confirmed deliberate, not a bug). This means the new `TripCapacityBanner` "cancelled" state (item 1 above) is only ever reachable by the owning Host or an Admin, never by the Camper whose Booking was affected.
  - **Resolved:** out of scope to change here -- the Camper-facing requirement (seeing their own payment/refund amount to request or verify a refund) is already fully satisfied by the Booking Details page (`BookingRefundPanel`), which does not call `GET /trips/:id` at all and is unaffected by this gate. Confirmed against product intent: the Camper does not need the Trip detail page itself, only their own booking/refund figures.
  - E2E coverage therefore verifies the Trip-detail banner as the **Host**, and the Camper-facing surface via the **Booking Details page**.
- **Pre-existing bug found and fixed (out of this story's original scope, approved before fixing):** `TripsRepository.createIdempotentRefund` stored the refund's internal `reason` string (e.g. `insufficient_participants_after_deadline`, or a Host's free-text cancellation reason) directly in the `payments.provider_reference` column -- a column reserved for a REAL payment-provider transaction reference (e.g. the bank transfer code an Admin enters when confirming a manual refund). This rendered as a fake "Mã giao dịch đối soát: insufficient_participants_after_deadline" in the Camper-facing refund history UI, discovered via a real evidence screenshot while verifying this story. Confirmed pre-existing via `git log -S` (introduced by CTMS-027's `22c2d06`, not touched by CTMS-178 or this story until now) and confirmed it affects **both** CTMS-027 (Host-cancel) and CTMS-036 (auto-cancel), since both share `createIdempotentRefund`. Fixed by no longer writing anything into `provider_reference` at obligation-creation time (left `NULL`, matching the existing convention already used by the Camper-initiated refund path in `booking-cancellation.service.ts`); the now-fully-unused `refundReason`/`CancelTripWithCommitmentsOptions.refundReason` parameter was removed rather than left dead. `trip.cancellation_reason` (a separate, correctly-used column) is unaffected and still stores the real reason.

## 16. CTMS-179 (UI) Test Evidence

- Unit (backend): `trip-auto-cancel.service.spec.ts` updated for the `refundReason` option removal -- `pnpm --filter @ctms/api test` -> 1089/1089 passed (94/94 suites).
- Integration (backend, real Postgres): `pnpm --filter @ctms/api test:integration` -> 299/299 passed (33/33 suites), including `trips.auto-cancel.integration-spec.ts`, `bookings.cancel.integration-spec.ts` and `bookings.refund.integration-spec.ts` re-verified clean after the `provider_reference` fix (no regression to CTMS-027/034/035).
- `pnpm --filter @ctms/api build` and `pnpm --filter @ctms/api lint` both pass clean.
- Frontend unit (Vitest): `apps/web` -> 1055/1060 passed. The 5 failures are in `CreateTripForm.test.tsx` (Create Trip feature, unrelated to this story -- file untouched by this branch, reproduces identically in isolation on `develop`), reported separately and explicitly out of scope here.
- Frontend `pnpm build` and `pnpm lint` both pass clean.
- **E2E (Playwright, real Postgres, no mocking)**: `apps/web/tests/e2e/ctms-36-t02-cancel-trip-insufficient-participants.spec.ts`, 3/3 passed:
  1. Seeds a published Trip past its `booking_deadline` with `capacity_min: 3` and a single 1-person confirmed+paid Booking, drives the real `TripAutoCancelService.evaluateTrip` (not HTTP -- this is a background job, matching Section 9), and verifies the owning Host sees the "Chuyến đi đã bị hủy" banner with the known reason text.
  2. Verifies the Camper's Booking Details page shows the corrected cancelled-booking message (no stale text) and a refund panel correctly attributed to `SYSTEM_TRIP_CANCELLATION` -- proven by the **absence** of the pre-Trip "Khung thời gian yêu cầu" window box, which `RefundsService.getBookingRefundInfo` only populates for `CAMPER_CANCELLATION`.
  3. Verifies the DB directly: Booking `cancelled`, refund obligation `pending` with idempotency key prefixed `ctms-036:trip-cancel:`.
- Real screenshots captured via a temporary Playwright script (deleted immediately after use, not committed) confirming both the Host-viewed Trip detail banner and the Camper-viewed Booking Details refund panel render correctly; the screenshot review is what surfaced the `provider_reference` bug above.

### UI Subtask DoD

- [x] UI implementation completed per approved plan.
- [x] Judgment calls and scope gaps found during implementation raised with and resolved by the user before proceeding.
- [x] Task-specific unit tests added/updated and passed (backend + frontend).
- [x] Real E2E test (Playwright, real Postgres) added and passed.
- [x] Real evidence screenshots captured and reviewed (not committed, per repo convention).
- [x] Pre-existing bug found during verification (`provider_reference` mislabeling) fixed with full git evidence and test coverage.
