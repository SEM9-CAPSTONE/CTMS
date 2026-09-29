# CTMS-096 — Evaluate GPS Deviation Detection

## 1. Overview

Story: CTMS-096

Epic: EPIC 17. Reports and Evaluation Metrics

Use Case: Evaluate GPS Deviation Detection

Priority: Must Have

Goal: Evaluate route-deviation detection against an independent ground-truth dataset using the approved V3 accuracy and latency release gates.

Backlog story: As the System, I want to evaluate GPS deviation detection so route-deviation behavior can be objectively validated.

Acceptance Criteria:

| Source  | Criterion                                            |
| ------- | ---------------------------------------------------- |
| PB AC-1 | Evaluation uses an independent ground-truth dataset. |
| PB AC-2 | Evaluation measures false-positive rate.             |
| PB AC-3 | Evaluation measures false-negative rate.             |
| PB AC-4 | Evaluation measures OFF_ROUTE detection latency.     |
| PB AC-5 | False-positive release gate is ≤5%.                  |
| PB AC-6 | False-negative release gate is ≤2%.                  |
| PB AC-7 | P95 OFF_ROUTE detection latency is ≤30 seconds.      |
| PB AC-8 | Applicable checkpoint metrics follow BR-435.         |
| PB AC-9 | Report stores Route/package/config version.          |

## 2. Scope

### In Scope

- Ground-truth evaluation.
- False positive.
- False negative.
- OFF_ROUTE detection latency.
- Checkpoint evaluation metrics.
- Route/package/config version.

### Out of Scope

- Runtime deviation detection implementation — CTMS-060.
- Changing detection thresholds during evaluation.

## 3. Actors & Authorization

Actor:

- System/evaluation process.
- Authorized evaluator/Admin where applicable.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-060.

Versioned independent ground-truth dataset exists.

Applicable Route/package/config versions are known.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-277 | GPS-deviation evaluation must use a ground-truth dataset and the release gates in BR-434/BR-438: false-positive rate <=5%, false-negative rate <=2%, and P95 OFF_ROUTE detection latency <=30 seconds. Checkpoint metrics follow BR-435. The report must store the Route/package/config version.                                                                       |
| BR-434 | OFF_ROUTE field evaluation must achieve false-positive rate <=5%, false-negative rate <=2%, and P95 detection latency <=30 seconds. The dataset must store Route/version, ground truth, GPS quality, and config/rule version.                                                                                                                                          |
| BR-435 | Checkpoint-detection field evaluation must achieve missed-arrival rate <=2%, false-arrival rate <=2%, and P95 detection latency <=30 seconds. Only Route Checkpoints evaluated under the V3 threshold count toward the evaluation.                                                                                                                                     |
| BR-438 | Formal Route-safety field evaluation may count only GPS samples with horizontal accuracy <=10 m toward pass/fail metrics. Samples with accuracy >10 m may be retained for observation but must not be used as official evidence.                                                                                                                                       |
| BR-282 | The V3 release gates defined in BR-276 through BR-281 and BR-434 through BR-438 are approved acceptance thresholds. Each evaluation report must store the dataset/version, metric value, threshold, rule/model/config version, and pass/fail conclusion. Metrics explicitly designated as observational are reported only and must not independently fail the release. |

## 6. State & Lifecycle

Dataset/version selected
→ detection executed
→ predictions compared with ground truth
→ metrics calculated
→ release gates evaluated
→ report Pass/Fail.

## 7. Business Flow

1. Load versioned ground-truth dataset.
2. Record Route/package/config versions.
3. Run applicable deviation detection.
4. Compare predicted states with ground truth.
5. Calculate false-positive rate.
6. Calculate false-negative rate.
7. Calculate P95 OFF_ROUTE detection latency.
8. Calculate applicable checkpoint metrics.
9. Compare against approved thresholds.
10. Persist evaluation report.

## 8. Data & Invariants

Release gates:

- false-positive ≤ 5%;
- false-negative ≤ 2%;
- P95 OFF_ROUTE detection latency ≤ 30 seconds.

Report must preserve version context so results are reproducible/comparable.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                         | Expected Behavior                      |
| ---------------------------- | -------------------------------------- |
| FP = 5%                      | Pass FP gate                           |
| FP >5%                       | Fail                                   |
| FN = 2%                      | Pass FN gate                           |
| FN >2%                       | Fail                                   |
| P95 latency =30s             | Pass                                   |
| P95 latency >30s             | Fail                                   |
| Missing ground truth/version | Evaluation evidence incomplete/invalid |
| Config changes between runs  | Store corresponding version separately |

## 11. Acceptance & Test Matrix

| Source | Scenario         | Expected Result                      | Test Type    |
| ------ | ---------------- | ------------------------------------ | ------------ |
| BR-277 | FP ≤5%           | Pass                                 | Evaluation   |
| BR-277 | FP >5%           | Fail                                 | Evaluation   |
| BR-277 | FN ≤2%           | Pass                                 | Evaluation   |
| BR-277 | FN >2%           | Fail                                 | Evaluation   |
| BR-277 | P95 ≤30s         | Pass                                 | Performance  |
| BR-277 | P95 >30s         | Fail                                 | Performance  |
| BR-282 | Report generated | Versions/metrics/gates/result stored | Traceability |

## 12. Open Decisions

Detailed formulas/sample-selection rules should follow BR-434/BR-435/BR-438 and the approved evaluation dataset definition; they are not redefined here.
