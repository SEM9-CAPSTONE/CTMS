# CTMS-114 — Reconcile Financial Exceptions after Settlement or Payout

## 1. Overview

Story: CTMS-114

Epic: EPIC 5. Booking and Payment

Use Case: Reconcile Financial Exceptions after Settlement or Payout

Priority: Must Have

Goal: Correct financial obligations arising after settlement or payout without rewriting historical financial records or creating duplicate refunds/adjustments.

Backlog story: As an authorized financial operator/system, I want to reconcile financial exceptions after settlement or payout so later refunds and adjustments remain financially traceable.

Acceptance Criteria:

| Source  | Criterion                                                                                          |
| ------- | -------------------------------------------------------------------------------------------------- |
| PB AC-1 | Post-settlement/payout exception does not rewrite historical settlement/payout records.            |
| PB AC-2 | Required correction is represented through authoritative refund/adjustment/reconciliation records. |
| PB AC-3 | Adjustment is traceable to original Booking/Trip/settlement/payout obligation.                     |
| PB AC-4 | Retry is idempotent.                                                                               |
| PB AC-5 | Same obligation must not create duplicate refund/adjustment.                                       |
| PB AC-6 | Reconciliation actions are auditable.                                                              |

## 2. Scope

### In Scope

- Post-settlement refund exception.
- Post-payout exception.
- Financial adjustment.
- Reconciliation.
- Traceability.

### Out of Scope

- Rewriting completed settlement history.
- Rewriting succeeded payout history.

## 3. Actors & Authorization

- Authorized financial/Admin actor.
- System reconciliation process.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-112 and/or CTMS-113.
- A later financial obligation/exception exists.

## 5. Business Rules

| BR                               | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-332                           | Callbacks or retries for charge, refund, settlement, payout, or adjustment must be idempotent. The same business/provider reference must not cause a double charge, refund, settlement, payout, or adjustment.                                                                                                                                                                                                                                                                                                         |
| BR-345                           | After successful settlement/payout, the system must not accept ordinary Camper refunds outside the defined request windows. Provider chargebacks/reversals, Admin financial corrections, or equivalent exceptions must create new financial adjustment/reconciliation records and must not modify or delete successful settlement/payout history. V3 does not automatically create negative balances, offset future payouts, or directly debit the Host; recovery is handled manually by an Admin and must be audited. |
| BR-350                           | A GPS sample may participate in safety detection only when it belongs to the active Trip safety session and references the correct member, device, and session context.                                                                                                                                                                                                                                                                                                                                                |
| BR-351                           | Once OFF_ROUTE confirmation criteria are met, the client must warn the user immediately on-device and create a local safety event even with no network connectivity. At minimum, the event must include Trip/member context, event_time, location, distance_to_route, GPS accuracy, severity/status, and package/version context.                                                                                                                                                                                      |
| BR-191                           | Critical actions must be recorded in the audit log with actor, action, target, timestamp, and either before/after data or the reason for the change.                                                                                                                                                                                                                                                                                                                                                                   |
| BR-192                           | Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data.                                                                                                                                                                                                                                                                                                                                                                                                               |

## 6. State & Lifecycle

Historical settlement/payout remains immutable.

Later exception
→ reconciliation assessment
→ refund/adjustment/recovery record
→ resolved financial position.

## 7. Business Flow

1. Detect approved later refund/financial exception.
2. Resolve original Booking/Trip/financial chain.
3. Determine whether settlement/payout already occurred.
4. Calculate required correction under authoritative policy.
5. Create idempotent refund/adjustment/reconciliation entry.
6. Preserve original historical records.
7. Update current financial position.
8. Audit action.

## 8. Data & Invariants

Financial chain must remain traceable.

Historical settled/payout values are evidence of what actually occurred at that time.

Corrections are new ledger events, not destructive edits.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                     | Expected Behavior                     |
| ------------------------ | ------------------------------------- |
| Refund before settlement | Normal refund flow                    |
| Refund after settlement  | Reconciliation required               |
| Refund after payout      | Reconciliation/recovery required      |
| Duplicate callback       | No duplicate adjustment               |
| Original record missing  | Do not fabricate reconciliation chain |
| Historical settlement    | Preserve                              |

## 11. Acceptance & Test Matrix

| Source                       | Scenario               | Expected Result                   | Test Type   |
| ---------------------------- | ---------------------- | --------------------------------- | ----------- |
| Financial reconciliation BRs | Post-settlement refund | Adjustment/reconciliation created | Financial   |
| Financial reconciliation BRs | Post-payout refund     | Recovery path recorded            | Financial   |
| BR-332                       | Retry                  | No duplicate                      | Idempotency |
| BR-191                       | Reconciliation         | Audited                           | Audit       |
| Ledger rules                 | Historical record      | Unchanged                         | Integrity   |

## 12. Open Decisions

Exact recovery mechanism when Host has already received payout must follow the approved financial recovery policy; this spec does not invent automatic bank clawback behavior.
