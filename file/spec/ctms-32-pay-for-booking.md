# CTMS-032 — Pay for Booking

## 1. Overview

Story: CTMS-032

Epic: EPIC 5. Booking and Payment

Use Case: Pay for Booking

Priority: Must Have

Goal: Process Booking payment exactly once using authoritative Booking amount and provider-confirmed payment state.

Backlog story: As a Camper, I want to pay for my Booking so my eligible paid Booking can become confirmed after successful payment.

Acceptance Criteria:

| Source  | Criterion                                                                  |
| ------- | -------------------------------------------------------------------------- |
| PB AC-1 | Payment may be initiated only for an eligible Booking.                     |
| PB AC-2 | Charge amount is calculated from authoritative Booking data.               |
| PB AC-3 | Every charge uses a unique idempotency mechanism.                          |
| PB AC-4 | Booking becomes paid/confirmed only after authoritative successful charge. |
| PB AC-5 | Duplicate callback/retry cannot apply the same payment twice.              |
| PB AC-6 | Failed or pending payment must not falsely confirm the Booking.            |
| PB AC-7 | Payment and Booking state remain transactionally consistent.               |

## 2. Scope

### In Scope

- Create charge transaction.
- Authoritative payment amount.
- Payment provider integration.
- Idempotency.
- Provider callback/reconciliation.
- Booking payment-state update.
- Booking confirmation after successful payment.

### Out of Scope

- Refund; CTMS-035.
- Booking cancellation.
- Provider-specific UI details.
- Settlement/payout except where a mapped financial rule requires accounting consistency.

## 3. Actors & Authorization

- Camper.
- Payment provider.
- System/backend.

Camper must be authorized for the Booking.

Provider callback must be authenticated/verified according to Technical Design.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-029.

Required:

- Booking exists.
- Booking is eligible for payment.
- Authoritative amount is available.
- Payment has not already been successfully applied.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-090 | Each charge must create a payment transaction with type = charge, a unique idempotency_key, amount >= 0, and parent_payment_id = NULL.                                                                                                                                                                                                                                                                                                                                                                     |
| BR-091 | When a charge transaction succeeds, booking.payment_status may transition to paid and booking.status to confirmed only if the Booking is still eligible for confirmation. If the Booking has already expired, been cancelled, or is otherwise no longer eligible when the callback arrives, the successful payment must still be recorded authoritatively, but the Booking must not be reactivated or confirmed. The funds must instead enter the policy-defined idempotent refund or reconciliation flow. |
| BR-092 | A callback or retry with the same idempotency key or transaction_ref must not create or apply the same successful transaction more than once.                                                                                                                                                                                                                                                                                                                                                              |
| BR-106 | A complaint/refund request created within 24 hours after trips.completed_at must be treated as a blocking financial claim until resolved. States pending, reviewing, and approved-refund-pending must block settlement and payout. Settlement may resume only after the request is resolved and all succeeded refunds are reflected in the financial ledger.                                                                                                                                               |
| BR-174 | All input must be validated for required fields, data type, format, length, enum membership, and cross-field relationships before processing.                                                                                                                                                                                                                                                                                                                                                              |
| BR-175 | The backend is the authoritative source for authorization, state, pricing, capacity, inventory, risk level, and transaction outcome. The client must not establish these values authoritatively.                                                                                                                                                                                                                                                                                                           |
| BR-176 | Any business operation that changes multiple tables or records must execute within a transaction. If any step fails, the entire operation must roll back.                                                                                                                                                                                                                                                                                                                                                  |
| BR-177 | A failed operation must not leave data, state, reserved capacity, money, or inventory in a partially processed condition.                                                                                                                                                                                                                                                                                                                                                                                  |
| BR-178 | Operations that may be retried, including payments, refunds, callbacks, and synchronization, must support idempotency so the same request cannot be successfully applied more than once.                                                                                                                                                                                                                                                                                                                   |
| BR-179 | When concurrent requests modify the same resource, the system must use transactions, locking, optimistic/version control, or an equivalent mechanism to prevent lost updates and violations of business limits.                                                                                                                                                                                                                                                                                            |
| BR-197 | When an external service times out or returns incomplete data, the system must record the failure, must not assume success, and must not fabricate unverifiable data.                                                                                                                                                                                                                                                                                                                                      |
| BR-198 | Retries to external services must be bounded and use backoff. Retrying must not create duplicate records or transactions.                                                                                                                                                                                                                                                                                                                                                                                  |
| BR-199 | APIs must use consistent error semantics: 401 for authentication failures, 403 for insufficient authorization, 404 for not found, 409 for business conflicts, and 422 for invalid input.                                                                                                                                                                                                                                                                                                                   |
| BR-200 | Error messages must clearly describe the problem and the user action required, while never exposing stack traces, secrets, or resources the user is not authorized to see.                                                                                                                                                                                                                                                                                                                                 |
| BR-209 | The UI must prevent duplicate submission while a request is in progress. Financial or resource-reservation actions may be presented as successful only after backend confirmation.                                                                                                                                                                                                                                                                                                                         |
| BR-211 | Any request rejected for authorization failure or an unmet business precondition must terminate before any state-changing commit and must not create side effects such as data updates, capacity holds, charges/refunds, notifications, or false business audit records.                                                                                                                                                                                                                                   |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                                                                                                                                                                                                      |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                                                                                                                                                                                                               |
| BR-225 | Every operational action must result in a success, pending, or failure state. When a conflict or connectivity failure occurs, the system must preserve user/local data in a recoverable state.                                                                                                                                                                                                                                                                                                             |

