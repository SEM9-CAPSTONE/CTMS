# CTMS-026 — View Risk Level before Trekking Registration

## 1. Overview

Story: CTMS-026

Epic: EPIC 3. Weather Risk Assessment

Use Case: View Risk Level before Trekking Registration

Priority: Must Have

Goal: Show Camper the authoritative Weather Risk level and its explanation in the Trip-registration context before the Camper proceeds with registration.

Backlog story: As a Camper, I want to see the Weather Risk level before registering for a Trip so I understand the current risk context.

Acceptance Criteria:

| Source  | Criterion                                                                                      |
| ------- | ---------------------------------------------------------------------------------------------- |
| PB AC-1 | Trip Detail displays the applicable authoritative Weather Risk assessment before registration. |
| PB AC-2 | Risk information includes the applicable level and meaningful reason/factor context.           |
| PB AC-3 | Displayed assessment corresponds to the Route/version applicable to the Trip.                  |
| PB AC-4 | Missing or unavailable assessment must not be presented as a fabricated safe result.           |
| PB AC-5 | This story displays risk; it does not calculate a second risk result.                          |

## 2. Scope

### In Scope

- Display Weather Risk in Trip Detail/registration context.
- Display level.
- Display reason/factor context.
- Display recommendation where available from the approved risk/advice workflow.
- Preserve assessment/Route-version relationship.

### Out of Scope

- Calculate Weather Risk; CTMS-016.
- Generic detailed risk-factor workflow; CTMS-017.
- Block Red-risk Booking; CTMS-018.
- LLM calculation of risk.

## 3. Actors & Authorization

- Camper.
- System.

Backend supplies the authoritative assessment. UI does not calculate an alternative level.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-025.
- CTMS-016.

Trip exists and is viewable.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                        |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-038 | Before a Camper registers, Trip Detail must retrieve the latest still-valid Weather Risk assessment for the Route version used by the Trip and display its level, assessment time, and permitted recommendations/reasons. The UI must not show only a color, and it does not need to expose Route Detail or raw Route data. |
| BR-044 | Risk explanations returned by the UI/API must identify the main contributing factors/reasons and, where applicable, the relevant values and thresholds. Returning only a color or aggregate score is insufficient.                                                                                                          |
| BR-045 | Risk information shown to users must include both the level and reasons specific enough to support an appropriate action. Color must never be the only signal.                                                                                                                                                              |

## 6. State & Lifecycle

Read-only workflow.

Weather Risk Assessment
→ associated with Trip Route/version
→ displayed before registration.

No risk-state mutation occurs.

## 7. Business Flow

1. Camper opens Trip Detail.
2. Backend resolves Trip Route/version.
3. Backend resolves applicable authoritative Weather Risk assessment.
4. Backend returns approved risk projection.
5. UI displays risk level.
6. UI displays meaningful reason/factor context.
7. If assessment is unavailable, UI explicitly shows unavailable/degraded state.
8. Registration flow may subsequently apply CTMS-018 independently.

## 8. Data & Invariants

- Displayed level comes from authoritative assessment.
- Assessment belongs to applicable Route/version.
- UI does not recalculate risk.
- Missing assessment is not equivalent to Green.
- Risk explanation is not color-only.
- CTMS-026 does not duplicate CTMS-017's calculation/explanation ownership; it consumes that authoritative information in registration context.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                          | Expected Behavior                         |
| --------------------------------------------- | ----------------------------------------- |
| Valid assessment                              | Display level and reason.                 |
| Assessment unavailable                        | Display unavailable state.                |
| Assessment belongs to different Route/version | Do not present it as applicable.          |
| Historical assessment uses prior rule version | Preserve traceable assessment context.    |
| UI calculates different level                 | Backend assessment remains authoritative. |

## 11. Acceptance & Test Matrix

| Source          | Scenario                  | Expected Result                 | Test Type                  |
| --------------- | ------------------------- | ------------------------------- | -------------------------- |
| PB AC-1, BR-038 | Open Trip with assessment | Applicable risk displayed       | Integration                |
| PB AC-2, BR-044 | Assessment has factors    | Explanation available           | Integration                |
| PB AC-2, BR-045 | Risk displayed            | Level + reason, not color alone | UI                         |
| PB AC-3, BR-038 | Resolve assessment        | Correct Route/version used      | Integration                |
| PB AC-4         | Assessment missing        | No fabricated safe level        | Boundary                   |
| PB AC-5         | Open risk view            | No second calculation performed | Architecture / Integration |

## 12. Open Decisions

None beyond the owning Weather Risk specifications.
