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
| BR-340             | A Payout may be created only from a settled/payable balance > 0 in the Host's Wallet, after a valid trip settlement, and only when no blocking financial exception remains. The Host inputs receiving bank details (bank name, account number, uppercase account holder name) and requested withdrawal amount (capped at available balance). |
| BR-341             | Manual Bank Transfer Payout Flow: The Payout starts in `pending` ("Awaiting Admin Reconciliation & Bank Transfer"). The Admin reviews the beneficiary bank information, performs manual bank transfer outside the system, and confirms on the Admin portal (`/admin/payouts`) with transaction reference code (`transactionRef`). |
| BR-342             | A succeeded Payout must store authoritative bank transaction reference code (`transactionRef`) and optional admin note. Any rejection must record `rejectionReason`, release reserved wallet funds back to the Host, and write an `AuditLog`.                                                                                    |
| BR-332             | Callbacks or retries for charge, refund, settlement, payout, or adjustment must be idempotent. The same business/provider reference must not cause a double charge, refund, settlement, payout, or adjustment.                                                                                                                     |
| BR-346             | A cancelled Trip/Booking that has received a full refund under policy must not generate a payout for the refunded amount. Any pending settlement/payout must revalidate the current financial state before commit.                                                                                                                 |
| BR-347             | Every settlement, fee, adjustment, payout, and manual reconciliation must be traceable to the corresponding Host, Trip, Booking/original payment and must be audited under the critical-action policy.                                                                                                                             |
| BR-348             | Notifications about payout or financial status may be emitted only after the authoritative financial transaction/state commits. Delivery failure must not roll back the committed settlement or payout.                                                                                                                            |
| BR-349             | Admin and Host UIs must clearly distinguish Held, Settled/Payable, Payout Pending, Payout Succeeded, Payout Failed, and Refund/Adjustment states so users do not misinterpret the state of funds.                                                                                                                                 |
| BR-324             | Payout amount and Net Revenue are different KPIs. Net Revenue represents the Host's entitlement after settlement/adjustments, while Payout is the actual cash transfer to the Host.                                                                                                                                                |

## 6. State & Lifecycle

Host Wallet Balance
→ Request Payout (inputs bank details, status = `pending`)
→ Admin reviews at `/admin/payouts`
→ Admin manually transfers via bank
→ Admin confirms transfer with `transactionRef` → `succeeded` (deducts wallet balance)
or
→ Admin rejects with `rejectionReason` → `failed` (restores wallet balance)

## 7. Business Flow

1. Host reviews available balance in Host Wallet.
2. Host initiates Payout Request with beneficiary bank account details (Bank Name, Account Number, Account Holder Name).
3. System verifies `amount <= available_balance` and locks requested funds, setting Payout status = `pending`.
4. Admin opens Admin Payout Management (`/admin/payouts`).
5. Admin performs manual bank transfer to Host's specified bank account.
6. Admin confirms transfer: enters bank transaction reference code and optional reconciliation note.
7. System transitions Payout to `succeeded`, finalizes deduction from Host Wallet, and logs `AuditLog`.
8. In case of rejection: Admin provides rejection reason, system sets Payout to `failed`, unlocks reserved funds back to Host Wallet, and logs `AuditLog`.

## 8. Data & Invariants

- Held Funds cannot be paid directly before settlement eligibility.
- Same payout obligation must not be transferred twice.
- Pending/failed ≠ succeeded.
- Beneficiary bank details (bankName, accountNumber, accountHolderName) stored in payout metadata.
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
