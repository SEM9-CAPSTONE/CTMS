# CTMS-071 — View Knowledge Sources for AI Answers

## 1. Overview

Story: CTMS-071

Epic: EPIC 11. AI Survival Assistant and RAG

Use Case: View Knowledge Sources for AI Answers

Priority: Must Have

Goal: Allow Camper to see the actual knowledge source/category used to ground an AI answer without displaying fabricated or unused sources.

Backlog story: As a Camper, I want to see the knowledge sources behind an AI answer so I can understand where the guidance came from.

Acceptance Criteria:

| Source  | Criterion                                                                                                |
| ------- | -------------------------------------------------------------------------------------------------------- |
| PB AC-1 | AI answer exposes source information derived from actual retrieval metadata.                             |
| PB AC-2 | Source/document category displayed to the user must correspond to a source actually used for the answer. |
| PB AC-3 | System must not fabricate a source or show an unused source as evidence.                                 |
| PB AC-4 | Source information remains associated with the corresponding AI answer.                                  |

## 2. Scope

### In Scope

- AI-answer source metadata.
- Document/source category.
- Retrieval provenance.
- Source display.

### Out of Scope

- RAG retrieval itself — CTMS-068.
- AI answer generation — CTMS-069.
- Knowledge-document management — CTMS-050.

## 3. Actors & Authorization

- Camper.
- AI/RAG subsystem.

Camper may view source information associated with an AI answer available to that Camper.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-068.
- CTMS-069.

AI answer and corresponding retrieval metadata exist.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-251 | An AI answer must display the actual document/source category present in retrieval metadata and must not invent or cite a source that was not used.                                   |
| BR-248 | RAG may retrieve only relevant knowledge chunks within the configured context limit, must preserve source references, and must not send unrelated knowledge to the language model.    |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done. |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.          |

## 6. State & Lifecycle

Retrieval
→ source metadata preserved
→ AI answer generated
→ answer/source association persisted or returned
→ Camper views answer sources.

No business-state mutation is performed by viewing sources.

## 7. Business Flow

1. Camper opens an AI answer.
2. System verifies access to the answer.
3. Load retrieval metadata associated with that answer.
4. Identify document/source categories actually used.
5. Display supported source information.
6. Do not add sources absent from retrieval metadata.

## 8. Data & Invariants

Source display must derive from actual retrieval metadata.

Invariant:

`displayed_source ∈ sources actually used by retrieval/answer context`

A source must never be invented merely to make an answer appear grounded.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                          | Expected Behavior                 |
| --------------------------------------------- | --------------------------------- |
| Retrieval has source metadata                 | Display actual source/category    |
| No source metadata exists                     | Do not invent source              |
| Source exists in KB but was not retrieved     | Do not present it as used         |
| User accesses another user's protected answer | Reject according to authorization |
| Multiple actual sources used                  | Display applicable actual sources |

## 11. Acceptance & Test Matrix

| Source | Scenario                            | Expected Result                    | Test Type    |
| ------ | ----------------------------------- | ---------------------------------- | ------------ |
| BR-251 | Answer grounded by source A         | Source A displayed                 | Integration  |
| BR-251 | Source B exists but unused          | Source B not displayed as evidence | Negative     |
| BR-251 | Retrieval metadata absent           | No fabricated source               | Safety       |
| BR-248 | Retrieved chunks contain references | Provenance preserved               | Traceability |

## 12. Open Decisions

Exact source-display UI and level of source detail belong to Technical Design/UI.
