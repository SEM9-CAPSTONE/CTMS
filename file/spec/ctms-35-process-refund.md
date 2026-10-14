# CTMS-035 — Process Refund

## 1. Overview

Story: CTMS-035

Epic: EPIC 5. Booking and Payment

Use Case: Process Refund

Priority: Must Have

Goal: Process an approved Booking refund exactly once while keeping charge, refund, Booking payment status, Held Funds and settlement accounting consistent.

Backlog story: As the System, I want to process eligible refunds so money is returned according to policy without duplicate or over-refund.

Acceptance Criteria:

| Source  | Criterion                                                                                     |
| ------- | --------------------------------------------------------------------------------------------- |
| PB AC-1 | Refund is created only from an eligible succeeded charge and approved refund obligation.      |
| PB AC-2 | Refund uses a `refund` payment transaction linked to its parent charge.                       |
| PB AC-3 | Refund transaction uses only the authoritative payment transaction statuses.                  |
| PB AC-4 | Cumulative succeeded/pending policy-approved refund must not exceed refundable charge amount. |
| PB AC-5 | Refund execution is idempotent and provider-reconcilable.                                     |
| PB AC-6 | Successful pre-settlement refund adjusts Held Funds/settlement base consistently.             |
| PB AC-7 | Pending/failed refund is not treated as succeeded.                                            |
| PB AC-8 | Refund modal auto-fills default linked bank account and allows selecting or adding accounts.  |
| PB AC-9 | Refund submission strictly verifies accountHolderName matches camper's registered fullName.   |

## 2. Scope

### In Scope

- Create refund transaction.
- Parent charge relationship.
- Refund amount validation.
- Provider refund.
- Idempotency.
- Reconciliation.
- Booking payment-state derivation.
- Held Funds/settlement interaction.

### Out of Scope

- Deciding cancellation eligibility; CTMS-034.
- Creating original charge; CTMS-032.
- Payout execution except accounting interaction required by refund rules.

## 3. Actors & Authorization

- System.
- Payment provider.
- Authorized administrative/recovery actor where explicitly permitted.

No client may directly mark a refund succeeded.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-032.
- CTMS-034.
- CTMS-038.

Required:

