# CTMS-051 — Split Documents into Knowledge Chunks

## CTMS-052 dependency amendment — 2026-11-06

BR-228 extraction/embedding provenance remains unchanged. READY chunks are extraction output, not Admin approval or proof that one chunk is a complete procedure. Proposed **Approve Safety Guidance Applicability** groups ordered chunk IDs with exact document version/checksum, chunk set, original page/item references and complete conditions/warnings. It owns approval/applicability/coverage; 051 preserves traceability. See [upstream contracts](ctms-52-upstream-safety-contracts.md). Acceptance: wrong-version/missing-page/non-READY chunks block guidance consumption; similarity never substitutes for approval. 052 does not modify parsing/embedding.

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

Only the current `PUBLISHED` version under CTMS-050 BR-227 that meets BR-484 source eligibility may be processed. The worker evaluates the source itself, including for events created before the policy change.

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

An eligible source version creates an idempotent `PENDING` chunk set. A worker claims it as `RUNNING` with a renewable, fenced lease. Successful extraction, quality validation and complete embeddings transition it to `READY`; chunk insertion and activation commit together.

Other outcomes are `NEEDS_REVIEW` for incomplete/unverifiable extraction, `FAILED` for exhausted or permanent technical failures, and `OBSOLETE` when the source is superseded, archived or unavailable before completion. Transient failures return to `PENDING`, with at most three attempts. Explicit Admin retry requeues `FAILED`/`NEEDS_REVIEW` for an otherwise eligible source.

Source update
→ new authoritative source version
→ regenerate corresponding chunk set.

Existing chunks must not silently change provenance.

V1 remains in history while V2 is generated separately. The active chunk-set pointer changes only after the complete V2 set is persisted. Retrieval consumers must revalidate the current eligible publication; they cannot serve superseded V1 during a V2 rebuild or after stop-use.

The existing worker removes derived sets for superseded versions only after an eligible current active replacement has been READY for `KNOWLEDGE_CHUNK_RETENTION_DAYS` (default 7). Cleanup rechecks identity under the document lock, skips locked documents and leaves sets with restrictive live dependencies in place. Source files, version history and published package snapshots are retained.

On a local PostgreSQL database ending in `_test`, run `pnpm --filter @ctms/api run knowledge:reconcile:test` with `TEST_DATABASE_URL` and the source list set. It considers only current published versions without any set, reports queued and skipped versions, and is safe to repeat. Use an isolated integration database for the disposable test suites.

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

Each chunk also stores `document_version_id`, `chunk_set_id`, contextual `embedding_text`, heading path, original PDF page/item references and bounding boxes. The chunk set stores the immutable source checksum, locale, numbered source version, pipeline/model configuration and configuration hash. Chunk indexes are contiguous, zero-based and preserve document order. A unique `(document_version_id, config_hash)` prevents duplicate work for the same inputs. Different versions cannot share a chunk set.

Invariant:
`chunk.source_version = source version actually used for generation`.

Chunks from different source versions must remain distinguishable.

## 9. API / Integration Contract

Admin endpoints require an active Admin session, under `/api/admin/survival-documents/:documentId/versions/:versionId/chunk-sets`:

| Method | Result |
| --- | --- |
| `GET` | HTTP 200 with exact-version chunk-set summaries, state, attempts, quality issues, configuration and chunk count; HTTP 404 for an unknown document/version pair. |
| `POST` | HTTP 202 with the idempotently queued or existing summary. Retries failed/review-needed eligible work; a READY/in-flight set is unchanged. HTTP 409 `KNOWLEDGE_SOURCE_INELIGIBLE` for nonexistent, draft, unverified, superseded or archived sources. |

Publication outbox events enqueue work automatically using consumer-specific receipts. The authenticated internal Python endpoint `POST /knowledge-chunks` accepts exact-version metadata, SHA-256, configuration and PDF bytes as base64; it returns complete chunks and embeddings or a blocking quality report with no chunks. No public retrieval or AI answering API is introduced.

## 10. Error & Edge Cases

| Case                                | Expected                                        |
| ----------------------------------- | ----------------------------------------------- |
| Source does not exist               | Reject processing.                              |
| Unsupported/unapproved source state | Do not treat as authoritative.                  |
| Embedding generation fails          | Do not advertise incomplete chunk set as ready. |
| Source updated during processing    | Prevent mixed-version chunk set.                |
| Regeneration                        | New chunks reference new source version.        |
| Missing warning/condition, uncertain table, missing location, low parse confidence | Mark `NEEDS_REVIEW`; do not activate or generate embeddings for incomplete extraction. |
| Worker restart/lease expiration | Reclaim bounded attempts; expired worker tokens cannot complete another worker's job. |
| Duplicate publication event/request | One chunk set for the same version/configuration. |
| Source stop-use/deletion | Exclude from consumption immediately; document deletion cascades derived rows. |
| Storage failure during completion | Roll back chunks, status and active pointer together. |

## 11. Acceptance & Test Matrix

| Source | Scenario                 | Expected              |
| ------ | ------------------------ | --------------------- |
| BR-228 | Valid source             | Chunks generated      |
| BR-228 | Inspect chunk            | Required fields exist |
| BR-228 | Source v2 generated      | Chunks reference v2   |
| BR-228 | Source changes           | Regeneration possible |
| BR-228 | Concurrent source update | No mixed provenance   |
| BR-228 | Concurrent enqueue/claim and lease recovery | One live claim; stale completions rejected |
| BR-228 | Embedding/transaction failure | No partial READY set or activation |
| BR-228 | Extraction omits critical content | Visible `NEEDS_REVIEW` report with no consumable chunks |
| BR-227, BR-485 | Archive or delete the source | No current consumption. Archival retains the source version and document deletion removes it. |

## 12. Technical Design and Evaluation

The implemented technical design uses Docling PDF parsing and `HybridChunker`, with the embedding tokenizer and a 480-token total embedding-input budget. Heading context, title and the E5 passage prefix count toward the budget. Merge only adjacent chunks sharing headings/captions; do not split on page boundaries. Preserve tables with Markdown serialization and repeated headers. Preserve ordered procedures together; if a procedure or its critical context must be fragmented, require review. No generated/LLM context and no unconditional token overlap are used.

The initial embedding model is the pinned multilingual `intfloat/multilingual-e5-small` revision, producing 384-dimensional vectors. PostgreSQL stores vectors as `double precision[]`; pgvector indexes and online retrieval belong to CTMS-068. Parser, chunker, model revisions and preprocessing changes require a new pipeline version/configuration identity.

The first release handles searchable PDFs. OCR-only/blank pages, visual safety content, unverified table headers, missing extracted/native text, missing source locations and low extraction confidence block automatic activation and require a corrected source/review. Quality checks are conservative evidence checks, not a guarantee that PDF interpretation is clinically or professionally correct.

Retrieval acceptance uses 30–50 human-labelled questions from the actual PDF corpus. Gold evidence identifies the exact document version, page, source item and answer excerpt. Offline Recall@5 checks whether a retrieved chunk contains the labelled answer evidence; a match on page alone is insufficient. The evaluation tool is provided; a production score remains pending until the actual corpus and annotations are available.

See [implementation and data documentation](../../docs/features/CTMS-051-Implementation.md) for deployment, state/data contracts and verification commands.
