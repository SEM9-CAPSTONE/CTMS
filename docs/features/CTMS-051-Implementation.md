# CTMS-051 — Knowledge chunk ingestion
## Content integrity revision — 2026-11-20

The current pipeline is `ctms-content-integrity-v5`. It adds source-bound region review, a durable private extraction checkpoint, bounded alternative recognition and atomic derived-generation replacement. RAG requires a complete active generation of the current PUBLISHED PDF. Superseded sources are fenced immediately, including during generation; a derived rebuild can retain an active generation only for that same current PDF. Offline current-source rules remain unchanged. The earlier design and test results below are historical. Current contracts, migration, Admin verification and limits are documented in [content integrity](CTMS-051-Content-Integrity.md).


CTMS-051 converts current eligible survival-document PDFs into ordered, traceable chunks and embeddings. It consumes CTMS-050 publication events, runs parsing/embedding outside the API process, and atomically publishes complete chunk sets. Online retrieval and answering remain CTMS-068/069.

## Processing and configuration

1. The NestJS worker consumes `survival_document_outbox` through its own receipts, checks current publication and CTMS-050 source eligibility, and creates one set per `(document_version_id, config_hash)`.
2. Before claiming work, the worker requires an authenticated readiness response matching the current pipeline. An unavailable/outdated service leaves queued work PENDING without consuming attempts. PostgreSQL `FOR UPDATE SKIP LOCKED` then assigns one job with a random lease token. A 120-second lease renews every 20 seconds. Transient failures and expired claims retry after 30 and 60 seconds. After three attempts, exhausted technical jobs wait for an authenticated service probe and a cooldown before entering up to two recovery rounds (15 and 60 minutes). Retry counters and deadlines persist across restarts. A completion must own the current, unexpired token.
3. `SurvivalSourceReader` supplies verified private PDF bytes and source metadata. The Python worker checks SHA-256 before parsing. The internal request has a 10-minute timeout; the API renews the lease while waiting.
4. Docling identifies headings, paragraphs, lists and tables. `HybridChunker` splits oversized units and merges adjacent peers with the same heading/caption. Page breaks are provenance, not chunk boundaries.
5. Embedding input is `passage: <document title>\n<heading context and original chunk content>`. Raw chunk content is stored separately. No LLM decides boundaries or invents context. The pinned E5 tokenizer counts the complete embedding input, including title, prefix and special tokens, against a 480-token budget.
6. The worker verifies quality before looking up embeddings. PostgreSQL supplies compatible vectors from retained versions of the same document. Ingestion encodes distinct misses in batches. Only a complete result passes to a database transaction that rechecks the current source under the same document lock used for publication/stop-use, writes all vectors and chunk mappings, marks READY and switches the publication pointer.

Pipeline identity is `ctms-hybrid-ocr-v4`. The initial model is `intfloat/multilingual-e5-small`, revision `614241f622f53c4eeff9890bdc4f31cfecc418b3`, 384 dimensions, normalized vectors. Layout uses the pinned Heron revision `8f39ad3c0b4c58e9c2d2c84a38465abf757272d8`; the pinned Docling table model uses its v2.3.0 artifacts. Runtime parser/chunker/model packages are specified in `services/ai/requirements-ingestion.txt`. Change pipeline identity when parsing, serialization, quality thresholds, tokenizer/model or preprocessing changes. Keep approved model artifacts cached for reproducible rebuilds.

