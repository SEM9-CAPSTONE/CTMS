# CTMS-051 — Split Documents into Knowledge Chunks

## Approved lifecycle amendment — 2026-11-28

Eligible drafts now prepare knowledge before publication. The previous eligible publication remains current until an explicit atomic source/knowledge switch. READY drafts remain private. See [the lifecycle contract and diagrams](../../docs/features/Document-Version-Knowledge-Lifecycle.md) and [CTMS-220 restoration](ctms-220-document-version-editor.md).

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
- Source-bound region validation, bounded targeted recovery and Admin-assisted verification of extracted content.

### Out of Scope

- Survival-document management — CTMS-050.
- RAG retrieval — CTMS-068.
- AI answering — CTMS-069.

## 3. Actors & Authorization

- System / ingestion process.
- Authorized knowledge-management workflow as upstream source.

Eligible private DRAFTs and the current eligible PUBLISHED version can be prepared under CTMS-050 source/rights policy. Only the current eligible PUBLISHED version with its valid active READY set can be retrieved. Admin preparation confirmation does not publish or activate a draft.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-050.

A survival-document source/version exists.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-228     | Each knowledge chunk must store content, chunk_index, metadata, source_version, locale and embedding with the exact source version used to generate it. |
| BR-539 | One document version, configuration identity and ingestion input revision may create at most one chunk set. Source title and input revision are captured independently of the shared embedding cache key. |
| BR-540 | Only a current unexpired lease for unchanged exact source inputs can checkpoint or complete a set. Draft revision changes fence stale worker results. |
| BR-541 | An eligible private DRAFT may become READY without activation. A normal RAG-eligible publication atomically switches the current source and its complete READY knowledge after exact identity, title, locale, configuration, quality, chunk-count and vector-reference validation. Retain V1 throughout V2 preparation. Rebuilding the same current PDF can retain its eligible active set. Retrieval excludes drafts and superseded/archived versions; explicit withdrawal takes effect immediately and never falls back to history. |
| BR-542     | A transient technical failure retries with bounded exponential backoff and a persisted attempt counter. |
| BR-543     | Exhausted technical work can automatically start a new bounded retry round only after its cooldown and an authenticated ingestion service probe matching the current pipeline. Empty legacy v2 HTTP 422 rollout failures with no quality report can use the same capped recovery after the compatible service is available. |
| BR-544     | A deterministic quality failure stops whole-document automatic retries. A source region may use one distinct bounded recovery method and then requires source/context verification if unresolved. An audited correction resumes the cached extraction, with complete source validation before activation. |
| BR-545 | The system schedules ingestion through the existing outbox and worker. Admin may confirm draft sources, inspect preparation and verify source regions using existing revision/replay controls. Unpermitted whole-document manual retries, direct chunk/vector editing and quality bypass remain unavailable. Existing safe label-exclusion restrictions remain enforced. |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                  |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                           |

## 6. State & Lifecycle

An eligible source version creates an idempotent `PENDING` chunk set. Before claiming pending work, the worker checks authenticated ingestion readiness for the current pipeline; an unavailable or outdated service leaves the task pending without consuming attempts. A worker claims it as `RUNNING` with a renewable, fenced lease. Successful extraction, quality validation and complete embeddings transition it to `READY`. A draft result stays private; its later explicit publication atomically activates the prepared set. A derived rebuild of the same current eligible PDF can still activate at completion.

Other outcomes are `NEEDS_REVIEW` for incomplete or unverifiable extraction, `FAILED` for exhausted or permanent technical failures, and `OBSOLETE` when the source is superseded, archived or unavailable before completion. Technical failures and expired leases have up to three attempts per round, with 30 and 60 seconds between attempts. A failed round can start up to two recovery rounds after cooldowns of 15 and 60 minutes. Recovery waits for an authenticated response from Ingestion and persists its round counter across restarts. Quality failures retain issue codes for the same PDF and configuration. A new published version or a changed pipeline configuration has its own eligibility and validation.

Source update
→ new authoritative source version
→ regenerate corresponding chunk set.

Existing chunks must not silently change provenance.

