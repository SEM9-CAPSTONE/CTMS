# CTMS-111 — Hold Successful Booking Funds

## 1. Overview

Story: CTMS-111

Epic: EPIC 5. Booking and Payment

Use Case: Hold Successful Booking Funds

Priority: Must Have

Goal: Move the Host-eligible portion of a successfully confirmed Booking charge into Held Funds without treating it as settled or paid out.

Backlog story: As the System, I want to hold successful Booking funds so money remains controlled until settlement conditions are satisfied.

Acceptance Criteria:

| Source  | Criterion                                                                  |
| ------- | -------------------------------------------------------------------------- |
| PB AC-1 | Hold occurs only after successful charge is confirmed by backend/provider. |
| PB AC-2 | Eligible Host amount moves to Held Funds.                                  |
| PB AC-3 | Store `held_at`.                                                           |
| PB AC-4 | Held Funds trace to Trip, Booking, Host, and original charge.              |
| PB AC-5 | Cancelled/refunded/ineligible obligations do not enter settlement base.    |
| PB AC-6 | Held Funds are not payout or settled/payable funds.                        |
| PB AC-7 | Retry/callback processing is idempotent.                                   |

## 2. Scope

### In Scope

- Successful-charge hold.
- Held Funds.
- Financial traceability.
- Idempotency.

### Out of Scope

- Settlement — CTMS-112.
- Host payout — CTMS-113.

## 3. Actors & Authorization

Primary actor:

- System/payment backend.

## 4. Preconditions & Dependencies

Booking charge has succeeded and is backend/provider-confirmed.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-330 | When a Booking charge succeeds and is confirmed by the backend/provider, the Host-eligible portion must move into Held Funds, store held_at, and link to the Trip, Booking, Host, and original charge. Held Funds are not a payout and must not be considered settled/payable until settlement rules are satisfied.                                                                                                                                          |
| BR-331 | Held Funds must be traceable to the Booking, Trip, Host, and original successful charge. Amounts associated with cancelled Bookings, succeeded refunds, or obligations that are no longer eligible must not be included in the settlement base.                                                                                                                                                                                                              |
| BR-332 | Callbacks or retries for charge, refund, settlement, payout, or adjustment must be idempotent. The same business/provider reference must not cause a double charge, refund, settlement, payout, or adjustment.                                                                                                                                                                                                                                               |
| BR-335 | A settlement may be created only when Trip status = completed, now >= trips.completed_at + 72 hours, the 24-hour Camper complaint window has ended, and no blocking complaint/refund claim remains in pending, reviewing, or approved-refund-pending state. If a blocking claim still exists at the 72-hour point, settlement must remain on hold until the claim is resolved. The backend must revalidate all conditions within the settlement transaction. |
| BR-336 | Every succeeded refund before settlement must reduce Held Funds and the settlement base accordingly. An approved refund that is still awaiting provider completion must continue to block settlement. Pending or failed refunds must not be treated as succeeded.                                                                                                                                                                                            |
| BR-343 | Ordinary Camper refunds must be handled before settlement within the defined request windows. A succeeded refund reduces Held Funds/the settlement base, and no payout may be created for the refunded amount.                                                                                                                                                                                                                                               |

## 6. State & Lifecycle

successful charge
→ Held Funds
→ later eligible settlement.

Held Funds are neither settled nor paid out.

## 7. Business Flow

1. Receive successful charge confirmation.
2. Verify idempotency/reference.
3. Resolve Booking/Trip/Host.
4. Determine Host-eligible held amount.
5. Create/update Held Funds atomically.
6. Store held_at/source references.
7. Audit applicable critical financial action.
8. Later settlement flow determines eligibility.

## 8. Data & Invariants

Held Funds trace to:

- Trip;
- Booking;
- Host;
- original successful charge;
- held_at.

Same charge must not create duplicate held obligations.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                 | Expected Behavior                                 |
| -------------------- | ------------------------------------------------- |
| Charge pending       | No hold                                           |
| Charge succeeded     | Eligible hold created                             |
| Duplicate callback   | No duplicate hold                                 |
| Booking refunded     | Refunded obligation excluded from settlement base |
| Held Funds displayed | Not labeled payout                                |

## 11. Acceptance & Test Matrix

| Source | Scenario            | Expected Result               | Test Type      |
| ------ | ------------------- | ----------------------------- | -------------- |
| BR-330 | Successful charge   | Held Funds created            | Financial      |
| BR-331 | Source tracing      | Complete                      | Reconciliation |
| BR-332 | Duplicate callback  | No duplicate                  | Idempotency    |
| BR-331 | Refunded obligation | Excluded from settlement base | Financial      |

## 12. Open Decisions

None.
