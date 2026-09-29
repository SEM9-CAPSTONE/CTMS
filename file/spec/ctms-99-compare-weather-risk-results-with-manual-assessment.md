# CTMS-099 — Compare Weather Risk Results with Manual Assessment

## 1. Overview

Story: CTMS-099
Epic: EPIC 17. Reports and Evaluation Metrics
Use Case: Compare Weather Risk Results with Manual Assessment
Priority: Must Have

Goal:
Allow Admin to evaluate whether Weather Risk results match a versioned manual-assessment benchmark.

Acceptance summary:
PASS requires overall agreement with manual assessment >= 90%, missed-Red/high-risk rate <= 5%, and false-Red warning rate <= 10%. The report must separate Green, Yellow, and Red outcomes and store the weather-rule version.

## 2. Scope

### In Scope

- Evaluation of Weather Risk results against manual assessment.
- Release-gate metrics for agreement, missed Red, and false Red.
- Reporting split by Green, Yellow, and Red.

### Out of Scope

- Implementing weather retrieval, risk calculation, or risk-rule configuration.

## 3. Actors & Authorization

- Admin: reviews Weather Risk evaluation results.
- System: runs comparison against the versioned manual-assessment test set.

Only Admin or an authorized evaluation job may run or view the report.

## 4. Preconditions & Dependencies

- Versioned manual-assessment test set exists.
- Weather Risk output and weather-rule version are available for each evaluated case.

## 5. Business Rules

| BR | Rule |
|---|---|
| BR-280 | Weather Risk evaluation must use a versioned manual-assessment test set. PASS requires overall agreement >= 90%, missed Red/high-risk rate <= 5%, and false Red warning rate <= 10%. Report must separate Green, Yellow, and Red and store weather-rule version. |
| BR-282 | Evaluation reports must store dataset/version, metric value, threshold, rule/model/config version, and pass/fail conclusion. Observational metrics are reported but do not independently fail release. |
| BR-469 | Weather Risk PASS requires agreement with manual assessment >= 90%, missed-Red rate <= 5%, and false-Red rate <= 10%. All release-gate metrics must pass. |
| BR-188 | Evaluation timestamps and weather-period alignment must use authoritative time rules. |
| BR-212 | Rule, enum, state transition, or API contract changes must update spec, tests, and data documentation before Done. |
| BR-213 | Evaluation rules must have valid-path and violation-path test coverage. |

## 6. State & Lifecycle

```text
Weather Risk evaluation
    ├── agreement >= 90%, missed Red <= 5%, false Red <= 10% -> PASS
    └── any threshold fails -> FAIL
```

## 7. Business Flow

1. Admin or authorized job selects the versioned manual-assessment dataset.
2. System runs or loads Weather Risk outputs for the same cases.
3. System compares Weather Risk level against manual assessment for Green, Yellow, and Red.
4. System calculates overall agreement, missed-Red rate, and false-Red rate.
5. System stores weather-rule version, thresholds, metric values, and pass/fail conclusion.

## 8. Data & Invariants

- Manual assessment dataset version is the benchmark for evaluation.
- Missed-Red and false-Red rates are evaluated separately from overall agreement.
- Green, Yellow, and Red outcomes must be separable in the report.
- A single failed release-gate metric makes the evaluation fail.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case | Expected Behavior |
|---|---|
| Agreement is 89.9% | Evaluation FAILS. |
| Missed-Red rate is 5% | Missed-Red gate passes. |
| False-Red rate is 10.1% | Evaluation FAILS. |
| Manual-assessment version is missing | Report is incomplete and cannot be accepted as release evidence. |

## 11. Acceptance & Test Matrix

| BR / AC | Scenario | Expected Result | Test Type |
|---|---|---|---|
| BR-280, BR-469 | Agreement = 90%, missed Red = 5%, false Red = 10% | Evaluation PASS if all three metrics meet thresholds | Boundary |
| BR-469 | Missed Red = 5.1% | Evaluation FAILS | Boundary |
| BR-280 | Dataset includes Green, Yellow, and Red cases | Report separates results by risk level | Report Validation |
| BR-282 | Evaluation report is stored | Dataset/version, weather-rule version, metric values, thresholds, and pass/fail conclusion are present | Report Validation |

## 12. Open Decisions & References

### 12.1 Open Decisions

None.

### 12.2 References

- Product Backlog v3.1.
- CTMS Business Rules workbook.
- CTMS Architecture Overview.
