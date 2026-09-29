# CTMS-016 — Calculate Multi-Criteria Weather Risk Score

## 1. Overview

Story: CTMS-016

Epic: EPIC 3. Weather Risk Assessment

Use Case: Calculate Multi-Criteria Weather Risk Score

Priority: Must Have

Goal: Deterministically calculate Weather Risk from a Weather Snapshot using the active weather-rule version.

Backlog story:
As the System, I want to calculate a multi-criteria weather risk score so trekking risk can be classified consistently.

Acceptance Criteria:

| Source  | Criterion                                                                          |
| ------- | ---------------------------------------------------------------------------------- |
| PB AC-1 | Risk score is deterministically calculated from weather input and active rules.    |
| PB AC-2 | Score is classified into the authoritative risk level using configured thresholds. |
| PB AC-3 | Assessment preserves snapshot and rule-version traceability.                       |
| PB AC-4 | Reasons contributing to the assessment are stored for explanation.                 |

## 2. Scope

### In Scope

- Consume Weather Snapshot.
- Use active `weather_rules`.
- Calculate deterministic score.
- Map score to risk level.
- Persist assessment and reasons.
- Preserve rule/input version.

### Out of Scope

- Retrieving weather.
- Displaying detailed factors; CTMS-017.
- LLM advice.
- Admin rule configuration.

## 3. Actors & Authorization

Primary actor: System.

Backend is authoritative for risk calculation. Client must not submit its own authoritative risk score/level.

## 4. Preconditions & Dependencies

Dependency: CTMS-015.

Required:

- Valid Weather Snapshot.
- Applicable active Weather Risk rule.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-041 | The Weather Risk score must be calculated deterministically from the weather snapshot using the currently active weather_rules. The backend is the authoritative source of the result.           |
| BR-042 | Weather Risk level may be only Green, Yellow, or Red, according to the thresholds of the rule version used. Threshold boundaries must be explicitly defined and testable.                        |
| BR-043 | Each weather_risk_assessment must store snapshot_id, rule_id, score, level, reasons, and created_at so that the result can be reproduced from the same input and rule version.                   |
| BR-175 | The backend is the authoritative source for authorization, state, pricing, capacity, inventory, risk level, and transaction outcome. The client must not establish these values authoritatively. |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.            |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                     |

## 6. State & Lifecycle

Valid Weather Snapshot + active rule
→ deterministic calculation
→ Weather Risk Assessment.

Assessment records preserve the input/rule context used at calculation time.

## 7. Business Flow

1. System selects valid Weather Snapshot.
2. System resolves active Weather Risk rule/version.
3. System applies configured criteria/weights.
4. System calculates score.
5. System maps score to risk level using rule thresholds.
6. System determines reasons/factors.
7. Assessment is persisted with snapshot/rule references.
8. Result becomes authoritative input to downstream risk workflows.

## 8. Data & Invariants

Assessment source-supported fields:

- `snapshot_id`
- `rule_id`
- `score`
- `level`
- `reasons`
- `created_at`
- input/rule version context

Same input + same rule version must produce the same deterministic outcome.

## 9. API / Integration Contract

TBD — Technical Design.

Exact formula/weights/thresholds must come from `weather_rules`, not be hard-coded by this spec.

## 10. Error & Edge Cases

| Case                            | Expected Behavior                     |
| ------------------------------- | ------------------------------------- |
| Weather Snapshot missing        | No assessment.                        |
| Active rule missing             | Do not invent thresholds.             |
| Client supplies risk level      | Ignore/reject as authoritative input. |
| Score exactly on threshold      | Apply authoritative boundary rule.    |
| Same snapshot/rule recalculated | Deterministic same result.            |

## 11. Acceptance & Test Matrix

| Source | Scenario                       | Expected Result                  | Test Type   |
| ------ | ------------------------------ | -------------------------------- | ----------- |
| BR-041 | Same input/rule twice          | Same score.                      | Determinism |
| BR-042 | Score below/at/above threshold | Correct boundary classification. | Boundary    |
| BR-043 | Assessment persisted           | Snapshot/rule traceable.         | Integration |
| BR-175 | Client tries to override level | Client value not authoritative.  | Security    |

## 12. Open Decisions

BR-042 explicitly names Green and Yellow but the current excerpt does not safely define the complete risk-level enum or numeric boundaries.

Those values must come from the active Weather Risk rule/configuration.
