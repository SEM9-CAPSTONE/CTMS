# CTMS-075 — Detect Emergency Questions

## 1. Overview

Story: CTMS-075

Epic: EPIC 12. SOS and Emergency Communication

Use Case: Detect Emergency Questions

Priority: Must Have

Goal: Detect configured danger signals in user questions and prioritize concise emergency guidance and emergency actions.

Backlog story: As a Camper, I want emergency situations expressed through my questions to be recognized so urgent safety actions are surfaced immediately.

Acceptance Criteria:

| Source  | Criterion                                                                                                  |
| ------- | ---------------------------------------------------------------------------------------------------------- |
| PB AC-1 | Emergency-question detection evaluates configured danger signals.                                          |
| PB AC-2 | Detected emergency context receives prioritized concise guidance.                                          |
| PB AC-3 | SOS action is surfaced.                                                                                    |
| PB AC-4 | Current-location action/information is surfaced where applicable.                                          |
| PB AC-5 | Detection does not itself silently create an SOS unless separately initiated by the approved SOS workflow. |

## 2. Scope

### In Scope

- Danger-signal detection.
- Emergency guidance.
- SOS action surfacing.
- Current-location action surfacing.

### Out of Scope

- Automatically creating SOS without user/system-approved SOS action.
- General RAG retrieval.
- SOS delivery.

## 3. Actors & Authorization

- Camper.
- Emergency-question detection subsystem.

## 4. Preconditions & Dependencies

User submits a question through an applicable assistant interface.

Configured danger signals exist.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-255 | Emergency-question detection must recognize configured danger signals in the user's question, provide concise priority guidance, and surface SOS/current-location actions when an emergency is detected.                       |
| BR-216 | AI/RAG may provide recommendations and explanations only. It must not override hard rules or authoritative state such as a closed/archived Route, Trip capacity, payment outcome, Weather Risk score/level, or access control. |

## 6. State & Lifecycle

Question
→ danger-signal evaluation.

No danger:
→ normal assistant workflow.

Danger detected:
→ emergency guidance
→ SOS/location actions surfaced.

Detection alone does not establish that an SOS alert has been persisted.

## 7. Business Flow

1. Receive question.
2. Evaluate configured danger signals.
3. If no danger is detected, continue normal assistant handling.
4. If danger is detected, prioritize emergency response.
5. Present concise applicable guidance.
6. Surface SOS action.
7. Surface current-location action/context.
8. User may initiate SOS through CTMS-074/076.

## 8. Data & Invariants

- Detection relies on configured danger signals.
- Emergency output takes priority over ordinary conversational verbosity.
- SOS existence must not be inferred solely from emergency-question classification.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                       | Expected Behavior                     |
| -------------------------- | ------------------------------------- |
| No danger signal           | Normal AI workflow                    |
| Danger signal detected     | Emergency guidance prioritized        |
| Emergency detected         | SOS action surfaced                   |
| GPS available              | Location action/context surfaced      |
| Emergency classifier fires | Do not falsely claim SOS already sent |

## 11. Acceptance & Test Matrix

| Source | Scenario                 | Expected Result        | Test Type      |
| ------ | ------------------------ | ---------------------- | -------------- |
| BR-255 | Normal question          | Normal flow            | Classification |
| BR-255 | Configured danger signal | Emergency detected     | Classification |
| BR-255 | Emergency detected       | Concise guidance       | Safety         |
| BR-255 | Emergency detected       | SOS action visible     | UI             |
| BR-255 | Detection only           | No false persisted SOS | State          |

## 12. Open Decisions

Exact configured danger-signal set/classification implementation belongs to Technical Design/configuration.
