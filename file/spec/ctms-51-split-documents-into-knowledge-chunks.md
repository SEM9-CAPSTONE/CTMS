# CTMS-051 — Split Documents into Knowledge Chunks

## 1. Overview

Story: CTMS-051

Epic: EPIC 11. AI Survival Assistant and RAG

Use Case: Split Documents into Knowledge Chunks

Priority: Must Have

Goal: Convert authoritative survival-document versions into traceable knowledge chunks for retrieval while preserving source version and locale.

## 2. Scope

### In Scope

- Chunk generation.
- Chunk ordering/index.
- Metadata.
- Locale.
- Embedding.
- Source-version traceability.
- Regeneration after source update.

### Out of Scope

- Survival-document management — CTMS-050.
- RAG retrieval — CTMS-068.
- AI answering — CTMS-069.

## 3. Actors & Authorization

- System / ingestion process.
- Authorized knowledge-management workflow as upstream source.

Only approved source versions may be processed according to CTMS-050 lifecycle.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-050.

A survival-document source/version exists.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-228     | Each knowledge chunk must store content, chunk_index, metadata, source_version, locale, and embedding. source_version must match the document version used to generate the chunk, and chunks must be reproducible when the source document is updated. |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                  |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                           |

## 6. State & Lifecycle

Source version
→ chunk generation
→ chunk set associated with that source version.

Source update
→ new authoritative source version
→ regenerate corresponding chunk set.

Existing chunks must not silently change provenance.

## 7. Business Flow

1. Select authoritative survival-document version.
2. Read source content and metadata.
3. Split content according to Technical Design.
4. Assign deterministic/order-preserving `chunk_index`.
5. Preserve locale.
6. Generate embedding.
7. Associate every chunk with exact source version.
8. Persist chunk set.
9. On source update, regenerate against new version.

## 8. Data & Invariants

Every chunk must contain:

- content;
- chunk index;
- metadata;
- source version;
- locale;
- embedding.

Invariant:
`chunk.source_version = source version actually used for generation`.

Chunks from different source versions must remain distinguishable.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                | Expected                                        |
| ----------------------------------- | ----------------------------------------------- |
| Source does not exist               | Reject processing.                              |
| Unsupported/unapproved source state | Do not treat as authoritative.                  |
| Embedding generation fails          | Do not advertise incomplete chunk set as ready. |
| Source updated during processing    | Prevent mixed-version chunk set.                |
| Regeneration                        | New chunks reference new source version.        |

## 11. Acceptance & Test Matrix

| Source | Scenario                 | Expected              |
| ------ | ------------------------ | --------------------- |
| BR-228 | Valid source             | Chunks generated      |
| BR-228 | Inspect chunk            | Required fields exist |
| BR-228 | Source v2 generated      | Chunks reference v2   |
| BR-228 | Source changes           | Regeneration possible |
| BR-228 | Concurrent source update | No mixed provenance   |

## 12. Open Decisions

Chunk size, overlap strategy, embedding model and vector-store implementation belong to Technical Design.
