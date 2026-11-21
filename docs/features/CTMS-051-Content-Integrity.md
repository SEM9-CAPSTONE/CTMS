# PDF content integrity and source verification

## Root causes

The previous `KnowledgeIngestionService._prepare` merged minimum word confidence, OCR coverage, native mismatches and visual warnings into one document-level issue list. Any issue returned zero consumable chunks. This correctly prevented partial activation but treated an uncertain caption as an unresolved whole-document outcome and retained no resumable extraction.

`validate_page` confidence is a diagnostic observation, not semantic correctness. A single uncertain italic glyph or short figure label therefore blocked the entire set. Conversely, a picture on a clean native-text page was not independently interpreted. Native checks could also count words from the other page of a merged chunk; v5 additionally compares page-local structured items.

`knowledge_chunk_publications` records a complete derived generation, but its retained pointer is not permission to retrieve a superseded PDF. RAG must independently require the current PUBLISHED source at retrieval and final answer commit. Publishing V2 fences V1 immediately, including an answer whose generation already started. This is distinct from rebuilding derived content for the same current PDF.

## Existing storage and lifecycle

- Immutable sources: `survival_document_versions` and private PDF storage; CTMS-050 publication semantics stay unchanged.
- Derived extraction generations: `knowledge_chunk_sets` (source version/checksum/locale/configuration, lease, quality report).
- Content and citations: `knowledge_chunks` with ordered indexes and original page/item/bounding boxes.
- Shared vectors: `knowledge_embeddings`, keyed by document, compatible configuration and exact embedding input; PostgreSQL `double precision[]`, not an external vector database.
- Atomic active generation: `knowledge_chunk_publications`.
- Human decisions: existing `audit_logs` with Admin, timestamp, source version/checksum, page/box, original/previous/new text, action, confirmations, reason and idempotency request.

## Validation and bounded recovery

`ctms-content-integrity-v5` stores source-bound region fingerprints, original text, related pictures, internal assessments and attempted methods. Every independent source, numeric, unit, location, reading-order/procedure and token-budget check still applies. Verification is scoped to actual structured source blocks and their dependent heading interval. All required regions and document-level checks must pass together; prepared candidates never become a partial RAG corpus.

An uncertain noncritical region can use one additional PSM-13 recognition. Automatic acceptance requires exact source-word agreement and complete raster/coverage/confidence validation. It never substitutes inferred text or numbers. A repeated method is not rerun once recorded. Unresolved content becomes a concrete manual issue, not another whole-PDF quality retry. Critical values require direct source verification. A picture always requires a verified description unless it is an independently validated full-page scan background. Nonliteral tables require an explicit row/column review even when headers and confidence look correct.

The extraction snapshot is checkpointed under the live lease before embedding. Retries after that checkpoint resume the saved document rather than invoking conversion/OCR. A process interrupted before its first durable checkpoint can still repeat the initial extraction within the existing bounded technical retry policy. Initial conversion is not checkpointed page by page.

Long conversion uses a separate lock from query embeddings. A second conversion receives a busy response; worker readiness does not consume another job while the converter is occupied. Existing RAG can still embed queries while another PDF is converting. Docling conversion has a 25-minute document deadline; partial conversion remains ineligible. The configurable HTTP extraction deadline is `KNOWLEDGE_EXTRACTION_TIMEOUT_MS` (default 30 minutes, accepted 1–60 minutes); leases continue renewing independently. These are different limits; stopping an HTTP request does not terminate an in-flight native OCR subprocess.

## Admin workflow

In the existing document detail, Admin sees “Có một số nội dung cần kiểm tra trước khi xuất bản.” and **Kiểm tra nội dung**. The PDF publication badge/lifecycle remains independent of knowledge eligibility.

The dialog selects a named position on a source page, opens that page, highlights its source rectangle and supports zoom. It shows original extracted text and surrounding source content. Admin can confirm/correct text, edit separate blocks without flattening headings, describe a figure or edit a table grid. Source/context checks are mandatory, with an additional figure check when relevant. Only a recognized noncritical figure label may be excluded, with a reason and an already-described linked figure; warnings, quantities, tables and images cannot be excluded.

