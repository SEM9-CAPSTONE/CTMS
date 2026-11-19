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

Only the current `PUBLISHED` version under CTMS-050 BR-227 that meets BR-484 and BR-535 through BR-537 may be processed. The worker evaluates the source itself, including for historical events. Admin can inspect processing status.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-050.

A survival-document source/version exists.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-228     | Each knowledge chunk must store content, chunk_index, metadata, source_version, locale and embedding with the exact source version used to generate it. |
| BR-539     | One document version and configuration identity may create at most one chunk set. |
| BR-540     | Only the current, unexpired processing lease can complete a claimed chunk set. |
| BR-541     | A chunk set becomes active only when the complete quality-validated result for the current eligible source commits. |
| BR-542     | A transient technical failure retries with bounded exponential backoff and a persisted attempt counter. |
| BR-543     | Exhausted technical work can automatically start a new bounded retry round only after its cooldown and a successful ingestion service probe. |
| BR-544     | A deterministic quality failure prevents further automatic attempts for the same PDF version and configuration. |
| BR-545     | Only the system can schedule or retry knowledge ingestion. |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                  |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                           |

## 6. State & Lifecycle

An eligible source version creates an idempotent `PENDING` chunk set. A worker claims it as `RUNNING` with a renewable, fenced lease. Successful extraction, quality validation and complete embeddings transition it to `READY`; chunk insertion and activation commit together.

Other outcomes are `NEEDS_REVIEW` for incomplete or unverifiable extraction, `FAILED` for exhausted or permanent technical failures, and `OBSOLETE` when the source is superseded, archived or unavailable before completion. Technical failures and expired leases have up to three attempts per round, with 30 and 60 seconds between attempts. A failed round can start up to two recovery rounds after cooldowns of 15 and 60 minutes. Recovery waits for an authenticated response from Ingestion and persists its round counter across restarts. Quality failures retain issue codes for the same PDF and configuration. A new published version or a changed pipeline configuration has its own eligibility and validation.

Source update
→ new authoritative source version
→ regenerate corresponding chunk set.

Existing chunks must not silently change provenance.

V1 remains in history while V2 gets its own extraction, quality report and chunk set. Compatible vectors can be reused from retained versions of the same document. The active chunk-set pointer changes only after the complete V2 set is persisted. Retrieval consumers must revalidate the current eligible publication; they cannot serve superseded V1 during a V2 rebuild or after stop-use.

The existing worker removes derived sets for superseded versions only after an eligible current active replacement has been READY for `KNOWLEDGE_CHUNK_RETENTION_DAYS` (default 7). Cleanup rechecks identity under the document lock, skips locked documents and leaves sets with restrictive live dependencies in place. Cleanup deletes shared vectors once the last retained chunk reference is removed. Whole-document deletion removes its shared vectors. Source files, version history and published package snapshots are retained by history cleanup.

The worker periodically reconciles current eligible publications missing a set for the current configuration. It handles already-receipted events and newly verified historical sources. On an isolated local PostgreSQL database ending in `_test`, `pnpm --filter @ctms/api run knowledge:reconcile:test` with `TEST_DATABASE_URL` exercises the same reconciliation.

## 7. Business Flow

1. Select authoritative survival-document version.
2. Read source content and metadata.
3. Split content according to Technical Design.
4. Assign deterministic/order-preserving `chunk_index`.
5. Preserve locale.
6. Resolve each validated chunk's vector from an exact input and configuration match in retained versions of the same document, or encode the distinct inputs that are missing a valid vector.
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
| `GET` | HTTP 200 with exact-version chunk-set summaries, state, attempts, automatic recovery indicator, quality issues, configuration and chunk count; HTTP 404 for an unknown document/version pair. |

Publication events enqueue work automatically using consumer-specific receipts. The authenticated internal Python endpoint `POST /knowledge-chunks/prepare` accepts exact-version metadata, SHA-256, configuration and PDF bytes as base64. It returns prepared chunks or a blocking quality result. `POST /passage-embeddings` encodes batches of up to 128 distinct cache misses in input order. Both routes use the same ingestion configuration. The existing `POST /knowledge-chunks` still returns complete chunks with vectors for compatibility. When the PDF reader cannot establish a page count, the stored quality report contains the issue and a null page count. The worker probes the authenticated `GET /readiness` endpoint before a new recovery round.

## 10. Error & Edge Cases