The implementation follows [Docling's HybridChunker](https://docling-project.github.io/docling/concepts/chunking/) and the [E5 model's passage/query conventions](https://huggingface.co/intfloat/multilingual-e5-small).

## Quality gates

Tables use Markdown serialization, including literal column headers and units, with repeated headers across split chunks. Docling's default triplet serializer is deliberately replaced: it can omit a column label and flatten relationships.

Every extracted body item's words must survive serialization/chunking, scoped by its original item reference, including native labels nested in figures. An independent pypdf extraction compares native PDF text against chunks located on each original page. Any missing warning/condition line blocks activation; a native-text word deficit above 2% also blocks it. Recognized page-header/footer metadata (page counters, month/year publication dates and form/revision identifiers) is accounted for separately; the same values in body text, emergency contacts and safety quantities remain required in chunks. Equivalent spacing such as `250ml`/`250 ml` is normalized, while changed values, units and value/unit pairings are blocking. Native issues are included in the corresponding per-page report. Parsed headings are included in embedding context.

Blocking issues include partial conversion, page-count mismatch, available parse/table confidence below 0.8, layout confidence below 0.5 (Docling's poor region-classification grade), missing PDF locations, empty/oversize chunks, missing extracted text, missing native safety text, tables without verified headers, unverified formulas, and fragmented ordered procedures or their critical context. This is text ingestion: image pixels are not interpreted as safety instructions. Pictures on pages whose source text passes validation do not by themselves block textual chunks; captions and native labels remain subject to text-preservation gates. Fair layout confidence still requires independent text coverage and all structure gates to pass; it is not itself a text-loss score. A quality failure returns `NEEDS_REVIEW`, issues and zero chunks; no embedding is generated or activated.

Tesseract 5.5.0 OCR supports Vietnamese and English through Docling. Native text retains its independent pypdf coverage check, without re-reading an entire illustrated page as OCR. The pinned pipeline selects text/table regions and records those exact rectangles for independent cropped-raster recognition agreement, confidence and residual-ink checks. Photographs/illustrations are excluded as OCR candidates; native labels inside them remain text. A selected OCR region that yields no cells must still be audited. Broken text layers retain full-page replacement. When no usable text/region evidence exists, the whole raster is checked, including for blank pages. A missing native text layer alone is not a quality failure. See [OCR deployment and tests](CTMS-051-OCR.md). Long procedures that cannot fit safely are also blocked. The same source and configuration retain the quality outcome; v3 reconciliation creates a new set from the stored original for historical v1/v2 failures without resetting their reports or requiring another upload.

These checks cannot prove that an original PDF or its parsed layout is correct. Admin-confirmed uploaded PDFs are verified at the source/content level. Automated extraction validation establishes technical eligibility; it does not reapprove the source. Real PDF corpus evaluation remains necessary to measure extraction accuracy.

## Lifecycle and version switching

| State | Meaning and next action |
| --- | --- |
| `PENDING` | Awaiting a claim or transient retry. |
| `RUNNING` | One fenced lease owns processing. |
| `READY` | All validated chunks and embeddings committed together. |
| `NEEDS_REVIEW` | Extraction cannot establish adequate coverage or structure. Admin sees a summary derived from the stored issue codes. |
| `FAILED` | Permanent technical error or exhausted attempts. The recovery indicator shows whether another automatic round remains. |
| `OBSOLETE` | Source lost eligibility before completion. Process the newer authoritative version instead. |

V2 gets a fresh extraction and its own chunk IDs and locations. Only the vector can be shared with V1. The active pointer changes only in the successful V2 transaction. `readCurrent(documentId)` checks current source eligibility, version, checksum, locale and count. Readers return an empty result while a newly published replacement is still being built.

Eligible publication queues ingestion. Background reconciliation revisits current eligible publications missing a set for the current configuration. Archive, supersession and deletion fence in-flight completions. Whole-document deletion cascades derived rows, and CTMS-050 retains audit and outbox history. Scheduled cleanup only removes superseded derived sets after an eligible active replacement has been READY for the retention period. See the [CTMS-051 specification](../../file/spec/ctms-51-split-documents-into-knowledge-chunks.md) for retention and test reconciliation.

## Data dictionary

Migrations: `1794100000000-CreateKnowledgeChunks.ts`, `1796900000000-TrackKnowledgeIngestionRecovery.ts` and `1797200000000-ShareKnowledgeEmbeddings.ts`. The shared storage migration preserves existing chunk IDs and inline vectors. New versions promote matching legacy vectors into shared storage as they are reused. The reverse migration restores shared vectors to their chunk rows before removing references.

| Table | Stored data and invariants |
| --- | --- |
| `knowledge_chunk_sets` | UUID, document UUID, exact document-version UUID, numbered source version, SHA-256, locale, configuration JSON/hash, state, attempt counter within the current round, retryable-failure flag, recovery round, next attempt time, fenced lease, quality report, count and timestamps. Unique `(document_version_id, config_hash)` makes delivery and reconciliation idempotent. Composite source FK binds document/version. |
| `knowledge_chunks` | UUID, chunk-set UUID, exact version UUID, numbered source version, locale, contiguous zero-based index, original content, contextual embedding text, metadata JSON and either a shared vector reference or a legacy inline vector. Composite FK requires each chunk's set/version/source-version/locale to agree with its set; indexes are unique within a set. Metadata includes heading path, original page/item/bounding boxes, token count and source title. Model identity and checksum are inherited from the immutable set. |
| `knowledge_embeddings` | One `double precision[]` vector per document, exact input SHA-256 and configuration hash. The input is checked on lookup. History cleanup deletes unused vectors, and deleting a document also deletes its shared vectors. |
| `knowledge_chunk_publications` | One document → one complete active chunk set. Composite FK prevents linking another document's set. Application transactions require READY and current-source eligibility; consumers recheck eligibility. |
| `knowledge_chunk_event_receipts` | CTMS-051-specific unique outbox event UUID and consumed timestamp. Other downstream consumers retain independent delivery tracking. |

Vectors use ordinary PostgreSQL arrays so pgvector is not required for ingestion. Semantic indexing/search can be added with CTMS-068 without losing source identity. Do not query historical `knowledge_chunks` directly as a substitute for the current-source eligibility boundary.

## API contracts

`GET /api/admin/survival-documents/:documentId/versions/:versionId/chunk-sets` requires an active Admin and returns exact-version summaries with status, attempts, recovery indicator, quality report, configuration, chunk count and timestamps. It excludes lease tokens. Unknown document/version pairs return 404 `KNOWLEDGE_SOURCE_NOT_FOUND`. The former mutation route returns 404.

The Python service exposes `POST /knowledge-chunks/prepare`, `POST /passage-embeddings`, the combined `POST /knowledge-chunks` and `GET /readiness`, authenticated with `X-CTMS-Knowledge-Token`. The prepare payload contains `document_version_id`, `source_version`, `checksum`, `locale`, `title`, fixed `configuration`, and `pdf_base64`. Limits are 50 MiB decoded PDF, 1,000 pages and 10,000 chunks. Invalid PDF/configuration returns 422. PDF read failures can include an allowlisted issue code without source text. The passage endpoint receives the pinned configuration and up to 128 inputs and returns vectors in input order. NestJS independently validates extraction metadata and vectors before persistence. The worker uses the combined route when the prepare endpoint is absent. The readiness probe verifies connectivity and authentication without loading the model. Docker checks liveness on `/health`.

## Run and verify

`pnpm dev:quick` starts PostgreSQL, Redis, Adminer, AI and Ingestion in Docker, then API and web locally. Before starting, set `KNOWLEDGE_SERVICE_URL=http://localhost:8001` and a nonempty `KNOWLEDGE_SERVICE_TOKEN` in the repository root `.env` so the local API and Ingestion share the same token. API in Compose uses `http://ingestion:8001`. `KNOWLEDGE_WORKER_ENABLED` defaults to true outside tests. Compose binds port 8001 to localhost and caches model artifacts in `knowledge-model-cache`.

```powershell
docker compose up -d --build ingestion api
```

For local Python work, use Python 3.12 installed independently of the editor/application. Virtual environments retain the base interpreter path; an interpreter inside a versioned application directory can disappear after an update. Do not create the project environment from such a bundled runtime.

On Windows, with [uv installed](https://docs.astral.sh/uv/getting-started/installation/), run from the repository root. Use the full path to `uv.exe` if it is not on PATH:

```powershell
uv python install 3.12 --install-dir .python --no-bin --no-registry
$env:UV_PYTHON_INSTALL_DIR=(Resolve-Path .python).Path
$knowledgePython = uv python find 3.12 --managed-python --no-project --resolve-links
& $knowledgePython -m venv .venv-ingestion
.\.venv-ingestion\Scripts\python.exe -m pip install -r services/ai/requirements-ingestion.txt
.\.venv-ingestion\Scripts\python.exe -m uvicorn app.knowledge_api:app --app-dir services/ai --env-file .env --host 127.0.0.1 --port 8001 --workers 1
```

The base interpreter lives in `.python` and dependencies in `.venv-ingestion`; both directories are excluded from Git and Docker build context. A separately installed system Python 3.12 is also suitable. Keep the ingestion environment separate from the weather/review service's environment because their dependency versions differ.

If an existing environment prints `No Python at ...`, install the independent base interpreter as above and repair the environment without clearing existing packages/model cache:

```powershell
& $knowledgePython -m venv --upgrade --without-pip .venv-ingestion
.\.venv-ingestion\Scripts\python.exe -c "import sys; print(sys.version); print(sys.base_prefix)"
```

Reinstall the requirements if imports or the dependency check fail. Run commands through the environment's own `python.exe`, so an unrelated Python installation is not selected accidentally.

Tests:

Run PostgreSQL integration/E2E tests against the isolated test service. From the repository root, in the same PowerShell terminal:

```powershell
docker compose -f docker-compose.test.yml up -d --wait
$env:TEST_DATABASE_URL='postgresql://ctms:ctms@127.0.0.1:55451/ctms_test'

Push-Location services/api
$testFiles = Get-ChildItem src/modules/knowledge-chunks,src/modules/survival-documents,src/modules/rag,src/modules/offline-packages -Recurse -Filter '*.spec.ts' | ForEach-Object FullName
.\node_modules\.bin\jest.cmd --runInBand --runTestsByPath @testFiles
.\node_modules\.bin\jest.cmd --config test/jest-integration.json --runInBand --runTestsByPath test/knowledge-chunks.integration-spec.ts test/survival-documents.integration-spec.ts test/offline-packages.integration-spec.ts test/package-activation.integration-spec.ts
.\node_modules\.bin\jest.cmd --config test/jest-e2e.json --runInBand --runTestsByPath test/survival-documents.e2e-spec.ts test/ai-answers.e2e-spec.ts test/offline-packages.e2e-spec.ts
Pop-Location

Push-Location apps/web
.\node_modules\.bin\vitest.cmd run src/features/survival-documents
Pop-Location

Push-Location services/ai
..\..\.venv-ingestion\Scripts\python.exe -B -m pytest -q -p no:cacheprovider app/test_knowledge_api.py app/test_knowledge_chunking.py app/test_rag_knowledge_api.py app/test_knowledge_recall.py
Pop-Location
```

For chunking, recall and checksum checks without the Python HTTP client, run from `services/ai`:

```powershell
..\..\.venv-ingestion\Scripts\python.exe -B -m pytest -q -p no:cacheprovider app/test_knowledge_chunking.py app/test_knowledge_recall.py app/test_knowledge_api.py::test_checksum_or_invalid_pdf_rejected_before_loading_models
```

`docker-compose.test.yml` uses a separate Compose project, localhost port 55451 and disposable in-memory storage. It never mounts the application's `postgres-data` volume. Test data is recreated after restarting the container. `TEST_DATABASE_URL` must remain set in the terminal running Jest; setting it only in the root `.env` does not configure Jest's database setup. The existing test guards still require the database name to end in `_test`.

If the existing PostgreSQL instance reports `could not open critical system index 2662` or repeatedly enters recovery mode, its system catalog/index needs separate investigation. Index 2662 is PostgreSQL's [pg_class_oid_index](https://github.com/postgres/postgres/blob/REL_16_STABLE/src/include/catalog/pg_class.h). Running isolated tests does not repair that database. Diagnose and back up the affected instance before attempting recovery; rebuilding the application's data volume is not part of the test workflow.

Stop the isolated test service when finished:

```powershell
docker compose -f docker-compose.test.yml down
Remove-Item Env:TEST_DATABASE_URL -ErrorAction SilentlyContinue
```

The integration suite uses real PostgreSQL, transactions, guarded HTTP, private source files, publication/stop-use and worker claims. Its provider response is controlled; it is not a real-model quality benchmark. Python boundary tests use real `DoclingDocument`, `HybridChunker` and table serializers with an offline word tokenizer; HTTP tests cover authenticated validation and failures. The evaluator tests are synthetic correctness tests, not production Recall@5 results.

An additional opt-in smoke test runs a synthetic PDF through the real pinned parser and embedding model, checks reproducible text/provenance and encodes a Vietnamese query. It downloads model weights on the first run:

```powershell
Push-Location services/ai
$env:RUN_KNOWLEDGE_MODEL_SMOKE='true'
..\..\.venv-ingestion\Scripts\python.exe -m pytest app/test_knowledge_smoke.py -q
Pop-Location
```

Verification on 2026-11-06 passed 27 TypeScript unit tests, 26 PostgreSQL integration/regression tests covering CTMS-050/051, 4 HTTP E2E tests with real login, and 25 Python tests including the real parser/model smoke test. TypeScript compilation, Biome and whitespace checks passed. The 26 integration and 4 E2E tests were rerun successfully against `docker-compose.test.yml` after the existing database reported a system-index error. The isolated test service is reusable; use the cleanup command above when finished. Production deployment, recovery of the existing database and actual-corpus Recall@5 were not performed.

## Retrieval acceptance

Prepare 30–50 distinct questions from approved real PDFs, preserving each question's locale. Each `expected_sources` entry must identify `document_version_id`, one-based `page`, Docling `item_ref`, and a literal `source_excerpt` containing the answer. The evaluator requires the exact answer excerpt, preventing a hit on another portion of the same large source item from inflating Recall@5.

Questions JSON is an array; each row has `id`, `question`, `locale`, and `expected_sources`. Snapshots JSON is an array of complete `IngestionResponse` objects, one per exact document version. Export only currently eligible complete sets and use the same fixed model configuration. Then run:

```powershell
cd services/ai
python -m app.knowledge_recall --questions questions.json --snapshots snapshots.json --output recall-report.json
```

The tool embeds queries with `query: `, ranks locale-matching passages by cosine similarity, validates gold evidence exists, and emits per-question Top-5 results and overall Recall@5. It rejects review-needed, duplicated version snapshots and invalid annotations. Actual corpus questions and a measured score remain pending; no real benchmark PDF corpus was supplied in this task.

## Rule verification

| Rule | Valid-path coverage | Violation/concurrency coverage |
| --- | --- | --- |
| BR-228 | Ordered complete chunks with locale, source identity, vectors; V2 regeneration; worker private-file read | Mixed version/locale/checksum/configuration rejection, incomplete vectors, missing text/location, quality review, transaction rollback, concurrent requests/claims, stale lease tokens, publication race, archive and deletion |
| BR-212 | Spec, API/state contract and data dictionary updated together | Response validation rejects configuration/provenance drift; contract test coverage |
| BR-213 | Unit and real PostgreSQL integration tests | Concurrent enqueue/claim, idempotent completion, lease recovery, rollback and publication/stop-use races |
