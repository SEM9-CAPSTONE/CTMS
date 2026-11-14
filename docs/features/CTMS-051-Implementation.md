# CTMS-051 — Knowledge chunk ingestion

CTMS-051 converts current eligible survival-document PDFs into ordered, traceable chunks and embeddings. It consumes CTMS-050 publication events, runs parsing/embedding outside the API process, and atomically publishes complete chunk sets. Online retrieval and answering remain CTMS-068/069.

## Processing and configuration

1. The NestJS worker consumes `survival_document_outbox` through its own receipts, checks current publication and CTMS-050 source eligibility, and creates one set per `(document_version_id, config_hash)`.
2. PostgreSQL `FOR UPDATE SKIP LOCKED` assigns one job with a random lease token. A 120-second lease renews every 20 seconds. Transient HTTP/transport errors retry after 30 seconds, up to three attempts. Worker restarts recover expired claims. A completion must own the current, unexpired token.
3. `SurvivalSourceReader` supplies verified private PDF bytes and source metadata. The Python worker checks SHA-256 before parsing. The internal request has a 10-minute timeout; the API renews the lease while waiting.
4. Docling identifies headings, paragraphs, lists and tables. `HybridChunker` splits oversized units and merges adjacent peers with the same heading/caption. Page breaks are provenance, not chunk boundaries.
5. Embedding input is `passage: <document title>\n<heading context and original chunk content>`. Raw chunk content is stored separately. No LLM decides boundaries or invents context. The pinned E5 tokenizer counts the complete embedding input, including title, prefix and special tokens, against a 480-token budget.
6. The worker verifies quality before embedding. Only a complete result passes to a database transaction that rechecks the current source under the same document lock used for publication/stop-use, writes all chunks, marks READY and switches the publication pointer.

Pipeline identity is `ctms-hybrid-v1`. The initial model is `intfloat/multilingual-e5-small`, revision `614241f622f53c4eeff9890bdc4f31cfecc418b3`, 384 dimensions, normalized vectors. Layout uses the pinned Heron revision `8f39ad3c0b4c58e9c2d2c84a38465abf757272d8`; the pinned Docling table model uses its v2.3.0 artifacts. Runtime parser/chunker/model packages are specified in `services/ai/requirements-ingestion.txt`. Change pipeline identity when parsing, serialization, quality thresholds, tokenizer/model or preprocessing changes. Keep approved model artifacts cached for reproducible rebuilds.

