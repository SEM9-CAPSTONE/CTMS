# CTMS-087 — View Overview of Bookings, Routes, Porters and Alerts

## 1. Overview

Story: CTMS-087

Epic: EPIC 14. Host Operations and Monitoring

Use Case: View Overview of Bookings, Routes, Porters and Alerts

Priority: Should Have

Goal: Provide Host with an operational dashboard summarizing current booking, Trip, Porter, Route, SOS, and Weather Risk context from authorized authoritative sources.

Backlog story: As a Host, I want an operational overview so I can quickly understand the current state of my trekking operations.

Acceptance Criteria:

| Source  | Criterion                                                          |
| ------- | ------------------------------------------------------------------ |
| PB AC-1 | Dashboard includes today's bookings.                               |
| PB AC-2 | Dashboard includes active Trips.                                   |
| PB AC-3 | Dashboard includes Porter context.                                 |
| PB AC-4 | Dashboard includes Route context.                                  |
| PB AC-5 | Dashboard includes SOS alerts.                                     |
| PB AC-6 | Dashboard includes Weather Risk.                                   |
| PB AC-7 | Data must come only from sources the Host is authorized to access. |

## 2. Scope

### In Scope

- Today's bookings.
- Active Trips.
- Porter context.
- Route context.
- SOS alerts.
- Weather Risk.

### Out of Scope

- Editing source entities from dashboard unless delegated to corresponding feature.
- Financial analytics.
- Historical business intelligence.

## 3. Actors & Authorization

Primary actor:

- Host.

Dashboard aggregates only information within Host authorization scope.

## 4. Preconditions & Dependencies

Underlying booking, Trip, Porter, Route, SOS and Weather Risk sources are available.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-270     | The Host dashboard must aggregate operational KPIs including today's Bookings, active Trips, Porter/Route context, SOS alerts, and Weather Risk using authorized data sources.        |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done. |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.          |

## 6. State & Lifecycle

Read-only aggregation:

authorized source data
→ dashboard aggregation
→ Host view.

Dashboard does not create a new authoritative business state.

## 7. Business Flow

1. Host opens dashboard.
2. Verify Host identity/authorization.
3. Query today's booking context.
4. Query active Trips.
5. Query Porter/Route context.
6. Query SOS alerts.
7. Query Weather Risk.
8. Aggregate.
9. Display operational overview.

## 8. Data & Invariants

Dashboard is derived data.

Authoritative state remains in the source domains.

Dashboard must not fabricate missing source data or infer unsupported operational state.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                               | Expected Behavior                        |
| ---------------------------------- | ---------------------------------------- |
| No bookings today                  | Valid zero/empty state                   |
| No active Trips                    | Valid empty state                        |
| SOS exists                         | Included if authorized                   |
| Weather data unavailable           | Do not fabricate risk                    |
| Unauthorized Trip                  | Excluded                                 |
| One source temporarily unavailable | Handle explicitly without inventing data |

## 11. Acceptance & Test Matrix

| Source | Scenario               | Expected Result | Test Type   |
| ------ | ---------------------- | --------------- | ----------- |
| BR-270 | Today's bookings exist | Displayed       | Integration |
| BR-270 | Active Trip exists     | Displayed       | Integration |
| BR-270 | SOS exists             | Displayed       | Integration |
| BR-270 | Weather Risk exists    | Displayed       | Integration |
| BR-270 | Unauthorized data      | Excluded        | Security    |

## 12. Open Decisions

Exact KPI card layout belongs to UI Design.
