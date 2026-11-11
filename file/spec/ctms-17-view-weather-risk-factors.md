# CTMS-017 — View Weather Risk Factors

## 1. Overview

Story: CTMS-017

Epic: EPIC 3. Weather Risk Assessment

Use Case: View Weather Risk Factors

Priority: Must Have

Goal: Explain the authoritative Weather Risk assessment by showing the factors/reasons that produced its level.

Backlog story:
As a User, I want to know the causes of the risk level so I understand why the Route/Trip has that Weather Risk.

Acceptance Criteria:

| Source  | Criterion                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------- |
| PB AC-1 | User can view factors contributing to the Weather Risk assessment.                                |
| PB AC-2 | Explanation includes meaningful reason/threshold context rather than only a color or total score. |
| PB AC-3 | Displayed factors correspond to the authoritative assessment.                                     |
| PB AC-4 | This story explains an existing risk result; it does not calculate a different risk level.        |

## 2. Scope

### In Scope

- Read Weather Risk Assessment.
- Display risk level.
- Display contributing factors.
- Display reasons.
- Display applicable threshold/score context supported by assessment.

### Out of Scope

- Calculating score; CTMS-016.
- Generating LLM advice; CTMS-019.
- Configuring thresholds; CTMS-020.
- Booking blocking; CTMS-018.

## 3. Actors & Authorization

Primary actor: User.

Read access must follow the applicable Route/Trip visibility policy.

## 4. Preconditions & Dependencies

Dependency: CTMS-016.

An authoritative Weather Risk Assessment must exist.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                               |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-044 | Risk explanations returned by the UI/API must identify the main contributing factors/reasons and, where applicable, the relevant values and thresholds. Returning only a color or aggregate score is insufficient. |
| BR-045 | Risk information shown to users must include both the level and reasons specific enough to support an appropriate action. Color must never be the only signal.                                                     |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                              |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                       |

## 6. State & Lifecycle

This is primarily a read/explanation story.

Weather Risk Assessment
→ retrieve factors/reasons
→ present explanation.

No Weather Risk state transition occurs.

## 7. Business Flow

1. User opens Weather Risk detail.
2. Backend resolves authoritative assessment.
3. System reads stored factors/reasons and threshold/score context.
4. UI shows risk level plus explanation.
5. UI does not recalculate or override authoritative risk.

## 8. Data & Invariants

- Explanation corresponds to the same assessment being displayed.
- Risk factor/reason information must not be fabricated by UI.
- User must see more than only a color/aggregate level where source factors exist.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                      | Expected Behavior                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| No assessment exists                      | Show unavailable/no assessment; do not fabricate factors.                  |
| Assessment exists but reason data missing | Do not generate unsupported explanation in this story.                     |
| Risk rule later changes                   | Historical explanation must remain traceable to assessment's rule context. |

## 11. Acceptance & Test Matrix

| Source  | Scenario                                     | Expected Result                | Test Type        |
| ------- | -------------------------------------------- | ------------------------------ | ---------------- |
| BR-044  | Assessment has multiple contributing factors | Factors/reasons displayed.     | Integration      |
| BR-045  | Risk level displayed                         | Reason context also available. | UI / Integration |
| PB AC-4 | View factors                                 | No new risk score calculated.  | Integration      |

## 12. Open Decisions

This story is deliberately separate from CTMS-019.

CTMS-017 exposes deterministic factors/reasons from CTMS-016; CTMS-019 may turn those inputs into clearer advisory language but must not replace the authoritative factors.