GET and POST `admin/survival-documents/:documentId/versions/:versionId/content-verification[/regionId]` require JWT and Admin. Submission includes extraction generation, expected review revision and request ID. The document lock serializes publication and review; stale revisions conflict, identical requests replay safely, and the same request cannot change meaning. Failures retain the UI draft and use the existing toast. No original PDF mutation occurs. No whole-document retry button or technical status/count/score is exposed.

Inspection distinguishes the newest derived extraction's preparation from an eligible active generation of that same current PDF. Its `inUse` flag reuses RAG publication eligibility and verifies the active set's complete ordered chunk count. A background rebuild can therefore display ordinary update feedback without suggesting the existing source is unavailable. Unresolved review positions remain actionable, and a superseded PDF never receives this availability flag. Existing chunk rows alone are not proof of active availability.

## Incremental updates and retrieval

Decisions apply to a derived Docling tree. An image description gets a sourced child block; repeated decisions update that block instead of appending duplicates. Missing text requires a same-page reading-order anchor. Table corrections retain explicit rows, columns and blank cells.

Reprocessing expands the changed item's interval to its heading context and dependent chunks, prunes a structured clone and rechunks that interval. The full derived result is checked again against original source evidence. Unchanged prepared blocks and exact embedding inputs are reused. No fixed overlap is introduced; boundaries follow the existing semantic chunker, including conditions and procedure checks. Chunk rows belong to immutable generations; a replacement generation can have new row IDs while reusing unchanged content and embedding rows.

Editing an already-READY generation forks a candidate with `verification_revision + 1`. The vector cache normalizes this review generation to revision zero while retaining pipeline/model/input identity. All chunk rows, vector references and the active pointer commit in one PostgreSQL transaction under the fenced lease. A failed or incomplete candidate leaves the active generation intact only while that generation belongs to the same current PUBLISHED PDF.

RAG requires the explicit active pointer, a complete READY set and its exact current PUBLISHED PDF version, checksum, locale, configuration and provenance. A SUPERSEDED V1 cannot serve during V2 verification, even if its old pointer is retained for history. When no eligible source remains, retrieval and generation return INSUFFICIENT_CONTEXT. Final answer persistence rechecks evidence under document locks. Once V2 fully passes, the pointer switches atomically; no query observes mixed V1/V2 or historical fallback. Archive, deletion, rights and offline applicability rules remain enforced.

## Migration and rollout

`1797900000000-CacheKnowledgeExtraction.ts` adds nullable JSONB `knowledge_chunk_sets.extraction_snapshot`. This private cache contains the structured document, page evidence, candidate content and review decisions; it is separate from publicly readable processing summaries. Existing rows remain valid with NULL and existing active pointers are not rewritten. No new tables, source-version changes or heavy dependencies are introduced.

Apply the migration before starting the updated API. Deploy API and ingestion together so the readiness pipeline identity agrees. Reconciliation creates v5 candidates for current eligible sources while compatible complete generations of those same current PDF versions can continue serving.

```powershell
pnpm --filter @ctms/api migration:run
docker compose up -d --build ingestion api
```

Run these in the environment whose database is intended for deployment. No migration or runtime-data update was performed from the restricted development session.

## Verification and limits

The added suites exercise region classification, caption/image relationships, prohibited critical exclusions, bounded recovery, source fingerprint binding across JSON round trips, cached correction without converter calls, separate-block preservation, reading-order anchors, unchanged semantic intervals, idempotent descriptions, query/conversion lock separation, authorization, inspection redaction, integrity eligibility and Admin form behavior. PostgreSQL integration cases additionally cover audit/replay/conflict, durable checkpoint recovery, superseded-source fencing during V2 verification and atomic replacement.

The real OCR fixture suite uses the actual pinned Docling, Tesseract and E5 runtime with network disabled. Its raster table review uses literal ground truth from the fixture generator and verifies cached resumption; it does not mark any real uploaded document reviewed.

Confirmed results and original-document diagnostics are recorded after execution in [validation evidence](CTMS-051-OCR-Validation.md). PostgreSQL/HTTP integration cannot be declared passing when the environment refuses the local socket. A manually reviewed illustration remains a human assertion: the pipeline cannot establish complete visual/medical meaning from OCR confidence. Complex merged tables/formulas, unreadable sources, conversion failures, missing provenance and oversized inseparable procedures can require specialist review or a new, clearer source version. There is no universal automatic correction guarantee.
