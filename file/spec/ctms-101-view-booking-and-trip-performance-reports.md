# CTMS-101 — View Booking and Trip Performance Reports

## 1. Overview

Story: CTMS-101

Epic: EPIC 17. Reports and Evaluation Metrics

Use Case: View Booking and Trip Performance Reports

Priority: Should Have

Goal: Allow an authorized user to view operational Booking and Trip performance using permitted filters and authoritative data.

Backlog story: As an authorized user, I want to view Booking and Trip performance reports so I can understand operational performance.

Acceptance Criteria:

| Source  | Criterion                                                                                       |
| ------- | ----------------------------------------------------------------------------------------------- |
| PB AC-1 | Report supports filtering by time.                                                              |
| PB AC-2 | Report supports Trip province/city snapshot, Route, or Trip filters within authorization scope. |
| PB AC-3 | Report shows booking count.                                                                     |
| PB AC-4 | Report shows Trip fill rate.                                                                    |
| PB AC-5 | Report shows cancellation rate.                                                                 |
| PB AC-6 | Report shows Trip count.                                                                        |
| PB AC-7 | Estimated revenue, if shown, must be labeled Estimated.                                         |
| PB AC-8 | Actual revenue must come from the authoritative financial ledger.                               |

## 2. Scope

### In Scope

- Booking count.
- Trip fill rate.
- Cancellation rate.
- Trip count.
- Time/area/Route/Trip filtering.
- Estimated-vs-actual revenue distinction.

### Out of Scope

- Revenue Analytics detail — CTMS-110.
- Editing Booking/Trip state.

## 3. Actors & Authorization

Only authorized report users may access data within their permitted business scope.

## 4. Preconditions & Dependencies

Booking and Trip source data exists.

Applicable authorization scope is known.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-283     | Authorized performance reports must support filtering by time, Trip province/city snapshot, Route, or Trip within the viewer's scope and must show Booking count, Trip fill rate, cancellation rate, and Trip count. Any estimated revenue must be labeled Estimated; actual revenue must come from the authoritative financial ledger. |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                                   |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                                            |

## 6. State & Lifecycle

Read-only reporting:

authoritative operational data
→ authorized filters
→ aggregation
→ report.

## 7. Business Flow

1. User opens report.
2. System verifies authorization.
3. User applies permitted filters.
4. System queries authoritative data.
5. Calculate operational metrics.
6. Label estimated financial data where applicable.
7. Display report.

## 8. Data & Invariants

Actual financial data must not be calculated from draft/client totals.

Historical area filtering uses applicable Trip geographic snapshot.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                     | Expected Behavior         |
| ------------------------ | ------------------------- |
| No matching data         | Valid empty report        |
| Unauthorized Trip        | Excluded/rejected         |
| Estimated revenue shown  | Clearly labeled Estimated |
| Actual revenue requested | Use authoritative ledger  |
| Invalid filter           | Reject                    |

## 11. Acceptance & Test Matrix

| Source | Scenario            | Expected Result       | Test Type   |
| ------ | ------------------- | --------------------- | ----------- |
| BR-283 | Filter by time      | Correct subset        | Integration |
| BR-283 | Filter by area      | Snapshot-based result | Integration |
| BR-283 | Operational metrics | Correct aggregates    | Data        |
| BR-283 | Estimated revenue   | Labeled Estimated     | UI          |
| BR-283 | Actual revenue      | Ledger-backed         | Integrity   |

## 12. Open Decisions

Exact report visualization belongs to UI Design.
