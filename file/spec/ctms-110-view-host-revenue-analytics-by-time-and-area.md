# CTMS-110 — View Host Revenue Analytics by Time and Area

## 1. Overview

Story: CTMS-110

Epic: EPIC 17. Reports and Evaluation Metrics

Use Case: View Host Revenue Analytics by Time and Area

Priority: Should Have

Goal: Provide authorized Host revenue analytics from authoritative financial records using stable time, area, currency, and financial-state semantics.

Backlog story: As a Host, I want revenue analytics by time and area so I can understand my actual financial performance.

Acceptance Criteria:

| Source   | Criterion                                                                                   |
| -------- | ------------------------------------------------------------------------------------------- |
| PB AC-1  | Host sees only own authorized financial scope.                                              |
| PB AC-2  | Area reporting uses Trip province/city snapshot.                                            |
| PB AC-3  | Gross Revenue uses eligible successful captured charges.                                    |
| PB AC-4  | Refund Amount uses succeeded refunds.                                                       |
| PB AC-5  | Platform Fee uses actual settlement fee snapshot.                                           |
| PB AC-6  | Net Revenue and Payout are distinct KPIs.                                                   |
| PB AC-7  | Held/Pending funds are separate from settled/payable and paid-out amounts.                  |
| PB AC-8  | KPI date basis is fixed and disclosed.                                                      |
| PB AC-9  | Different currencies are not directly summed.                                               |
| PB AC-10 | Actual revenue uses authoritative financial ledger and remains traceable to source records. |

## 2. Scope

### In Scope

- Gross Revenue.
- Refund Amount.
- Platform Fee.
- Net Revenue.
- Payout.
- Held/Pending funds.
- Time/area filters.

### Out of Scope

- Estimated operational revenue treated as actual.
- Cross-currency addition without approved FX policy.

## 3. Actors & Authorization

Primary actor:

- Host.

Admin only according to granted reporting/administration permission.

## 4. Preconditions & Dependencies

Authoritative financial ledger exists.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-318 | A Host may view revenue analytics only for Trips and financial records within that Host's own business scope. Admin access is limited to granted reporting/administrative permissions.                                                                                                                                                                                                     |
| BR-319 | Revenue Analytics V3 uses the Trip's province_code/city_code snapshot as the authoritative geographic dimension for area reporting. The snapshot must be stored with the Trip so historical reports do not change when external geographic information changes.                                                                                                                            |
| BR-320 | Gross Revenue must be calculated from eligible successful captured/charge financial transactions, not from draft/pending Bookings or a client-provided total.                                                                                                                                                                                                                              |
| BR-321 | Refund Amount must be calculated from refund transactions with status = succeeded. Pending or failed refunds must remain distinct states and must not be treated as completed refunds.                                                                                                                                                                                                     |
| BR-322 | Platform Fee must come from the actual fee snapshotted/applied during settlement. Historical fees must not be recalculated using the current commission rate.                                                                                                                                                                                                                              |
| BR-324 | Payout amount and Net Revenue are different KPIs. Net Revenue represents the Host's entitlement after settlement/adjustments, while Payout is the actual cash transfer to the Host.                                                                                                                                                                                                        |
| BR-325 | Held/Pending funds must be displayed separately from settled/payable and paid-out amounts. Held Funds must not be presented as already paid-out revenue.                                                                                                                                                                                                                                   |
| BR-326 | Revenue analytics must support filtering by time range and Trip province/city snapshot. Each KPI must use a fixed date basis: Gross Revenue uses charge succeeded time; Refund Amount uses refund succeeded_at; Platform Fee and Net Revenue use settlement time; Payout uses payout succeeded_at; Trip operational KPIs use trips.starts_at. Reports must disclose the date basis in use. |
| BR-327 | The MVP must use one configured settlement/reporting currency per financial scope and must not directly aggregate transactions in different currencies. If a future release supports multi-currency, reports must either group by currency or convert using a separately defined FX policy/version before aggregation.                                                                     |
| BR-328 | Actual financial revenue must come from the payment/refund/settlement/adjustment/payout ledger. Any estimated operational revenue that remains in use must be labeled Estimated and kept separate from actual revenue.                                                                                                                                                                     |
| BR-329 | Every aggregated revenue figure must be traceable to its source Trip, Booking, and financial transactions within the permitted audit/reconciliation scope.                                                                                                                                                                                                                                 |

## 6. State & Lifecycle

Financial ledger
→ authorized filtering
→ KPI-specific date basis
→ currency grouping
→ aggregation
→ analytics.

## 7. Business Flow

1. Verify Host scope.
2. Select time/area filters.
3. Use Trip geographic snapshot.
4. Load ledger records.
5. Separate charges/refunds/settlements/payouts/held funds.
6. Apply KPI date basis.
7. Prevent invalid cross-currency aggregation.
8. Calculate analytics.
9. Display traceable results.

## 8. Data & Invariants

Date basis:

- Gross Revenue → charge succeeded time.
- Refund → refund succeeded_at.
- Platform Fee/Net Revenue → settlement time.
- Payout → payout succeeded_at.
- Trip operational KPI → trips.starts_at.

Held Funds ≠ Payout.

Net Revenue ≠ Payout.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                        | Expected Behavior                      |
| --------------------------- | -------------------------------------- |
| Pending charge              | Not Gross Revenue                      |
| Pending refund              | Not completed Refund Amount            |
| Held funds                  | Not shown as payout                    |
| Different currencies        | Do not directly sum                    |
| Area metadata later changes | Historical Trip snapshot remains basis |
| Unauthorized Host data      | Excluded                               |

## 11. Acceptance & Test Matrix

| Source | Scenario                 | Expected Result                | Test Type      |
| ------ | ------------------------ | ------------------------------ | -------------- |
| BR-320 | Successful charge        | Included in Gross Revenue      | Financial      |
| BR-321 | Pending refund           | Excluded from succeeded refund | Financial      |
| BR-322 | Fee config changes later | Historical fee unchanged       | Integrity      |
| BR-325 | Held funds               | Separate KPI                   | UI             |
| BR-327 | Multiple currencies      | Not directly summed            | Financial      |
| BR-329 | Aggregate                | Traceable to source            | Reconciliation |

## 12. Open Decisions

Exact chart/table presentation belongs to UI Design.
