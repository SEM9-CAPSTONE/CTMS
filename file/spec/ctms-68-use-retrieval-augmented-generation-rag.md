# CTMS-068 — Use Retrieval-Augmented Generation (RAG)

## 1. Overview

Story: CTMS-068

Epic: EPIC 11. AI Survival Assistant and RAG

Use Case: Use Retrieval-Augmented Generation (RAG)

Priority: Must Have

Goal: Retrieve only relevant authoritative survival-knowledge chunks for AI context while preserving source references and respecting configured context limits.

Backlog story: As the System, I want to retrieve relevant survival knowledge before AI generation so answers are grounded in CTMS knowledge sources.

Acceptance Criteria:

| Source  | Criterion                                               |
| ------- | ------------------------------------------------------- |
| PB AC-1 | Retrieval searches configured CTMS knowledge chunks.    |
| PB AC-2 | Only relevant chunks are selected.                      |
| PB AC-3 | Retrieval respects configured context limit.            |
| PB AC-4 | Source references are preserved.                        |
| PB AC-5 | Irrelevant knowledge is not sent to the language model. |

## 2. Scope

### In Scope

- Query retrieval.
- Relevant knowledge chunks.
- Context limit.
- Source references.
- RAG context construction.

### Out of Scope

- Final AI answer — CTMS-069.
- Offline keyword search — CTMS-070.
- Knowledge ingestion — CTMS-051.

## 3. Actors & Authorization

- System RAG component.
- Authorized AI-assistant request context.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-051.
- Configured knowledge index exists.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-248 | RAG may retrieve only relevant knowledge chunks within the configured context limit, must preserve source references, and must not send unrelated knowledge to the language model.                                             |
| BR-216 | AI/RAG may provide recommendations and explanations only. It must not override hard rules or authoritative state such as a closed/archived Route, Trip capacity, payment outcome, Weather Risk score/level, or access control. |

## 6. State & Lifecycle

User query
→ retrieval
→ ranked/relevant chunk set
→ bounded RAG context
→ downstream AI generation.

## 7. Business Flow

1. Receive authorized query.
2. Build retrieval query.
3. Search knowledge chunks.
4. Evaluate relevance.
5. Exclude irrelevant chunks.
6. Apply context limit.
7. Preserve source metadata/references.
8. Build RAG context.
9. Pass bounded context to downstream AI component.

## 8. Data & Invariants

- Every selected chunk remains traceable to source.
- Context size <= configured limit.
- Irrelevant chunks are excluded.
- Retrieval does not change authoritative business state.
- Retrieval result is not itself the final AI answer.

## 9. API / Integration Contract

CTMS-069 imports `RagModule` and calls `RagRetrievalService.retrieve(actor, { question, locale })` with the actor resolved by backend authentication. The service requires an active Camper. It returns either `GROUNDED` with bounded context and provenance, or `INSUFFICIENT_CONTEXT` with empty evidence and an explicit reason. Operational errors remain distinguishable. There is no public retrieval or chat route in this story.

See the [implementation and internal contract](../../docs/features/CTMS-068-Implementation.md) for settings, source and chunk fields, and Python endpoints.

## 10. Error & Edge Cases

| Case                                  | Expected Behavior                     |
| ------------------------------------- | ------------------------------------- |
| No relevant chunks                    | Do not invent source context          |
| Too many relevant chunks              | Respect context limit                 |
| Chunk lacks valid source provenance   | Do not present fabricated citation    |
| Query tries to override business rule | Read-only retrieval preserves authoritative state |
| Current source is withdrawn during retrieval | Discard the affected result snapshot |
| Model, database or corpus limit failure | Return a sanitized operational error |

## 11. Acceptance & Test Matrix

| Source | Scenario                            | Expected Result           | Test Type    |
| ------ | ----------------------------------- | ------------------------- | ------------ |
| BR-248 | Relevant query                      | Relevant chunks retrieved | Retrieval    |
| BR-248 | Irrelevant chunk                    | Excluded                  | Retrieval    |
| BR-248 | Context exceeds limit               | Bounded                   | Boundary     |
| BR-248 | Selected chunk                      | Source preserved          | Traceability |
| BR-216 | AI request conflicts with hard rule | Hard rule unaffected      | Safety       |

## 12. Open Decisions

Retrieval uses the current eligible CTMS-051 chunk sets and the same pinned multilingual E5 model. PostgreSQL ranks by exact cosine similarity. Configured score and exact-locale gates, lexical corroboration, deduplication and the context budget control selection. Keep complete chunks and reject incomplete source items. The server sets the relevance threshold after calibration on approved PDFs.
