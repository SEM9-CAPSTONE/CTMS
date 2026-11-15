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
| BR-255 | Recognize configured danger signals in the user's question. |
| BR-508 | A detected emergency receives priority guidance before ordinary inference. |
| BR-509 | A detected emergency surfaces the existing SOS action when available. |
| BR-510 | A detected emergency surfaces the current-location action when applicable. |
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

Evaluate emergency signals before choosing online or offline inference. An unavailable engine cannot suppress the emergency path. Only the existing CTMS-074/076 workflow may record or send SOS and expose its resulting state.

## 10. Error & Edge Cases

| Case                       | Expected Behavior                     |
| -------------------------- | ------------------------------------- |
| No danger signal           | Normal AI workflow                    |
| Danger signal detected     | Emergency guidance prioritized        |
| Emergency detected         | SOS action surfaced                   |
| GPS available              | Location action/context surfaced      |
| Emergency classifier fires | Do not falsely claim SOS already sent |

## 11. Acceptance & Test Matrix

| Rule | Valid path | Violation path |
| --- | --- | --- |
| BR-255 | Recognize a configured danger signal | Ordinary questions continue normally |
| BR-508 | Show priority guidance without waiting for inference | An unavailable engine cannot prevent priority guidance |
| BR-509 | Offer the existing SOS action when eligible | Detection alone cannot create or mark a notification sent |
| BR-510 | Offer the current-location action when applicable | Never display an unknown location as known |
| BR-216 | Present SOS workflow information | Never fabricate SOS delivery or change authoritative state |

## 12. Open Decisions

Exact configured danger-signal set/classification implementation belongs to Technical Design/configuration.