| Case                                | Expected                                        |
| ----------------------------------- | ----------------------------------------------- |
| Source does not exist               | Reject processing.                              |
| Unsupported/unapproved source state | Do not treat as authoritative.                  |
| Embedding generation fails          | Do not advertise incomplete chunk set as ready. |
| Source updated during processing    | Prevent mixed-version chunk set.                |
| Regeneration                        | New chunks reference new source version.        |
| Missing warning/condition, uncertain table, missing location, low parse confidence | Mark `NEEDS_REVIEW`; do not activate or generate embeddings for incomplete extraction. |
| Worker restart/lease expiration | Schedule the next bounded attempt; expired worker tokens cannot finalize the job. |
| Duplicate publication event | One chunk set for the same version/configuration. |
| Source stop-use/deletion | Exclude from consumption immediately; document deletion cascades derived rows. |
| Storage failure during completion | Roll back chunks, status and active pointer together. |

## 11. Acceptance & Test Matrix

| Source | Scenario                 | Expected              |
| ------ | ------------------------ | --------------------- |
| BR-228 | Valid source             | Chunks generated      |
| BR-228 | Inspect chunk            | Required fields exist |
| BR-228 | Source v2 generated      | Chunks reference v2   |
| BR-228 | Source changes           | Regeneration possible |
| BR-228 | Version shares exact inputs and has changed heading context | Only misses are encoded. Reused vectors have new chunks with current-version locations. |
| BR-228 | Concurrent source update | No mixed provenance   |
| BR-534 | Eligible publication and a rejected publication | Automatic durable delivery only for the committed eligible version |
| BR-539 | Replayed publication and concurrent consumers | One set for the exact version and configuration |
| BR-540 | Two workers contend and an earlier lease expires | One live claim and stale completions rejected |
| BR-541 | Complete extraction, failed replacement and transaction failure | Activate only the complete current set; exclude superseded or incomplete sets from retrieval |
| BR-542 | Transport failure, expired lease and restart | Persist the next retry and observe backoff before the next claim |
| BR-543 | Exhausted technical work while Ingestion is down, then up | Recovery waits for Ingestion and stops after the bounded rounds |
| BR-544 | Extraction omits critical content and the publication event is replayed | Visible `NEEDS_REVIEW` issues and zero retries or consumable chunks |
| BR-545 | Admin views status or attempts the retired mutation routes | Status reads succeed; manual processing mutations are unavailable |
| BR-227, BR-485 | Archive or delete the source | No current consumption. Archival retains the source version and document deletion removes it. |

## 12. Technical Design and Evaluation

The implemented technical design uses Docling PDF parsing and `HybridChunker`, with the embedding tokenizer and a 480-token total embedding-input budget. Heading context, title and the E5 passage prefix count toward the budget. Merge only adjacent chunks sharing headings/captions; do not split on page boundaries. Preserve tables with Markdown serialization and repeated headers. Preserve ordered procedures together; if a procedure or its critical context must be fragmented, require review. No generated/LLM context and no unconditional token overlap are used.

The initial embedding model is the pinned multilingual `intfloat/multilingual-e5-small` revision, producing 384-dimensional vectors. PostgreSQL stores vectors as `double precision[]`. New chunks reference `knowledge_embeddings` by ID; legacy chunks retain inline vectors and can supply compatible input to a new version. A shared vector is keyed by document ID, configuration hash and SHA-256 of the exact UTF-8 embedding input. The input itself is also checked before reuse. Title and heading changes can produce a miss. Page and chunk indexes are assigned from the current extraction. Parser, chunker, model revisions and preprocessing changes require a new pipeline version/configuration identity.

The first release handles searchable PDFs. OCR-only/blank pages, visual safety content, unverified table headers, missing extracted/native text, missing source locations and low extraction confidence block automatic activation. A report distinguishes observed source conditions such as encryption from extraction or chunking gaps when the evidence supports that distinction. Quality checks are conservative evidence checks, not a guarantee that PDF interpretation is clinically or professionally correct.

Retrieval acceptance uses 30–50 human-labelled questions from the actual PDF corpus. Gold evidence identifies the exact document version, page, source item and answer excerpt. Offline Recall@5 checks whether a retrieved chunk contains the labelled answer evidence; a match on page alone is insufficient. The evaluation tool is provided; a production score remains pending until the actual corpus and annotations are available.

See [implementation and data documentation](../../docs/features/CTMS-051-Implementation.md) for deployment, state/data contracts and verification commands.
