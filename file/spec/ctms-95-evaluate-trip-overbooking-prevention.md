# CTMS-095 — Evaluate Trip Overbooking Prevention

## 1. Overview

Story: CTMS-095
Epic: EPIC 17. Reports and Evaluation Metrics
Use Case: Evaluate Trip Overbooking Prevention
Priority: Must Have

Goal:
Allow Admin to evaluate whether Trip overbooking prevention is release-ready under the approved V3 overbooking gate.

Acceptance summary:
The evaluation must run concurrent booking scenarios and PASS only when observed overbooking equals 0. The report must include transaction conflicts or retries, rejected full-capacity bookings, locking latency, dataset/version, metric values, thresholds, rule/config version, and pass/fail conclusion.

## 2. Scope

### In Scope

- Evaluation of the CTMS-024 overbooking prevention behavior.
- Concurrent booking scenarios that attempt to push `seats_taken` above `capacity_max`.
- Release-gate reporting for observed overbooking, transaction conflicts/retries, rejected full-capacity bookings, and locking latency.

### Out of Scope

- Implementing the booking transaction itself. CTMS-024 owns prevention behavior.
- Changing capacity policy, booking state definitions, or payment behavior.

## 3. Actors & Authorization

- Admin: reviews evaluation results and release readiness.
- System: runs the evaluation scenarios and records the report.
- Backend API: provides authoritative booking/capacity state used by the evaluation.

Only Admin or an authorized evaluation job may run or view the release-gate report.

## 4. Preconditions & Dependencies

- CTMS-024 overbooking prevention is available for evaluation.
- Test Trips have defined `capacity_max` and controlled booking state fixtures.
- Concurrent booking scenarios and expected capacity outcomes are versioned with the evaluation dataset.

## 5. Business Rules

| BR | Rule |
|---|---|
| BR-276 | Overbooking evaluation must run concurrent booking scenarios and verify that `seats_taken` never exceeds `capacity_max` in any test case. Release gate PASS requires 0 overbooking. Transaction conflicts/retries, rejected full-capacity bookings, and locking latency must be reported. |
| BR-282 | Evaluation reports for V3 release gates must store dataset/version, metric value, threshold, rule/model/config version, and pass/fail conclusion. Observational metrics are reported but do not independently fail the release. |
| BR-465 | Overbooking evaluation PASS requires observed overbooking = 0. |
| BR-188 | Evaluation timestamps, booking event ordering, and concurrent scenario timing must use the authoritative timezone and reject impossible time ranges. |
| BR-212 | Any change to the release gate, capacity rule, state transition, or API contract must update the spec, tests, and data documentation before Done. |
| BR-213 | The mapped overbooking rules must have valid-path and violation-path tests; concurrency and transaction behavior require integration or E2E coverage. |

## 6. State & Lifecycle

Evaluation result:

```text
Run evaluation scenarios
    ├── observed overbooking = 0 -> PASS
    └── observed overbooking > 0 -> FAIL
```

## 7. Business Flow

1. Admin or authorized evaluation job selects the versioned overbooking test dataset.
2. System runs concurrent booking attempts against Trips with known `capacity_max` and starting `seats_taken`.
3. System records accepted bookings, rejected full-capacity bookings, transaction conflicts/retries, and locking latency.
4. System calculates observed overbooking as any case where authoritative `seats_taken > capacity_max`.
5. Report PASS is recorded only when observed overbooking equals 0.
6. Report stores dataset/version, metric values, thresholds, rule/config version, and pass/fail conclusion.

## 8. Data & Invariants

- `capacity_max` is the authoritative Trip capacity ceiling for the evaluation.
- `seats_taken` must never exceed `capacity_max` after concurrent booking attempts settle.
- A rejected full-capacity booking is expected behavior, not overbooking.
- Transaction conflicts and retries are reported as operational observations but do not pass the gate if any overbooking occurs.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case | Expected Behavior |
|---|---|
| Dataset lacks Trip capacity or expected starting seat counts | Evaluation run is invalid and must not produce PASS. |
| Concurrent booking creates `seats_taken > capacity_max` | Evaluation FAILS. |
| Full-capacity booking is rejected and `seats_taken` remains unchanged | Scenario is recorded as expected prevention behavior. |
| Transaction conflict or retry occurs | Report the conflict/retry and verify final capacity remains valid. |
| Dataset/version or rule/config version is missing from report | Report is incomplete and must not be accepted as release evidence. |

## 11. Acceptance & Test Matrix

| BR / AC | Scenario | Expected Result | Test Type |
|---|---|---|---|
| PB AC, BR-276, BR-465 | Concurrent booking attempts target a Trip with one remaining slot and two simultaneous booking requests | At most one request commits and final `seats_taken <= capacity_max`; observed overbooking remains 0 | Concurrency / Integration |
| BR-276 | Booking request arrives when Trip is already at `capacity_max` | Booking is rejected as full-capacity and no seat counter increase occurs | Boundary |
| BR-276 | Transaction conflict occurs during concurrent booking attempts | Conflict/retry is reported and final seat counter remains consistent with committed bookings | Integration |
| BR-465 | Any scenario records `seats_taken > capacity_max` | Evaluation result is FAIL | Release Gate |
| BR-282 | Evaluation report is generated | Report includes dataset/version, metric value, threshold, rule/config version, and pass/fail conclusion | Report Validation |
| BR-188 | Scenario contains impossible or unordered booking timestamps | Evaluation rejects the scenario as invalid evidence | Validation |

## 12. Open Decisions & References

### 12.1 Open Decisions

None.

### 12.2 References

- Product Backlog v3.1.
- CTMS Business Rules workbook.
- CTMS Architecture Overview.