- Eligible parent charge exists.
- Refund amount is approved by policy.
- Refund has not already been fully applied.
- Camper profile has registered `fullName` for account name verification (BR-351).

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-103     | A Camper-initiated refund request may be created only when either (a) the Booking was cancelled before trips.starts_at, or (b) a complaint/refund request for completed participation is submitted no later than 24 hours after trips.completed_at. Requests outside these two windows must be rejected. Refund obligations caused by Host/System Trip cancellation are not limited by the Camper request window. |
| BR-104     | For a Camper refund request made before Trip start, the system must complete request processing and, if approved, create/submit the provider refund transaction within 24 hours of refund_requested_at. External provider settlement time must be tracked through transaction status and must never restore Trip participation rights.                                                                            |
| BR-105     | A refund must create a payment transaction with type = refund, parent_payment_id referencing the original successful charge, a unique idempotency_key, and status = pending/succeeded/failed. The combined amount of pending + succeeded refunds for the same obligation must not exceed the eligible paid amount. provider transaction_ref, when available, must be stored for callback reconciliation.          |
| BR-106     | A complaint/refund request created within 24 hours after trips.completed_at must be treated as a blocking financial claim until resolved. States pending, reviewing, and approved-refund-pending must block settlement and payout. Settlement may resume only after the request is resolved and all succeeded refunds are reflected in the financial ledger.                                                      |
| BR-336     | Every succeeded refund before settlement must reduce Held Funds and the settlement base accordingly. An approved refund that is still awaiting provider completion must continue to block settlement. Pending or failed refunds must not be treated as succeeded.                                                                                                                                                 |
| BR-343     | Ordinary Camper refunds must be handled before settlement within the defined request windows. A succeeded refund reduces Held Funds/the settlement base, and no payout may be created for the refunded amount.                                                                                                                                                                                                    |
| BR-350     | User Bank Account Management: Users (both Camper and Host) can link, manage, and delete receiving bank accounts (`user_bank_accounts`), with one designated default account. When adding the first account, it automatically becomes the default. When deleting the default account, the next remaining account becomes the default.                                                              |
| BR-351     | Strict Account Holder Name Matching: The beneficiary bank account holder name (`accountHolderName`) MUST match the registered user's full name (`users.full_name`). The system performs accent-insensitive, uppercase normalized comparison (stripping Vietnamese NFD diacritics, mapping đ/Đ to d/D, collapsing whitespace). If the user has no registered full name or names mismatch, reject with HTTP 400. |
| BR-174     | All input must be validated for required fields, data type, format, length, enum membership, and cross-field relationships before processing.                                                                                                                                                                                                                                                                     |
| BR-175     | The backend is the authoritative source for authorization, state, pricing, capacity, inventory, risk level, and transaction outcome. The client must not establish these values authoritatively.                                                                                                                                                                                                                  |
| BR-176     | Any business operation that changes multiple tables or records must execute within a transaction. If any step fails, the entire operation must roll back.                                                                                                                                                                                                                                                         |
| BR-177     | A failed operation must not leave data, state, reserved capacity, money, or inventory in a partially processed condition.                                                                                                                                                                                                                                                                                         |
| BR-178     | Operations that may be retried, including payments, refunds, callbacks, and synchronization, must support idempotency so the same request cannot be successfully applied more than once.                                                                                                                                                                                                                          |
| BR-179     | When concurrent requests modify the same resource, the system must use transactions, locking, optimistic/version control, or an equivalent mechanism to prevent lost updates and violations of business limits.                                                                                                                                                                                                   |
| BR-180     | Every stateful resource must follow its defined state transitions and must not use values outside the database enum.                                                                                                                                                                                                                                                                                              |
| BR-181     | Before changing state, the system must validate the current state. A request based on stale state must be rejected with a business-conflict error.                                                                                                                                                                                                                                                                |
| BR-188     | Absolute timestamps must be stored as timestamptz. Pure calendar dates use date, and time-of-day values use time where defined by schema. APIs must transmit timezone/offset explicitly, and the UI must display values using the configured timezone.                                                                                                                                                            |
| BR-191     | Critical actions must be recorded in the audit log with actor, action, target, timestamp, and either before/after data or the reason for the change.                                                                                                                                                                                                                                                              |
| BR-192     | Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data.                                                                                                                                                                                                                                                                                                          |
| BR-194     | Notification/event side effects may be queued or emitted only after the primary business transaction commits successfully, preferably through an outbox/queue. Notification failure must not roll back the already-committed business result.                                                                                                                                                                     |
| BR-209     | The UI must prevent duplicate submission while a request is in progress. Financial or resource-reservation actions may be presented as successful only after backend confirmation.                                                                                                                                                                                                                                |
| BR-210     | When the backend rejects a request because of a concurrent data change, the UI must preserve the user's entered data, explain the conflict, and allow the user to reload or retry.                                                                                                                                                                                                                                |
| BR-211     | Any request rejected for authorization failure or an unmet business precondition must terminate before any state-changing commit and must not create side effects such as data updates, capacity holds, charges/refunds, notifications, or false business audit records.                                                                                                                                          |
| BR-225     | Every operational action must result in a success, pending, or failure state. When a conflict or connectivity failure occurs, the system must preserve user/local data in a recoverable state.                                                                                                                                                                                                                    |

## 6. State & Lifecycle

Refund transaction:

No refund
→ `pending`
→ `succeeded`

or:

`pending`
→ `failed`

There is no `payment.status = refunded`.

Booking payment status is derived from charge/refund results according to the authoritative financial model.

## 7. Business Flow

1. Camper initiates refund request (or approved obligation is created):
   - System retrieves Camper's linked bank accounts (`GET /profiles/me/bank-accounts`), automatically pre-selecting the default bank account and populating `bankName`, `accountNumber`, `accountHolderName`.
   - Camper can select any other linked bank account or add a new bank account.
2. Load Booking and parent succeeded charge.
3. Calculate remaining refundable amount against policy limits.
4. Validate requested refund and BR-351 strict name matching:
   - `accountHolderName` must match normalized `camper.fullName` (accent-insensitive, uppercase). If mismatched or `fullName` is missing, reject immediately with HTTP 400.
   - Create/reuse idempotent refund transaction with status = `pending`.
5. Store beneficiary bank account details in refund payment record metadata.
6. Admin reviews refund requests via Admin Management (`/admin/refunds`):
   - **Manual Transfer Confirmation**: Admin performs manual bank transfer to Camper's bank account, then confirms transfer on Admin portal with reference transaction code/bill and optional note.
   - **Rejection**: If refund claim is invalid, Admin rejects with clear reason.
7. On Admin Confirmation (`confirm`):
   - set refund transaction to `succeeded`;
   - record provider/transfer transaction reference;
   - update derived Booking financial state;
   - reduce applicable Held Funds/settlement base;
   - record audit log entry.