The implementation follows [Docling's HybridChunker](https://docling-project.github.io/docling/concepts/chunking/) and the [E5 model's passage/query conventions](https://huggingface.co/intfloat/multilingual-e5-small).

## Quality gates

Tables use Markdown serialization, including literal column headers and units, with repeated headers across split chunks. Docling's default triplet serializer is deliberately replaced: it can omit a column label and flatten relationships.

Every extracted body item's words must survive serialization/chunking, scoped by its original item reference. An independent pypdf extraction compares native PDF text against chunks located on each original page. Any missing warning/condition line blocks activation; a native-text word deficit above 2% also blocks it. The tolerance accommodates page furniture/formatting; it does not relax critical-line checks. Parsed headings are included in embedding context.

Blocking issues include partial conversion, page-count mismatch, available parse/table confidence below 0.8, layout confidence below 0.5 (Docling's poor region-classification grade), missing PDF locations, empty/oversize chunks, missing extracted text, missing native safety text, tables without verified headers, visual/formula content, and fragmented ordered procedures or their critical context. Fair layout confidence still requires independent text coverage and all structure gates to pass; it is not itself a text-loss score. A quality failure returns `NEEDS_REVIEW`, issues and zero chunks; no embedding is generated or activated.

OCR is disabled in this first release. Pages without independently extractable text, including scanned or blank pages, produce `page_text_unverifiable`. These documents need a corrected/searchable source and reprocessing. Long procedures that cannot fit safely are also blocked. Retrying an unchanged deficient source repeats the report; correcting it normally means uploading/publishing a new PDF version. There is no override that silently approves incomplete text.

These checks cannot prove that an original PDF or its parsed layout is correct. Real survival PDFs still require corpus evaluation and professional source review, especially for medical material.

## Lifecycle and version switching

| State | Meaning and next action |
| --- | --- |
| `PENDING` | Awaiting a claim or transient retry. |
| `RUNNING` | One fenced lease owns processing. |
| `READY` | All validated chunks and embeddings committed together. |
| `NEEDS_REVIEW` | Extraction cannot establish adequate coverage/structure; issue codes remain visible to Admin. |
| `FAILED` | Permanent technical error or exhausted attempts. Admin may retry when the cause is resolved. |
| `OBSOLETE` | Source lost eligibility before completion. Process the newer authoritative version instead. |

V2 builds independently of V1. Existing chunks retain their exact source version. The active pointer changes only in the successful V2 transaction. `readCurrent(documentId)` checks current source eligibility, version, checksum, locale and count. Readers return an empty result while a newly published replacement is still being built.

Eligible publication queues ingestion. Manual requests use the same policy. Archive, supersession and deletion fence in-flight completions. Whole-document deletion cascades derived rows, and CTMS-050 retains audit and outbox history. Scheduled cleanup only removes superseded derived sets after an eligible active replacement has been READY for the retention period. See the [CTMS-051 specification](../../file/spec/ctms-51-split-documents-into-knowledge-chunks.md) for retention and test backfill.

## Data dictionary

Migration: `1794100000000-CreateKnowledgeChunks.ts`. It requires the current CTMS-050 migrations and is applied by the existing TypeORM migration runner.

| Table | Stored data and invariants |
| --- | --- |
| `knowledge_chunk_sets` | UUID, document UUID, exact document-version UUID, numbered source version, SHA-256, locale, configuration JSON/hash, state, attempt counter, retry time, fenced lease, quality report, count and timestamps. Unique `(document_version_id, config_hash)` makes automatic delivery and requests idempotent. Composite source FK binds document/version. |
| `knowledge_chunks` | UUID, chunk-set UUID, exact version UUID, numbered source version, locale, contiguous zero-based index, original content, contextual embedding text, metadata JSON and `double precision[]` vector. Composite FK requires each chunk's set/version/source-version/locale to agree with its set; indexes are unique within a set. Metadata includes heading path, original page/item/bounding boxes, token count and source title. Model identity and checksum are inherited from the immutable set. |
| `knowledge_chunk_publications` | One document → one complete active chunk set. Composite FK prevents linking another document's set. Application transactions require READY and current-source eligibility; consumers recheck eligibility. |
| `knowledge_chunk_event_receipts` | CTMS-051-specific unique outbox event UUID and consumed timestamp. Other downstream consumers retain independent delivery tracking. |

Vectors use ordinary PostgreSQL arrays so pgvector is not required for ingestion. Semantic indexing/search can be added with CTMS-068 without losing source identity. Do not query historical `knowledge_chunks` directly as a substitute for the current-source eligibility boundary.

## API contracts

`GET /api/admin/survival-documents/:documentId/versions/:versionId/chunk-sets` returns exact-version summaries with status, attempts, quality report, configuration, chunk count and timestamps. It excludes lease tokens. Unknown document/version pairs return 404 `KNOWLEDGE_SOURCE_NOT_FOUND`.

`POST` at the same route returns HTTP 202. Eligible new work is queued. READY or in-flight requests return the existing set; FAILED/NEEDS_REVIEW resets attempts and queues that same configuration. It rejects ineligible/missing sources with 409 `KNOWLEDGE_SOURCE_INELIGIBLE`. Both routes require an active Admin; unauthenticated/non-Admin requests return 401/403. There is no request-body configuration override.

The Python service exposes `POST /knowledge-chunks`, authenticated with `X-CTMS-Knowledge-Token`, and an inexpensive `/health` endpoint. Payload contains `document_version_id`, `source_version`, `checksum`, `locale`, `title`, fixed `configuration`, and `pdf_base64`. Limits are 50 MiB decoded PDF, 1,000 pages and 10,000 chunks. Missing service configuration returns 503; invalid token 401; invalid PDF/configuration 422; technical or malformed embedding failures 502. Error responses do not include source text. Python output is independently validated in NestJS before persistence.

## Run and verify

Configure the same nonempty `KNOWLEDGE_SERVICE_TOKEN` for API and ingestion. API uses `KNOWLEDGE_SERVICE_URL` (locally `http://localhost:8001`, Compose `http://ingestion:8001`). `KNOWLEDGE_WORKER_ENABLED` defaults to true outside tests. The dedicated ingestion image isolates heavy Python/model dependencies from existing weather and review services. Compose binds port 8001 to localhost and caches model artifacts in `knowledge-model-cache`.

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

pnpm --filter @ctms/api exec jest --runInBand knowledge-chunks
pnpm --filter @ctms/api exec jest --config test/jest-integration.json --runInBand knowledge-chunks.integration-spec.ts survival-documents.integration-spec.ts
pnpm --filter @ctms/api exec jest --config test/jest-e2e.json --runInBand survival-documents.e2e-spec.ts

Push-Location services/ai
..\..\.venv-ingestion\Scripts\python.exe -m pytest app/test_knowledge_chunking.py app/test_knowledge_api.py app/test_knowledge_recall.py -q
Pop-Location
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
