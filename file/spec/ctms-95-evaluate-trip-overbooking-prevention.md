# CTMS-095 — Evaluate Trip Overbooking Prevention

## 1. Overview

Story: CTMS-095

Epic: EPIC 17. Reports and Evaluation Metrics

Use Case: Evaluate Trip Overbooking Prevention

Priority: Must Have

Goal: Evaluate Trip booking concurrency and verify that authoritative capacity protection prevents overbooking under concurrent booking scenarios.

Backlog story: As an Admin, I want to evaluate Trip overbooking prevention so I can verify correctness when multiple bookings occur concurrently.

Acceptance Criteria:

| Source  | Criterion                                                                                                  |
| ------- | ---------------------------------------------------------------------------------------------------------- |
| PB AC-1 | Evaluation runs concurrent booking scenarios.                                                              |
| PB AC-2 | Report transaction conflicts/retries.                                                                      |
| PB AC-3 | Report bookings rejected because capacity is full.                                                         |
| PB AC-4 | Report locking latency.                                                                                    |
| PB AC-5 | Mandatory release gate: `seats_taken` must never exceed `capacity_max` in any test case.                   |
| PB AC-6 | Evaluation does not use the removed `zone_lock_events` model.                                              |
| PB AC-7 | Report stores dataset/version, metric, threshold, applicable config/rule version and pass/fail conclusion. |

## 2. Scope

### In Scope

- Concurrent booking tests.
- Transaction conflicts/retries.
- Full-capacity rejection.
- Locking latency observation.
- Capacity invariant.
- Evaluation evidence.

### Out of Scope

- Implementing booking itself — CTMS-029.
- Implementing capacity protection — CTMS-024.
- `zone_lock_events`.

## 3. Actors & Authorization

Primary actor:

- Authorized Admin/evaluation process.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-024.

A controlled evaluation environment and concurrent booking scenarios exist.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                                                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-276     | Overbooking evaluation must run concurrent Booking scenarios and verify the release gate that seats_taken never exceeds capacity_max in any test case, i.e. zero overbooking. Transaction conflicts/retries, rejected full-capacity Bookings, and locking latency must also be reported.                                                                               |
| BR-282     | The V3 release gates defined in BR-276 through BR-281 and BR-434 through BR-438 are approved acceptance thresholds. Each evaluation report must store the dataset/version, metric value, threshold, rule/model/config version, and pass/fail conclusion. Metrics explicitly designated as observational are reported only and must not independently fail the release. |
| BR-188     | Absolute timestamps must be stored as timestamptz. Pure calendar dates use date, and time-of-day values use time where defined by schema. APIs must transmit timezone/offset explicitly, and the UI must display values using the configured timezone.                                                                                                                 |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                                                                  |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                                                                           |

## 6. State & Lifecycle

Evaluation configured
→ concurrent scenarios executed
→ metrics collected
→ release gate evaluated
→ report generated
→ Pass or Fail.

## 7. Business Flow

1. Prepare versioned evaluation scenario/dataset.
2. Configure Trip capacity.
3. Start concurrent booking requests.
4. Record transaction conflicts/retries.
5. Record full-capacity rejections.
6. Measure locking latency.
7. Observe authoritative `seats_taken`.
8. Verify every test case against `capacity_max`.
9. Calculate release result.
10. Persist evaluation evidence.

## 8. Data & Invariants

Mandatory release invariant:

`seats_taken ≤ capacity_max`

for every test case.

Release gate:

`overbooking count = 0`

Locking latency is reported but is not a standalone V3 failure threshold unless separately defined.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                    | Expected Behavior                           |
| --------------------------------------- | ------------------------------------------- |
| High concurrency but capacity respected | Gate passes                                 |
| `seats_taken > capacity_max` once       | Gate fails                                  |
| Booking rejected at full capacity       | Record rejection                            |
| Transaction retry occurs                | Record retry                                |
| Lock latency high                       | Report observation; do not invent threshold |
| zone_lock_events used                   | Evaluation design invalid for current model |

## 11. Acceptance & Test Matrix

| Source | Scenario                           | Expected Result                 | Test Type               |
| ------ | ---------------------------------- | ------------------------------- | ----------------------- |
| BR-276 | Concurrent bookings                | Scenarios executed              | Performance/Concurrency |
| BR-276 | seats_taken never exceeds capacity | Pass gate                       | Evaluation              |
| BR-276 | seats_taken exceeds capacity       | Fail gate                       | Evaluation              |
| BR-276 | Conflict/retry                     | Reported                        | Metrics                 |
| BR-276 | Full capacity rejection            | Reported                        | Metrics                 |
| BR-282 | Evaluation report                  | Version/threshold/result stored | Traceability            |

## 12. Open Decisions

No numeric locking-latency release threshold is defined for V3; locking latency is observational.
