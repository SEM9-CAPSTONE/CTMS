# CTMS-113 — Approve and Process Host Payout

## 1. Overview

Story: CTMS-113

Epic: EPIC 5. Booking and Payment

Use Case: Approve and Process Host Payout

Priority: Must Have

Goal: Transfer only eligible settled/payable Host funds through an authorized, traceable, and idempotent payout process.

Backlog story: As an authorized financial operator/system, I want to approve and process Host payout so settled Host entitlement can be transferred safely.

Acceptance Criteria:

| Source   | Criterion                                                                             |
| -------- | ------------------------------------------------------------------------------------- |
| PB AC-1  | Payout uses eligible settled/payable funds, not Held Funds.                           |
| PB AC-2  | Payout requires applicable authorization/approval.                                    |
| PB AC-3  | Payout amount is traceable to settlement/Host/source obligations.                     |
| PB AC-4  | Successful payout records authoritative success evidence/time.                        |
| PB AC-5  | Failed/pending payout is not treated as paid.                                         |
| PB AC-6  | Retry/callback is idempotent and cannot double-pay Host.                              |
| PB AC-7  | Payout is distinct from Net Revenue.                                                  |
| PB AC-8  | Users (Camper and Host) can add, delete, and set default bank accounts.               |
| PB AC-9  | Account holder name must strictly match the registered user full name (normalized).   |
| PB AC-10 | Payout request automatically fills the default bank account, allowing account change. |

## 2. Scope

### In Scope

- Payout eligibility.
- User bank account management (Add, Delete, Set Default).
- Strict account holder name matching validation against user profile.
- Auto-fill of default bank account during payout request.
- Approval.
- Transfer processing.
- Status.
- Financial traceability.
- Idempotency.

### Out of Scope

- Settlement calculation — CTMS-112.
- Post-payout financial exception reconciliation — CTMS-114.

## 3. Actors & Authorization

- Host (creates bank account, requests payout).
- Authorized financial/Admin actor where approval is required.
- System/payment provider.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-112.
- User profile has registered `fullName`.

Eligible settled/payable Host entitlement exists.

## 5. Business Rules

| BR                 | Rule                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-340             | A Payout may be created only from a settled/payable balance > 0 in the Host's Wallet, after a valid trip settlement, and only when no blocking financial exception remains. The Host selects from linked bank accounts (auto-filled from default) or inputs new bank details, and requests full wallet withdrawal.                                                                                   |
| BR-341             | Manual Bank Transfer Payout Flow: The Payout starts in `pending` ("Awaiting Admin Reconciliation & Bank Transfer"). The Admin reviews the beneficiary bank information, performs manual bank transfer outside the system, and confirms on the Admin portal (`/admin/payouts`) with transaction reference code (`transactionRef`).                                                                         |
| BR-342             | A succeeded Payout must store authoritative bank transaction reference code (`transactionRef`) and optional admin note. Any rejection must record `rejectionReason`, release reserved wallet funds back to the Host, and write an `AuditLog`.                                                                                                                                                      |
| BR-350             | User Bank Account Management: Users (both Camper and Host) can link, manage, and delete receiving bank accounts (`user_bank_accounts`), with one designated default account. When adding the first account, it automatically becomes the default. When deleting the default account, the next remaining account becomes the default.                                                              |
| BR-351             | Strict Account Holder Name Matching: The beneficiary bank account holder name (`accountHolderName`) MUST match the registered user's full name (`users.full_name`). The system performs accent-insensitive, uppercase normalized comparison (stripping Vietnamese NFD diacritics, mapping đ/Đ to d/D, collapsing whitespace). If the user has no registered full name or names mismatch, reject with HTTP 400. |
| BR-332             | Callbacks or retries for charge, refund, settlement, payout, or adjustment must be idempotent. The same business/provider reference must not cause a double charge, refund, settlement, payout, or adjustment.                                                                                                                                                                                       |
| BR-346             | A cancelled Trip/Booking that has received a full refund under policy must not generate a payout for the refunded amount. Any pending settlement/payout must revalidate the current financial state before commit.                                                                                                                                                                                   |
| BR-347             | Every settlement, fee, adjustment, payout, and manual reconciliation must be traceable to the corresponding Host, Trip, Booking/original payment and must be audited under the critical-action policy.                                                                                                                                                                                               |
| BR-348             | Notifications about payout or financial status may be emitted only after the authoritative financial transaction/state commits. Delivery failure must not roll back the committed settlement or payout.                                                                                                                                                                                              |
| BR-349             | Admin and Host UIs must clearly distinguish Held, Settled/Payable, Payout Pending, Payout Succeeded, Payout Failed, and Refund/Adjustment states so users do not misinterpret the state of funds.                                                                                                                                                                                                   |
| BR-324             | Payout amount and Net Revenue are different KPIs. Net Revenue represents the Host's entitlement after settlement/adjustments, while Payout is the actual cash transfer to the Host.                                                                                                                                                                                                                  |

