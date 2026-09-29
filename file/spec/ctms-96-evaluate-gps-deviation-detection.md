# CTMS-096 — Evaluate GPS Deviation Detection

## 1. Overview

Story: CTMS-096
Epic: EPIC 17. Reports and Evaluation Metrics
Use Case: Evaluate GPS Deviation Detection
Priority: Must Have

Goal:
Allow Admin to evaluate whether OFF_ROUTE and checkpoint detection meet the approved V3 release gates.

Acceptance summary:
Evaluation must use versioned ground-truth field datasets. OFF_ROUTE gates are false-positive <= 5%, false-negative <= 2%, and P95 detection latency <= 30 seconds. Checkpoint gates are missed-arrival <= 2%, false-arrival <= 2%, and P95 checkpoint detection latency <= 30 seconds. Official pass/fail evidence may use only GPS samples with horizontal accuracy <= 10m.

## 2. Scope

### In Scope

- Field evaluation of Safety Tracking thresholds and state transitions.
- OFF_ROUTE and checkpoint detection metric calculation.
- Dataset metadata for Route/package/config/rule version, ground truth, GPS quality, and pass/fail conclusion.

### Out of Scope

- Implementing runtime OFF_ROUTE or checkpoint detection behavior.
- Changing route geometry, checkpoint definitions, or GPS sampling cadence.

## 3. Actors & Authorization

- Admin: reviews evaluation report and release readiness.
- System: runs evaluation against the ground-truth dataset.

Only Admin or an authorized evaluation job may run or view official field evaluation reports.

## 4. Preconditions & Dependencies

- Ground-truth/reference positions or predefined test points exist independently from the GPS samples being tested.
- Dataset records Route/version, package/config/rule version, GPS quality, and expected OFF_ROUTE/checkpoint outcomes.
- Samples used as official pass/fail evidence have horizontal accuracy <= 10m.

## 5. Business Rules

| BR | Rule |
|---|---|
| BR-277 | GPS deviation evaluation must use a ground-truth dataset and the release gates from BR-434 and BR-438: OFF_ROUTE false-positive <= 5%, false-negative <= 2%, P95 OFF_ROUTE detection latency <= 30 seconds, and checkpoint metrics from BR-435. Reports must store Route/package/config version. |
| BR-282 | Evaluation reports must store dataset/version, metric value, threshold, rule/model/config version, and pass/fail conclusion. Observational metrics are reported but do not independently fail release. |
| BR-433 | Official field evaluation must test Safety Tracking thresholds and state transitions according to Business Rules V3 and record the config/rule version used for each result. |
| BR-434 | OFF_ROUTE field evaluation must achieve false-positive rate <= 5%, false-negative rate <= 2%, and P95 detection latency <= 30 seconds. Dataset evidence must include Route/version, ground truth, GPS quality, and config/rule version. |
| BR-435 | Checkpoint field evaluation must achieve missed-arrival rate <= 2%, false-arrival rate <= 2%, and P95 detection latency <= 30 seconds. Only V3 Route Checkpoints using the V3 threshold count in evaluation. |
| BR-438 | Official pass/fail evaluation for Route safety detection may count only GPS samples with horizontal accuracy <= 10m. Samples with accuracy > 10m may be stored for observation but not as official evidence. |
| BR-439 | Field tests must have independent ground-truth/reference positions or predefined test points. The GPS sample being evaluated must not be the sole ground truth. |
| BR-466 | GPS release PASS requires all OFF_ROUTE and checkpoint release-gate metrics to pass: OFF_ROUTE false-positive <= 5%, false-negative <= 2%, P95 latency <= 30s; checkpoint missed <= 2%, false detection <= 2%, P95 latency <= 30s. |

## 6. State & Lifecycle

Evaluation result:

```text
Official dataset filtered to accuracy <= 10m
    ├── all OFF_ROUTE and checkpoint gates pass -> PASS
    └── any gate fails or evidence is invalid -> FAIL
```

## 7. Business Flow

1. Admin or authorized evaluation job selects the versioned GPS/checkpoint dataset.
2. System filters official pass/fail evidence to samples with horizontal accuracy <= 10m.
3. System verifies each scenario has independent ground truth or predefined reference points.
4. System calculates OFF_ROUTE false-positive rate, false-negative rate, and P95 detection latency.
5. System calculates checkpoint missed-arrival rate, false-arrival rate, and P95 checkpoint detection latency.
6. System records Route/version, package/config/rule version, GPS quality, metric values, thresholds, and pass/fail conclusion.
7. Evaluation PASS is recorded only when every release-gate metric passes.

## 8. Data & Invariants

- Official evidence excludes GPS samples with horizontal accuracy > 10m.
- Ground truth must be independent of the GPS sample under test.
- OFF_ROUTE and checkpoint metrics must be separated in the report.
- A single failed release-gate metric makes the evaluation fail.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case | Expected Behavior |
|---|---|
| Dataset has no independent ground truth | Evaluation is invalid and must not produce PASS. |
| Official metric calculation includes samples with accuracy > 10m | Evaluation evidence is invalid. |
| OFF_ROUTE false-positive rate is 5% | Gate passes. |
| OFF_ROUTE false-positive rate exceeds 5% | Evaluation FAILS. |
| Checkpoint missed-arrival rate exceeds 2% | Evaluation FAILS. |
| P95 latency exceeds 30 seconds for OFF_ROUTE or checkpoint detection | Evaluation FAILS. |

## 11. Acceptance & Test Matrix

| BR / AC | Scenario | Expected Result | Test Type |
|---|---|---|---|
| BR-434, BR-466 | OFF_ROUTE false-positive = 5%, false-negative = 2%, P95 latency = 30s | OFF_ROUTE gates pass | Boundary |
| BR-434, BR-466 | OFF_ROUTE false-positive = 5.1% | Evaluation FAILS | Boundary |
| BR-435, BR-466 | Checkpoint missed-arrival = 2%, false-arrival = 2%, P95 latency = 30s | Checkpoint gates pass | Boundary |
| BR-435, BR-466 | Checkpoint false-arrival = 2.1% | Evaluation FAILS | Boundary |
| BR-438 | Dataset contains samples with horizontal accuracy > 10m | Those samples are excluded from official pass/fail metrics and may be reported only as observations | Data Quality |
| BR-439 | Dataset uses the tested GPS sample as the only ground truth | Evaluation report is rejected as invalid evidence | Validation |
| BR-282, BR-433 | Evaluation report is saved | Report includes dataset/version, Route/package/config/rule version, GPS quality, thresholds, metric values, and pass/fail conclusion | Report Validation |

## 12. Open Decisions & References

### 12.1 Open Decisions

None.

### 12.2 References

- Product Backlog v3.1.
- CTMS Business Rules workbook.
- CTMS Architecture Overview.
