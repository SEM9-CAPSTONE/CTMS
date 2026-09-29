# CTMS-112 — Settle Trip Revenue and Calculate Platform Fee

## 1. Overview

Story: CTMS-112

Epic: EPIC 5. Booking and Payment

Use Case: Settle Trip Revenue and Calculate Platform Fee

Priority: Must Have

Goal: Settle eligible Trip revenue only after the approved hold/complaint conditions are satisfied and snapshot the applicable Platform Fee rule.

Backlog story: As the System, I want to settle completed Trip revenue and calculate Platform Fee so Host entitlement is finalized consistently.

Acceptance Criteria:

| Source  | Criterion                                                                                |
| ------- | ---------------------------------------------------------------------------------------- |
| PB AC-1 | Settlement requires Trip `completed`.                                                    |
| PB AC-2 | Settlement requires `now ≥ trips.completed_at + 72h`.                                    |
| PB AC-3 | Camper 24-hour complaint window must have ended.                                         |
| PB AC-4 | No blocking complaint/refund claim may remain pending/reviewing/approved-refund-pending. |
| PB AC-5 | If a blocking claim remains after 72h, settlement stays held until resolved.             |
| PB AC-6 | Commission rate comes from configuration, not hard-coded logic.                          |
| PB AC-7 | Settlement snapshots the applicable commission rate/rule.                                |
| PB AC-8 | Retry cannot create duplicate settlement.                                                |

## 2. Scope

### In Scope

- Settlement eligibility.
- 72-hour hold.
- Complaint/refund blocking.
- Platform Fee calculation.
- Commission snapshot.
- Net entitlement.

### Out of Scope

- Cash payout — CTMS-113.
- Post-payout reconciliation — CTMS-114.

## 3. Actors & Authorization

Primary actor:

- System/authorized financial process.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-111.

Trip is completed and Held Funds exist.

## 5. Business Rules

| BR                 | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-333             | The commission/platform-fee rate must come from system configuration. Business logic must not hard-code a fixed rate.                                                                                                                                                                                                                                                                                                                                        |
| BR-334             | When a settlement is created, the system must snapshot the applicable commission rate/rule so later configuration changes cannot alter financial history.                                                                                                                                                                                                                                                                                                    |
| BR-335             | A settlement may be created only when Trip status = completed, now >= trips.completed_at + 72 hours, the 24-hour Camper complaint window has ended, and no blocking complaint/refund claim remains in pending, reviewing, or approved-refund-pending state. If a blocking claim still exists at the 72-hour point, settlement must remain on hold until the claim is resolved. The backend must revalidate all conditions within the settlement transaction. |
| BR-332             | Callbacks or retries for charge, refund, settlement, payout, or adjustment must be idempotent. The same business/provider reference must not cause a double charge, refund, settlement, payout, or adjustment.                                                                                                                                                                                                                                               |
| BR-336             | Every succeeded refund before settlement must reduce Held Funds and the settlement base accordingly. An approved refund that is still awaiting provider completion must continue to block settlement. Pending or failed refunds must not be treated as succeeded.                                                                                                                                                                                            |
| BR-337             | Platform Fee must be calculated server-side from the settlement base using the snapshotted fee rule and the currency's rounding rule.                                                                                                                                                                                                                                                                                                                        |
| BR-338             | Host net settlement = settlement base - platform fee ± approved financial adjustments. Each component must be stored separately for audit and reconciliation.                                                                                                                                                                                                                                                                                                |
| BR-339             | The same financial scope/version must not be successfully settled more than once. A retry must detect a completed settlement and return an idempotent result.                                                                                                                                                                                                                                                                                                |
| BR-344             | Settlement must not commit if a blocking complaint/refund claim is created or remains unresolved while the settlement transaction is running. If a race or concurrent update is detected, the settlement transaction must abort or retry rather than finalize payable balance from stale financial state.                                                                                                                                                    |

## 6. State & Lifecycle

Held
→ settlement eligibility check
→ blocked while claim exists

or

Held
→ Settled/Payable.

## 7. Business Flow

1. Trip completes.
2. Held Funds remain held.
3. Wait until at least completed_at +72h.
4. Verify complaint window ended.
5. Check blocking claims.
6. If blocking claim exists, remain held.
7. Resolve eligible settlement base.
8. Load configured commission rule.
9. Snapshot rule/rate.
10. Calculate Platform Fee and Host entitlement.
11. Persist settlement atomically/idempotently.

## 8. Data & Invariants

Settlement must preserve:

- settlement base;
- applied commission rule/rate snapshot;
- Platform Fee;
- Host entitlement;
- source financial references.

Changing current commission configuration must not rewrite historical settlement.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                               | Expected Behavior               |
| ---------------------------------- | ------------------------------- |
| Trip not completed                 | No settlement                   |
| completed +71h59m                  | No settlement                   |
| completed +72h with blocking claim | Remain held                     |
| Claim resolved after 72h           | Re-evaluate                     |
| Commission config changes later    | Historical settlement unchanged |
| Duplicate settlement job           | No duplicate settlement         |

## 11. Acceptance & Test Matrix

| Source | Scenario                | Expected Result      | Test Type   |
| ------ | ----------------------- | -------------------- | ----------- |
| BR-335 | Before 72h              | Held                 | Boundary    |
| BR-335 | 72h + no blocking claim | Eligible             | Financial   |
| BR-335 | Blocking claim          | Held                 | Financial   |
| BR-333 | Fee calculated          | Config rate used     | Unit        |
| BR-334 | Config later changes    | Snapshot preserved   | Integrity   |
| BR-332 | Retry                   | No double settlement | Idempotency |

## 12. Open Decisions

None for the 72-hour settlement and 24-hour complaint timing.