## 6. State & Lifecycle

Host Wallet Balance
→ Request Payout (auto-fills default bank account or selects linked account, validates name match BR-351, status = `pending`)
→ Admin reviews at `/admin/payouts`
→ Admin manually transfers via bank
→ Admin confirms transfer with `transactionRef` → `succeeded` (deducts wallet balance)
or
→ Admin rejects with `rejectionReason` → `failed` (restores wallet balance)

## 7. Business Flow

1. Host reviews available balance in Host Wallet (`/host/wallet`).
2. Host clicks "Rút toàn bộ số dư" (Host Payout Modal opens).
3. System loads Host's linked bank accounts (`GET /profiles/me/bank-accounts`), automatically pre-selecting the default bank account and filling `bankName`, `accountNumber`, `accountHolderName`.
4. Host may choose another linked bank account or add a new bank account.
5. On submission, system validates BR-351: `accountHolderName` must match `host.fullName` (normalized, accent-insensitive). If mismatched or `fullName` is missing, reject immediately.
6. System verifies `amount <= available_balance` and locks requested funds, setting Payout status = `pending`.
7. Admin opens Admin Payout Management (`/admin/payouts`).
8. Admin performs manual bank transfer to Host's specified bank account.
9. Admin confirms transfer: enters bank transaction reference code (`transactionRef`) and optional reconciliation note.
10. System transitions Payout to `succeeded`, finalizes deduction from Host Wallet, and logs `AuditLog`.
11. In case of rejection: Admin provides rejection reason, system sets Payout to `failed`, unlocks reserved funds back to Host Wallet, and logs `AuditLog`.

## 8. Data & Invariants

- User bank accounts stored in `user_bank_accounts` linked to `users(id)`.
- At most one bank account marked `isDefault = true` per user at any time.
- `accountHolderName` must match normalized `user.fullName`.
- Held Funds cannot be paid directly before settlement eligibility.
- Same payout obligation must not be transferred twice.
- Pending/failed ≠ succeeded.
- Beneficiary bank details (bankName, accountNumber, accountHolderName) stored in payout metadata.
- Payout amount ≠ Net Revenue KPI by definition.

## 9. API / Integration Contract

- `GET /profiles/me/bank-accounts`: List current user's linked bank accounts.
- `POST /profiles/me/bank-accounts`: Add new bank account with name matching validation.
- `DELETE /profiles/me/bank-accounts/:id`: Delete linked bank account.
- `PATCH /profiles/me/bank-accounts/:id/default`: Set default bank account.
- `POST /settlements/host/payout`: Submit full-amount payout request with bank details and name match validation.
- `POST /settlements/admin/payouts/:id/confirm`: Admin confirms manual bank transfer.
- `POST /settlements/admin/payouts/:id/reject`: Admin rejects payout and restores balance.

## 10. Error & Edge Cases

| Case                           | Expected Behavior                                                 |
| ------------------------------ | ----------------------------------------------------------------- |
| User missing full name         | Reject bank addition / payout with error to update profile first  |
| Account holder name mismatch   | Reject with 400 explaining name must match registered full name   |
| Adding duplicate bank account  | Reject with 409 conflict                                          |
| Deleting active default bank   | Next remaining account promoted to default                        |
| Funds still Held               | Reject payout                                                     |
| Eligible payable amount        | Process                                                           |
| Duplicate provider callback    | No duplicate payout                                               |
| Provider failure               | Not marked paid                                                   |
| Unauthorized approval          | Reject                                                            |
| Successful payout              | Record success evidence                                           |

## 11. Acceptance & Test Matrix

| Source     | Scenario                  | Expected Result                     | Test Type   |
| ---------- | ------------------------- | ----------------------------------- | ----------- |
| BR-351     | Matching normalized name  | Validated successfully              | Unit        |
| BR-351     | Mismatched holder name    | Rejected with HTTP 400              | Unit        |
| BR-351     | Missing user full name    | Rejected with profile update prompt | Validation  |
| BR-350     | Add first bank account    | Automatically default               | Functional  |
| BR-350     | Delete default account    | Next account becomes default        | Functional  |
| BR-340     | Auto-fill default account | Pre-populated in payout modal       | UI / E2E    |
| Payout BRs | Settled payable amount    | Eligible                            | Financial   |
| BR-332     | Duplicate callback        | No double payout                    | Idempotency |
| BR-324     | Analytics                 | Payout distinct from Net Revenue    | Data        |

## 12. Open Decisions

None. All rules aligned with manual transfer flow and strict full name verification.
