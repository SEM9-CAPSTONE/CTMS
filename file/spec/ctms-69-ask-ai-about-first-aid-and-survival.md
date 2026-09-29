# CTMS-069 — Ask AI About First Aid and Survival

## 1. Overview

Story: CTMS-069

Epic: EPIC 11. AI Survival Assistant and RAG

Use Case: Ask AI About First Aid and Survival

Priority: Must Have

Goal: Provide first-aid and survival guidance grounded in the configured CTMS knowledge base while preventing AI output from overriding authoritative safety/business rules.

Backlog story: As a Camper, I want to ask the AI assistant about first aid and survival so I can receive useful guidance during trekking.

Acceptance Criteria:

| Source  | Criterion                                                                     |
| ------- | ----------------------------------------------------------------------------- |
| PB AC-1 | AI answers first-aid/survival questions using configured CTMS knowledge base. |
| PB AC-2 | Applicable RAG context is used for grounded online answers.                   |
| PB AC-3 | Answer follows applicable safety constraints.                                 |
| PB AC-4 | AI does not override authoritative state or hard Business Rules.              |
| PB AC-5 | Response targets the configured operational latency requirement.              |
| PB AC-6 | Source provenance used by the answer remains available for CTMS-071.          |

## 2. Scope

### In Scope

- First-aid questions.
- Survival questions.
- RAG-grounded AI response.
- Safety constraints.
- Source provenance.
- Operational latency target.

### Out of Scope

- Emergency/SOS activation — CTMS-074/075.
- Offline non-LLM search — CTMS-070.
- Changing Weather Risk, Route or Trip state.

## 3. Actors & Authorization

- Camper.
- AI assistant.
- RAG subsystem.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-068.

Configured knowledge base/RAG is available for online AI operation.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-249 | The AI assistant must answer first-aid and survival questions using the configured CTMS knowledge base within the operational latency target and must comply with applicable safety constraints.                               |
| BR-216 | AI/RAG may provide recommendations and explanations only. It must not override hard rules or authoritative state such as a closed/archived Route, Trip capacity, payment outcome, Weather Risk score/level, or access control. |
| BR-248 | RAG may retrieve only relevant knowledge chunks within the configured context limit, must preserve source references, and must not send unrelated knowledge to the language model.                                             |

## 6. State & Lifecycle

Question
→ RAG retrieval
→ AI generation
→ safety-constrained answer
→ display answer/source context.

No authoritative business-state transition occurs.

## 7. Business Flow

1. Camper asks question.
2. Determine applicable AI/safety handling.
3. Retrieve relevant CTMS knowledge.
4. Construct bounded context.
5. Generate response.
6. Apply safety constraints.
7. Preserve actual source references.
8. Return answer.
9. Make source metadata available for source display/feedback.

## 8. Data & Invariants

- AI answer is advisory.
- AI cannot reopen Route.
- AI cannot change risk score/level.
- AI cannot change capacity/payment/access rights.
- Sources must come from actual retrieval.
- Lack of grounding must not be hidden with fabricated source.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                        | Expected Behavior                                     |
| --------------------------- | ----------------------------------------------------- |
| No relevant knowledge       | Do not fabricate grounded source                      |
| AI conflicts with hard rule | Hard rule wins                                        |
| AI service unavailable      | Return safe failure/fallback                          |
| Emergency-like question     | CTMS-075 detection may trigger emergency handling     |
| Model invents source        | Must not expose invented source as retrieval evidence |

## 11. Acceptance & Test Matrix

| Source  | Scenario                                | Expected Result                  | Test Type    |
| ------- | --------------------------------------- | -------------------------------- | ------------ |
| BR-249  | Survival question                       | Grounded answer                  | AI E2E       |
| BR-249  | First-aid question                      | Safety constraints applied       | AI Safety    |
| BR-216  | Prompt asks AI to override closed Route | No override                      | Safety       |
| BR-248  | Answer uses chunks                      | Provenance preserved             | Traceability |
| PB AC-5 | Normal request                          | Evaluated against latency target | Performance  |

## 12. Open Decisions

Exact model/provider, operational latency threshold and fallback response contract must come from Technical Design/evaluation criteria if not fixed elsewhere.