V1 remains current and retrievable while DRAFT V2 gets a full extraction, quality report and independent chunk set. Historical compatible exact-input vectors can be reused. READY V2 stays private until explicit publication atomically switches both the current source and active knowledge. Retrieval revalidates the active pointer, current PUBLISHED identity, configuration and provenance before serving and before answer persistence. Archive, deletion and safety restrictions still remove eligibility immediately; there is no historical fallback. Offline guidance retains its current-version applicability checks.

The existing worker removes derived sets for superseded versions only after an eligible current active replacement has been READY for `KNOWLEDGE_CHUNK_RETENTION_DAYS` (default 7). Cleanup rechecks identity under the document lock, skips locked documents and leaves sets with restrictive live dependencies in place. Cleanup deletes shared vectors once the last retained chunk reference is removed. Whole-document deletion removes its shared vectors. Source files, version history and published package snapshots are retained by history cleanup.

The worker periodically reconciles eligible drafts and current publications missing a set for the current configuration and input revision. It handles already-receipted events and newly verified historical sources. On an isolated local PostgreSQL database ending in `_test`, `pnpm --filter @ctms/api run knowledge:reconcile:test` with `TEST_DATABASE_URL` exercises the same reconciliation.

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

Each chunk also stores `document_version_id`, `chunk_set_id`, contextual `embedding_text`, heading path, original PDF page/item references and bounding boxes. The chunk set stores the immutable source checksum, locale, numbered source version, pipeline/model configuration and configuration hash. Chunk indexes are contiguous, zero-based and preserve document order. A unique `(document_version_id, config_hash, input_revision)` prevents duplicate work for the same inputs. Different versions cannot share a chunk set.

Invariant:
`chunk.source_version = source version actually used for generation`.

Chunks from different source versions must remain distinguishable.

## 9. API / Integration Contract

Admin endpoints require an active Admin session, under `/api/admin/survival-documents/:documentId/versions/:versionId/chunk-sets`:

| Method | Result |
| --- | --- |
| `GET` | HTTP 200 with exact-version chunk-set summaries, state, attempts, automatic recovery indicator, quality issues, configuration and chunk count; HTTP 404 for an unknown document/version pair. |

Draft preparation events enqueue work automatically using existing consumer-specific receipts. Publication events revalidate current eligibility and cannot activate stale sources. The authenticated internal Python endpoint `POST /knowledge-chunks/prepare` accepts exact-version metadata, SHA-256, configuration and PDF bytes as base64. It returns prepared chunks or a blocking quality result. `POST /passage-embeddings` encodes batches of up to 128 distinct cache misses in input order. Both routes use the same ingestion configuration. The existing `POST /knowledge-chunks` still returns complete chunks with vectors for compatibility. When the PDF reader cannot establish a page count, the stored quality report contains the issue and a null page count. The worker probes the authenticated `GET /readiness` endpoint before a new recovery round.

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
| BR-534 | Eligible draft creation, confirmation and relevant input changes record durable preparation delivery in the source transaction. Publication requires prepared knowledge and atomically records source activation, the active chunk-set reference, audit and the publication outbox event. READY never publishes a draft automatically. |
| BR-539 | One document version, configuration identity and ingestion input revision may create at most one chunk set. Source title and input revision are captured independently of the shared embedding cache key. |
| BR-540 | Only a current unexpired lease for unchanged exact source inputs can checkpoint or complete a set. Draft revision changes fence stale worker results. |
| BR-541 | An eligible private DRAFT may become READY without activation. A normal RAG-eligible publication atomically switches the current source and its complete READY knowledge after exact identity, title, locale, configuration, quality, chunk-count and vector-reference validation. Retain V1 throughout V2 preparation. Rebuilding the same current PDF can retain its eligible active set. Retrieval excludes drafts and superseded/archived versions; explicit withdrawal takes effect immediately and never falls back to history. |
| BR-542 | Transport failure, expired lease and restart | Persist the next retry and observe backoff before the next claim |
| BR-543 | Exhausted technical work while Ingestion is down, then up | Recovery waits for Ingestion and stops after the bounded rounds |
| BR-544 | Extraction omits critical content and the publication event is replayed | Localized manual review after bounded recovery, no automatic whole-document retry or partial consumption |
| BR-545 | The system schedules ingestion through the existing outbox and worker. Admin may confirm draft sources, inspect preparation and verify source regions using existing revision/replay controls. Unpermitted whole-document manual retries, direct chunk/vector editing and quality bypass remain unavailable. Existing safe label-exclusion restrictions remain enforced. |
| BR-227, BR-485 | Archive or delete the source | No current consumption. Archival retains the source version and document deletion removes it. |

