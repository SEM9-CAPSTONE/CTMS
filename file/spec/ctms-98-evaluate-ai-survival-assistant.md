# CTMS-098 — Evaluate AI Survival Assistant

## 1. Overview

Story: CTMS-098

Epic: EPIC 17. Reports and Evaluation Metrics

Use Case: Evaluate AI Survival Assistant

Priority: Must Have

Goal: Evaluate retrieval quality, answer grounding, citation correctness, critical safety, and online response latency of the AI Survival Assistant using approved V3 release gates.

Backlog story: As the System, I want to evaluate the AI Survival Assistant so its retrieval, answer quality, source correctness, safety, and latency can be verified before release.

Acceptance Criteria:

| Source   | Criterion                                                                             |
| -------- | ------------------------------------------------------------------------------------- |
| PB AC-1  | RAG Hit@5 is measured.                                                                |
| PB AC-2  | Grounded/relevant answer rate is measured.                                            |
| PB AC-3  | Source/citation correctness is measured.                                              |
| PB AC-4  | Critical unsafe-answer rate is measured.                                              |
| PB AC-5  | Online response latency P95 is measured.                                              |
| PB AC-6  | RAG Hit@5 must be ≥85%.                                                               |
| PB AC-7  | Grounded/relevant answer rate must be ≥90%.                                           |
| PB AC-8  | Source/citation correctness must be ≥95%.                                             |
| PB AC-9  | Critical unsafe-answer rate must equal 0%.                                            |
| PB AC-10 | Online response latency P95 must be ≤5 seconds.                                       |
| PB AC-11 | Offline coverage is reported by package/version but is not a numeric V3 release gate. |

## 2. Scope

### In Scope

- Retrieval Hit@5.
- Grounded/relevant answers.
- Source/citation correctness.
- Critical unsafe answers.
- Online P95 latency.
- Offline coverage reporting.

### Out of Scope

- Changing RAG implementation.
- Changing AI model automatically because evaluation fails.
- Creating a numeric offline-coverage gate not approved in V3.

## 3. Actors & Authorization

Actor:

- System/evaluation process.
- Authorized evaluator where applicable.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-068.
- CTMS-069.
- CTMS-070.
- CTMS-071.

Versioned evaluation dataset and applicable model/RAG/package versions exist.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-279 | AI Survival Assistant release gates are: RAG Hit@5 >=85%, grounded/relevant answer rate >=90%, source/citation correctness >=95%, critical unsafe-answer rate = 0%, and online response latency P95 <=5 seconds. Offline coverage must be reported by package/version but is not a numeric V3 release gate.                                                            |
| BR-282 | The V3 release gates defined in BR-276 through BR-281 and BR-434 through BR-438 are approved acceptance thresholds. Each evaluation report must store the dataset/version, metric value, threshold, rule/model/config version, and pass/fail conclusion. Metrics explicitly designated as observational are reported only and must not independently fail the release. |

## 6. State & Lifecycle

Evaluation dataset
→ retrieval/answer execution
→ metrics calculated
→ safety assessment
→ latency aggregation
→ release gates evaluated
→ Pass/Fail report.

## 7. Business Flow

1. Load versioned evaluation dataset.
2. Record model/RAG/config versions.
3. Execute retrieval and answer generation.
4. Calculate Hit@5.
5. Evaluate grounded/relevant answer rate.
6. Validate source/citation correctness.
7. Identify critical unsafe answers.
8. Calculate online P95 response latency.
9. Report offline coverage by package/version.
10. Compare gated metrics with thresholds.
11. Produce Pass/Fail evidence.

## 8. Data & Invariants

Release gates:

- RAG Hit@5 ≥85%;
- grounded/relevant answer rate ≥90%;
- source/citation correctness ≥95%;
- critical unsafe-answer rate =0%;
- online P95 response latency ≤5 seconds.

Offline coverage:

- must be reported;
- is not a numeric V3 release gate.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                       | Expected Behavior                                       |
| -------------------------- | ------------------------------------------------------- |
| Hit@5 =85%                 | Pass metric                                             |
| Hit@5 <85%                 | Fail                                                    |
| Grounded rate =90%         | Pass                                                    |
| Citation correctness =95%  | Pass                                                    |
| One critical unsafe answer | Fail safety gate                                        |
| P95 =5s                    | Pass                                                    |
| P95 >5s                    | Fail                                                    |
| Low offline coverage       | Report; do not automatically fail without approved gate |

## 11. Acceptance & Test Matrix

| Source | Scenario           | Expected Result                   | Test Type    |
| ------ | ------------------ | --------------------------------- | ------------ |
| BR-279 | Hit@5 ≥85%         | Pass                              | Evaluation   |
| BR-279 | Grounded ≥90%      | Pass                              | Evaluation   |
| BR-279 | Citation ≥95%      | Pass                              | Evaluation   |
| BR-279 | Critical unsafe >0 | Fail                              | Safety       |
| BR-279 | P95 ≤5s            | Pass                              | Performance  |
| BR-279 | Offline coverage   | Reported by package/version       | Metrics      |
| BR-282 | Report             | Versions/thresholds/result stored | Traceability |

## 12. Open Decisions

Offline coverage has no approved numeric V3 release threshold.
