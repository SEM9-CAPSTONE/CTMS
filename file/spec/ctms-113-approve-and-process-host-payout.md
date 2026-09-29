# CTMS-113 — Approve and Process Host Payout

## 1. Overview

Story: CTMS-113

Epic: EPIC 5. Booking and Payment

Use Case: Approve and Process Host Payout

Priority: Must Have

Goal: Transfer only eligible settled/payable Host funds through an authorized, traceable, and idempotent payout process.

Backlog story: As an authorized financial operator/system, I want to approve and process Host payout so settled Host entitlement can be transferred safely.

Acceptance Criteria:

| Source  | Criterion                                                         |
| ------- | ----------------------------------------------------------------- |
| PB AC-1 | Payout uses eligible settled/payable funds, not Held Funds.       |
| PB AC-2 | Payout requires applicable authorization/approval.                |
| PB AC-3 | Payout amount is traceable to settlement/Host/source obligations. |
| PB AC-4 | Successful payout records authoritative success evidence/time.    |
| PB AC-5 | Failed/pending payout is not treated as paid.                     |
| PB AC-6 | Retry/callback is idempotent and cannot double-pay Host.          |
| PB AC-7 | Payout is distinct from Net Revenue.                              |

## 2. Scope

### In Scope

- Payout eligibility.
- Approval.
- Transfer processing.
- Status.
- Financial traceability.
- Idempotency.

### Out of Scope

- Settlement calculation — CTMS-112.
- Post-payout financial exception reconciliation — CTMS-114.

## 3. Actors & Authorization

- Authorized financial/Admin actor where approval is required.
- System/payment provider.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-112.

Eligible settled/payable Host entitlement exists.

## 5. Business Rules

| BR                 | Rule                                                                                                                                                                                                                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-340             | A Payout may be created only from a settled/payable balance > 0 for the correct Host, after a valid settlement, and only when no blocking financial exception remains. An authorized Admin must approve the payout before execution. The Host/client must not specify an arbitrary payout amount greater than the payable balance. |
| BR-341             | Payout approval and payout execution must use clearly separated states. A Payout may move to processing only after valid Admin approval. The execution lifecycle must distinguish at least pending, processing, succeeded, and failed. Retrying a failed Payout must be idempotent and must not create a duplicate transfer.       |
| BR-342             | A succeeded Payout must store appropriate provider/reference evidence. Any manual reconciliation or override must be limited to authorized Admins and must be audited.                                                                                                                                                             |
| BR-332             | Callbacks or retries for charge, refund, settlement, payout, or adjustment must be idempotent. The same business/provider reference must not cause a double charge, refund, settlement, payout, or adjustment.                                                                                                                     |
| BR-346             | A cancelled Trip/Booking that has received a full refund under policy must not generate a payout for the refunded amount. Any pending settlement/payout must revalidate the current financial state before commit.                                                                                                                 |
| BR-347             | Every settlement, fee, adjustment, payout, and manual reconciliation must be traceable to the corresponding Host, Trip, Booking/original payment and must be audited under the critical-action policy.                                                                                                                             |
| BR-348             | Notifications about payout or financial status may be emitted only after the authoritative financial transaction/state commits. Delivery failure must not roll back the committed settlement or payout.                                                                                                                            |
| BR-349             | Admin and Host UIs must clearly distinguish Held, Settled/Payable, Payout Processing, Payout Succeeded/Failed, and Refund/Adjustment states so users do not misinterpret the state of funds.                                                                                                                                       |
| BR-324             | Payout amount and Net Revenue are different KPIs. Net Revenue represents the Host's entitlement after settlement/adjustments, while Payout is the actual cash transfer to the Host.                                                                                                                                                |

## 6. State & Lifecycle

Settled/Payable
→ payout approval
→ payout processing
→ succeeded

or

→ pending/failed according to authoritative payout lifecycle.

Only succeeded payout counts as paid out.

## 7. Business Flow

1. Identify eligible payable settlement.
2. Verify authorization.
3. Determine payout amount.
4. Link payout to Host/settlement/source.
5. Submit transfer.
6. Process provider result idempotently.
7. On success, record succeeded state/time.
8. On pending/failure, retain corresponding state.
9. Audit critical financial action.

## 8. Data & Invariants

- Held Funds cannot be paid directly before settlement eligibility.
- Same payout obligation must not be transferred twice.
- Pending/failed ≠ succeeded.
- Payout amount ≠ Net Revenue KPI by definition.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                        | Expected Behavior       |
| --------------------------- | ----------------------- |
| Funds still Held            | Reject payout           |
| Eligible payable amount     | Process                 |
| Duplicate provider callback | No duplicate payout     |
| Provider failure            | Not marked paid         |
| Unauthorized approval       | Reject                  |
| Successful payout           | Record success evidence |

## 11. Acceptance & Test Matrix

| Source     | Scenario               | Expected Result                  | Test Type   |
| ---------- | ---------------------- | -------------------------------- | ----------- |
| Payout BRs | Settled payable amount | Eligible                         | Financial   |
| BR-332     | Duplicate callback     | No double payout                 | Idempotency |
| Payout BRs | Provider failure       | Not paid                         | Integration |
| BR-324     | Analytics              | Payout distinct from Net Revenue | Data        |

## 12. Open Decisions

Provider-specific payout API belongs to Technical Design.