## 12. Technical Design and Evaluation

The implemented technical design uses Docling PDF parsing and `HybridChunker`, with the embedding tokenizer and a 480-token total embedding-input budget. Heading context, title and the E5 passage prefix count toward the budget. Merge only adjacent chunks sharing headings/captions; do not split on page boundaries. Preserve tables with Markdown serialization and repeated headers. Preserve ordered procedures together; if a procedure or its critical context must be fragmented, require review. No generated/LLM context and no unconditional token overlap are used.

The initial embedding model is the pinned multilingual `intfloat/multilingual-e5-small` revision, producing 384-dimensional vectors. PostgreSQL stores vectors as `double precision[]`. New chunks reference `knowledge_embeddings` by ID; legacy chunks retain inline vectors and can supply compatible input to a new version. A shared vector is keyed by document ID, configuration hash and SHA-256 of the exact UTF-8 embedding input. The input itself is also checked before reuse. Title and heading changes can produce a miss. Page and chunk indexes are assigned from the current extraction. Parser, chunker, model revisions and preprocessing changes require a new pipeline version/configuration identity.

The preceding `ctms-hybrid-ocr-v4` pipeline handles searchable, scanned and mixed PDFs in Vietnamese and English. It ingests source text, including captions and figure labels; it does not infer instructions from illustrations. Native pages use the independent PDF-text check. OCR uses source-aligned text/table regions, locale-appropriate language models, contrast normalization for colored/reversed labels, and cropped-raster agreement, confidence and coverage checks. Native font decoding is retained while PDFium renders the original raster for both extraction and validation. Broken text layers retain full-page OCR. Selected regions with no recognized cells still require validation; pages without usable native/region evidence require full-raster validation, including blank pages. Meaningful titles, consecutive headings and publication headers remain sourced retrieval text; physical page counters may be accounted for separately. Font-run spacing can align only when ordered glyphs, number spellings/signs and number/unit pairings match. Changed words, values, units, pairings and missing warnings remain blocking. Headerless contents lists and blank forms serialize literal cells without invented column names. A continuation table can repeat actual preceding headers only when adjacent-page position, source column geometry and absence of an intervening section establish continuity; chunks retain the header's original source location. Unknown headerless numeric tables remain blocked. Unverified critical OCR content, formulas, missing extracted/native text, missing source locations and low extraction confidence block automatic activation. Native mismatch codes appear in their original page reports. Historical v1/v2/v3 quality reports remain intact while reconciliation creates a new v4 set from the stored original. Quality checks are technical evidence, not a guarantee of clinical correctness or a complete interpretation of illustrations.

Retrieval acceptance uses 30–50 human-labelled questions from the actual PDF corpus. Gold evidence identifies the exact document version, page, source item and answer excerpt. Offline Recall@5 checks whether a retrieved chunk contains the labelled answer evidence; a match on page alone is insufficient. The evaluation tool is provided; a production score remains pending until the actual corpus and annotations are available.

Pipeline `ctms-content-integrity-v5` adds a private version/checksum/configuration-bound extraction snapshot in `knowledge_chunk_sets.extraction_snapshot`, localized source evidence and audited human decisions. Pictures and nonliteral tables require explicit interpretation/relationship verification; confidence and a native text layer are insufficient. Minor confirmed captions no longer block eligibility. A correction preserves source structure and rechunks only its dependent semantic interval; unchanged embedding inputs reuse the existing vector cache. A READY revision is immutable and edits create a candidate generation (`verification_revision`) without altering the active pointer. See [content integrity design and verification](../../docs/features/CTMS-051-Content-Integrity.md).

See [implementation and data documentation](../../docs/features/CTMS-051-Implementation.md) for deployment, state/data contracts and verification commands.