8. While in `pending`:
   - preserve pending state ("Awaiting Admin Reconciliation & Bank Transfer");
   - block incompatible settlement where required.
9. On Rejection / Failure (`reject`):
   - record failed status with rejection reason;
   - do not treat money as returned;
   - release settlement block if no other pending claims exist.
10. Reconcile retries/idempotency keys safely.

## 8. Data & Invariants

- User bank accounts stored in `user_bank_accounts` linked to `users(id)`.
- At most one bank account marked `isDefault = true` per user at any time.
- `accountHolderName` must strictly match normalized `user.fullName` (BR-351).
- Refund links to parent charge.
- Refund transaction status ∈ `{pending, succeeded, failed}`.
- Beneficiary bank details (bank name, account number, account holder name) stored in payment metadata.
- No `refunded` transaction status.
- Sum of applicable refunds ≤ refundable succeeded charge.
- Same refund cannot be applied twice.
- Pending refund is not succeeded refund.
- Failed refund is not succeeded refund.
- Refunded amount cannot remain in ordinary settlement base.

## 9. API / Integration Contract

- `GET /profiles/me/bank-accounts`: List current user's linked bank accounts.
- `POST /profiles/me/bank-accounts`: Add new bank account with name matching validation (BR-351).
- `DELETE /profiles/me/bank-accounts/:id`: Delete linked bank account (next account promoted to default if default deleted).
- `PATCH /profiles/me/bank-accounts/:id/default`: Set default bank account.
- `GET /bookings/:bookingId/refunds`: Get refund eligibility, policy windows, and refund history for a booking (Admin/Camper).
- `POST /bookings/:bookingId/refunds`: Submit refund request with bank details (`bankName`, `accountNumber`, `accountHolderName`, `reason`, `amount`) and name match validation (BR-351).
- `GET /admin/refunds`: Retrieve all refund requests with pagination and status filters (Admin only).
- `POST /admin/refunds/:obligationId/confirm`: Confirm manual transfer completed with `transactionRef` and optional `note` (Admin only).
- `POST /admin/refunds/:obligationId/reject`: Reject refund request with `rejectionReason` (Admin only).
- `GET /trips/:tripId/settlement-status`: Get settlement blocking status and Held Funds accounting for a Trip.

## 10. Error & Edge Cases

| Case                                           | Expected Behavior                                                 |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| User missing full name                         | Reject bank addition / refund request; prompt to update profile   |
| Account holder name mismatch                   | Reject with 400 explaining name must match registered full name   |
| Adding duplicate bank account                  | Reject with 409 conflict                                          |
| Deleting active default bank                   | Next remaining account promoted to default                        |
| Parent charge not succeeded                    | Reject refund.                                                    |
| Requested refund exceeds remainder             | Reject.                                                           |
| Duplicate callback                             | Apply once.                                                       |
| Provider timeout                               | Keep/reconcile pending state; no false success.                   |
| Provider fails refund                          | Mark failed according to provider result.                         |
| Settlement tries while blocking refund pending | Enforce settlement rule.                                          |
| Concurrent refund requests exceed charge       | Concurrency protection prevents over-refund.                      |

## 11. Acceptance & Test Matrix

| Source              | Scenario                          | Expected Result                                       | Test Type             |
| ------------------- | --------------------------------- | ----------------------------------------------------- | --------------------- |
| PB AC-1             | Valid refund obligation           | Refund processing allowed                             | Integration           |
| PB AC-2, BR-103     | Refund created                    | Linked refund transaction                             | Integration           |
| PB AC-3, BR-104     | Refund lifecycle                  | Only allowed transaction statuses                     | State                 |
| PB AC-4, BR-105/106 | Over-refund attempted             | Rejected                                              | Boundary              |
| PB AC-5             | Callback retried                  | No duplicate refund                                   | Idempotency           |
| PB AC-6, BR-336     | Refund succeeds before settlement | Held Funds adjusted                                   | Financial Integration |
| PB AC-7, BR-343     | Refund pending                    | Not treated as settled/succeeded                      | Financial Integration |
| PB AC-8, BR-350     | Default bank pre-fill             | User's default bank pre-selected in refund modal      | UI / Integration      |
| PB AC-9, BR-351     | Name mismatch rejected            | HTTP 400 with message requiring match with fullName   | Validation / Unit     |

## 12. Open Decisions

Recovery for a refund requested after ordinary Host payout has already completed requires an explicit post-payout recovery mechanism if that scenario is supported. It must not be invented here.
