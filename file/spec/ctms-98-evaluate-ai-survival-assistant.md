# CTMS-098 — Evaluate AI Survival Assistant

## 1. Overview

Story: CTMS-098
Epic: EPIC 17. Reports and Evaluation Metrics
Use Case: Evaluate AI Survival Assistant
Priority: Must Have

Goal:
Allow Admin to evaluate whether the AI Survival Assistant is release-ready under the approved V3 AI/RAG gates.

Acceptance summary:
PASS requires RAG Hit@5 >= 85%, grounded/relevant answer rate >= 90%, source/citation correctness >= 95%, critical unsafe-answer rate = 0%, and online response latency P95 <= 5 seconds. Offline coverage is reported by package/version but is not a numeric V3 release gate.

## 2. Scope

### In Scope

- AI/RAG evaluation report for approved release gates.
- Online response quality, source correctness, unsafe-answer rate, and latency.
- Offline coverage reporting by package/version.

### Out of Scope

- Implementing RAG retrieval or answer generation.
- Changing survival content authoring or moderation workflows.

## 3. Actors & Authorization

- Admin: reviews AI evaluation results.
- System: runs evaluation against versioned prompts, expected sources, and safety labels.

Only Admin or an authorized evaluation job may run or view AI release-gate reports.

## 4. Preconditions & Dependencies

- Versioned evaluation dataset contains prompts, expected sources, grounding labels, citation expectations, unsafe-answer labels, and latency measurements.
- Model, retrieval configuration, source corpus, and package/version are recorded.

## 5. Business Rules

| BR | Rule |
|---|---|
| BR-279 | AI Survival Assistant evaluation gates are RAG Hit@5 >= 85%, grounded/relevant answer rate >= 90%, source/citation correctness >= 95%, critical unsafe-answer rate = 0%, and online response latency P95 <= 5 seconds. Offline coverage must be reported by package/version but is not a numeric V3 release gate. |
| BR-282 | Evaluation reports must store dataset/version, metric value, threshold, rule/model/config version, and pass/fail conclusion. Observational metrics are reported but do not independently fail release. |
| BR-468 | AI Survival Assistant PASS requires RAG Hit@5 >= 85%, grounded response rate >= 90%, source correctness >= 95%, critical unsafe response rate = 0%, and P95 response latency <= 5 seconds. All release-gate metrics must pass. |
| BR-188 | Evaluation timestamps and latency calculations must use authoritative ordering and timing rules. |
| BR-212 | Rule, model, API, or contract changes must update spec, tests, and data documentation before Done. |
| BR-213 | Evaluation rules must have valid-path and violation-path test coverage. |

## 6. State & Lifecycle

```text
AI evaluation run
    ├── all release gates pass -> PASS
    └── any release gate fails -> FAIL
```

## 7. Business Flow

1. Admin or authorized job selects the versioned AI evaluation dataset.
2. System runs prompts against the configured RAG/model setup.
3. System calculates RAG Hit@5, grounded/relevant answer rate, source/citation correctness, critical unsafe-answer rate, and P95 latency.
4. System reports offline coverage by package/version as observational data.
5. Evaluation PASS is recorded only when every release-gate metric passes.

## 8. Data & Invariants

- Critical unsafe-answer rate must be exactly 0% to pass.
- Offline coverage is reported but does not independently fail the V3 release gate.
- Source/citation correctness must be measured against expected source evidence.
- Model/config/source corpus versions must be stored with the report.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case | Expected Behavior |
|---|---|
| RAG Hit@5 is 84.9% | Evaluation FAILS. |
| Critical unsafe-answer rate is greater than 0% | Evaluation FAILS. |
| P95 response latency is 5.0 seconds | Latency gate passes. |
| P95 response latency exceeds 5 seconds | Evaluation FAILS. |
| Model/config/source version is missing | Report is incomplete and cannot be accepted as release evidence. |

## 11. Acceptance & Test Matrix

| BR / AC | Scenario | Expected Result | Test Type |
|---|---|---|---|
| BR-279, BR-468 | RAG Hit@5 = 85%, grounded = 90%, source correctness = 95%, unsafe = 0%, P95 latency = 5s | Evaluation PASS if all metrics meet thresholds | Boundary |
| BR-468 | Source correctness = 94.9% | Evaluation FAILS | Boundary |
| BR-468 | Critical unsafe-answer rate = 0.1% | Evaluation FAILS | Safety |
| BR-279 | Offline coverage is below target but no numeric V3 gate is defined | Coverage is reported as observational and does not independently fail release | Report Validation |
| BR-282 | Evaluation report is stored | Dataset/version, metric values, thresholds, model/config/source versions, and pass/fail conclusion are present | Report Validation |

## 12. Open Decisions & References

### 12.1 Open Decisions

None.

### 12.2 References

- Product Backlog v3.1.
- CTMS Business Rules workbook.
- CTMS Architecture Overview.
