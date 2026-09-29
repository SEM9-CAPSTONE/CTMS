# CTMS-099 — Compare Weather Risk Results with Manual Assessment

## 1. Overview

Story: CTMS-099

Epic: EPIC 17. Reports and Evaluation Metrics

Use Case: Compare Weather Risk Results with Manual Assessment

Priority: Must Have

Goal: Evaluate automated Weather Risk classification against a versioned manual-assessment test set using approved V3 agreement and high-risk safety gates.

Backlog story: As the System, I want to compare Weather Risk results with manual assessment so the risk-classification mechanism can be objectively validated.

Acceptance Criteria:

| Source  | Criterion                                               |
| ------- | ------------------------------------------------------- |
| PB AC-1 | Evaluation uses a versioned manual-assessment test set. |
| PB AC-2 | Overall agreement is measured.                          |
| PB AC-3 | Missed Red/high-risk rate is measured.                  |
| PB AC-4 | False Red warning rate is measured.                     |
| PB AC-5 | Overall agreement must be ≥90%.                         |
| PB AC-6 | Missed Red/high-risk rate must be ≤5%.                  |
| PB AC-7 | False Red warning rate must be ≤10%.                    |
| PB AC-8 | Report separates Green/Yellow/Red results.              |
| PB AC-9 | Report stores Weather Risk rule version.                |

## 2. Scope

### In Scope

- Versioned manual assessment.
- Automated/manual comparison.
- Green/Yellow/Red breakdown.
- Agreement.
- Missed high-risk cases.
- False Red warnings.
- Weather-rule version.

### Out of Scope

- Changing Weather Risk rules during evaluation.
- Manual override of production risk result.

## 3. Actors & Authorization

Actor:

- System/evaluation process.
- Authorized evaluator where applicable.

## 4. Preconditions & Dependencies

Weather Risk mechanism exists.

Versioned manual-assessment test set exists.

Weather-rule version is known.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-280 | Weather Risk evaluation must use a versioned manual-assessment test set. Release gates are overall agreement >=90%, missed Red/high-risk rate <=5%, and false Red warning rate <=10%. The report must break out Green/Yellow/Red results and store the weather-rule version.                                                                                           |
| BR-282 | The V3 release gates defined in BR-276 through BR-281 and BR-434 through BR-438 are approved acceptance thresholds. Each evaluation report must store the dataset/version, metric value, threshold, rule/model/config version, and pass/fail conclusion. Metrics explicitly designated as observational are reported only and must not independently fail the release. |

## 6. State & Lifecycle

Manual test set selected
→ automated Weather Risk calculated
→ classifications compared
→ metrics calculated
→ release gates evaluated
→ Pass/Fail report.

## 7. Business Flow

1. Load versioned manual-assessment dataset.
2. Record Weather Risk rule version.
3. Run automated Weather Risk evaluation.
4. Compare each automated result with manual assessment.
5. Separate Green/Yellow/Red results.
6. Calculate overall agreement.
7. Calculate missed Red/high-risk rate.
8. Calculate false Red warning rate.
9. Compare with approved gates.
10. Persist report.

## 8. Data & Invariants

Release gates:

- overall agreement ≥90%;
- missed Red/high-risk ≤5%;
- false Red warning ≤10%.

Report must identify dataset and weather-rule versions.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                  | Expected Behavior                      |
| --------------------- | -------------------------------------- |
| Agreement =90%        | Pass                                   |
| Agreement <90%        | Fail                                   |
| Missed Red =5%        | Pass                                   |
| Missed Red >5%        | Fail                                   |
| False Red =10%        | Pass                                   |
| False Red >10%        | Fail                                   |
| Dataset not versioned | Evaluation evidence invalid/incomplete |
| Rule version changes  | Report as separate evaluation context  |

## 11. Acceptance & Test Matrix

| Source | Scenario         | Expected Result                        | Test Type    |
| ------ | ---------------- | -------------------------------------- | ------------ |
| BR-280 | Agreement ≥90%   | Pass                                   | Evaluation   |
| BR-280 | Agreement <90%   | Fail                                   | Evaluation   |
| BR-280 | Missed Red ≤5%   | Pass                                   | Safety       |
| BR-280 | Missed Red >5%   | Fail                                   | Safety       |
| BR-280 | False Red ≤10%   | Pass                                   | Evaluation   |
| BR-280 | Green/Yellow/Red | Separately reported                    | Metrics      |
| BR-282 | Report           | Dataset/rule/threshold/result retained | Traceability |

## 12. Open Decisions

None for V3 release thresholds.