## 6. State & Lifecycle

Payment transaction:

`pending`
→ `succeeded`

or:

`pending`
→ `failed`

Booking:

eligible pre-payment state
→ successful authoritative charge
→ `payment_status = paid`
→ confirmed state according to Booking lifecycle.

A client redirect/success screen alone does not cause this transition.

## 7. Business Flow

1. Camper requests payment.
2. Backend authorizes Booking.
3. Reload current Booking.
4. Validate payment eligibility.
5. Calculate authoritative amount.
6. Create/reuse idempotent charge transaction.
7. Initiate provider payment.
8. Provider returns/callbacks.
9. Backend verifies provider result.
10. If succeeded, update payment transaction and Booking atomically.
11. If failed, record failure without confirming Booking.
12. Duplicate callbacks become no-op/reconciliation behavior.
13. Return authoritative payment/Booking state.

## 8. Data & Invariants

- One provider charge cannot be applied twice.
- Client amount is not authoritative.
- Successful client redirect is not payment proof.
- Booking cannot be confirmed by failed/pending payment.
- Payment status uses approved payment transaction enum.
- Provider transaction reference is unique where required.
- Financial arithmetic uses approved currency precision.
- Payment and Booking state cannot knowingly diverge.

## 9. API / Integration Contract

TBD — Technical Design.

Provider-specific signature verification, endpoint and callback payload belong to Technical Design.

## 10. Error & Edge Cases

| Case                         | Expected Behavior                                     |
| ---------------------------- | ----------------------------------------------------- |
| Booking already paid         | Do not charge again.                                  |
| Amount manipulated by client | Use server amount.                                    |
| Provider callback duplicated | No duplicate application.                             |
| Provider callback invalid    | Reject/no financial mutation.                         |
| Payment failed               | Booking not confirmed.                                |
| Payment pending              | Booking not falsely confirmed.                        |
| Concurrent payment attempts  | Idempotency/concurrency controls apply.               |
| DB commit fails              | Do not report authoritative success until reconciled. |

## 11. Acceptance & Test Matrix

| Source              | Scenario                  | Expected Result                    | Test Type   |
| ------------------- | ------------------------- | ---------------------------------- | ----------- |
| PB AC-1             | Ineligible Booking pays   | Rejected                           | State       |
| PB AC-2, BR-175     | Client changes amount     | Server amount used                 | Security    |
| PB AC-3, BR-090     | Charge created            | Unique idempotency identity        | Integration |
| PB AC-4, BR-091     | Provider confirms success | Booking paid/confirmed             | E2E         |
| PB AC-5, BR-092     | Callback repeated         | Applied once                       | Idempotency |
| PB AC-6             | Provider fails            | Booking not confirmed              | Integration |
| PB AC-7, BR-176/177 | Commit failure            | No inconsistent partial transition | Transaction |
| BR-179              | Concurrent attempts       | No double financial outcome        | Concurrency |

## 12. Open Decisions

Provider-specific contract and payment timeout are Technical Design concerns unless separately fixed by BR.
