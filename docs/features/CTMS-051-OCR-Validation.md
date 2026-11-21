# OCR implementation validation — 2026-11-19

Implementation is available for review. Full release verification remains
incomplete because automatic approval review blocked model downloads and some
test/typecheck processes after reporting telemetry to
`dc.services.visualstudio.com`. The payload was not established. Setting offline
and telemetry-disable flags, and restricting test connections, did not resolve
all reported egress. No production data migration or publication was performed.

## Executed checks

Commands below ran from the stated directory. Local Python was
`D:/Capstone/CTMS/.venv-ingestion/Scripts/python.exe`, Python 3.12.13. The real OCR
stage used the official Windows Tesseract 5.5.0 binary extracted into
`D:/Capstone/CTMS/.cache/ocr-runtime/tesseract-bin`, with checksum-verified
`tessdata_best` 4.1.0 models in the adjacent `tessdata` directory. These local
runtime/cache files are ignored by Git.

| Check | Observed result |
| --- | --- |
| Python API/chunking/OCR/fixture/recall/RAG/editor regression | 65 passed at the broad regression checkpoint; the final combined rerun was blocked |
| Final targeted Python chunking, OCR evidence and fixture assertions | 36 passed after the provenance fixture correction |
| Real Docling Tesseract adapter, Vietnamese/English, warning, table, multiple pages, blank page | 6 passed at the first OCR-stage checkpoint |
| Stricter unit-confidence OCR rerun, including unreadable raster | 6 passed, 1 failed: the scanned table's `ml` confidence was below 0.90; the gate blocked it correctly |
| Final OCR rerun after improving the table fixture's header readability | Blocked by automatic approval review; no final pass count available |
| NestJS provider, output policy, source policy and RAG retrieval | 84 passed in 4 suites |
| Web ingestion status and survival-document workflows | 31 passed in 2 files |
| API `tsc --noEmit` | Passed |
| API source plus both changed PostgreSQL integration suites, TypeScript compiler API | Passed |
| Web `tsc --noEmit` | Blocked by automatic approval review; no compiler result available |
| Biome checks on changed TypeScript | Passed after formatting |
| Git whitespace check, OCR Python syntax and workflow YAML parsing | Passed |

Python broad regression, from `services/ai`:

```powershell
$env:HF_HUB_OFFLINE='1'
$env:TRANSFORMERS_OFFLINE='1'
$env:HF_HUB_DISABLE_TELEMETRY='1'
$env:DO_NOT_TRACK='1'
..\..\.venv-ingestion\Scripts\python.exe -B -m pytest app/test_knowledge_api.py app/test_knowledge_chunking.py app/test_knowledge_ocr.py app/test_ocr_fixtures.py app/test_knowledge_recall.py app/test_rag_knowledge_api.py app/test_document_editor.py -q -p no:cacheprovider
```

Final targeted regression, from `services/ai`:

```powershell
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
..\..\.venv-ingestion\Scripts\python.exe -B -m pytest app/test_knowledge_chunking.py app/test_knowledge_ocr.py app/test_ocr_fixtures.py -q -p no:cacheprovider
```

Real OCR-stage check, from `services/ai`, after setting the runtime paths above:

```powershell
$env:CTMS_TESSERACT_CMD='D:/Capstone/CTMS/.cache/ocr-runtime/tesseract-bin/tesseract.exe'
$env:CTMS_TESSDATA_PATH='D:/Capstone/CTMS/.cache/ocr-runtime/tessdata'
$env:OMP_THREAD_LIMIT='2'
$env:RUN_KNOWLEDGE_OCR_INTEGRATION='true'
..\..\.venv-ingestion\Scripts\python.exe -B -m pytest app/test_docling_ocr_stage.py -q -p no:cacheprovider
```

API unit regression and typecheck, from `services/api`:

```powershell
.\node_modules\.bin\jest.cmd --runInBand --runTestsByPath src/modules/knowledge-chunks/knowledge-chunks.policy.spec.ts src/modules/knowledge-chunks/knowledge-chunks.provider.spec.ts src/modules/survival-documents/source-policy.spec.ts src/modules/rag/rag-retrieval.service.spec.ts
.\node_modules\.bin\tsc.cmd --noEmit
```

Frontend regression, from `apps/web`:

```powershell
.\node_modules\.bin\vitest.cmd run src/features/survival-documents/components/SourceChunkingStatus.test.tsx src/features/survival-documents/pages/SurvivalDocumentsPage.test.tsx
```

## Failures found and corrections

- The initial real OCR stage failed because the custom language directory lacked
  `configs/tsv`; provisioning/verification now includes it. Real OCR then passed.
- The initial raster audit treated intersecting table rules as unexplained ink.
  Both rule directions are now detected on the intact raster before removing
  text boxes. The real table stage then passed with the existing word thresholds.
- Applying the stricter 0.90 threshold to units correctly rejected the table
  fixture's parenthesized `ml` at approximately 0.885 confidence. The committed
  fixture now has a clearer `Value ml` header. Thresholds were preserved; the
  final real OCR rerun is still blocked.
- Original unit fixtures used bottom-left coordinates with the default top-left
  origin. Explicit `BOTTOMLEFT` provenance now matches their coordinates. The
  final targeted 36-test regression passed.

## Checks not completed

| Pending check | Reason |
| --- | --- |
| Full Docling layout + OCR + HybridChunker + E5 tests in `test_knowledge_ocr_integration.py` (9 cases) | The pinned layout/TableFormer downloads were blocked before provisioning completed. The real OCR adapter stage does not substitute for this full test. |
| Updated native PDF/model smoke | Requires the same unprovisioned layout/TableFormer artifacts. |
| PostgreSQL reprocessing/lifecycle integration | The isolated Docker engine was inaccessible; attempts using local `ctms_ocr_test` were blocked by automatic approval review, including a test-local network guard. No passing database result is claimed. |
| Ingestion Docker image build and new OCR GitHub Actions workflow | Local Docker engine access denied; the workflow has been added but not run in this session. |
| Representative 12/40/594-page source corpus, measured throughput/memory and retrieval/citation evaluation | Not executed. Synthetic fixtures are not a replacement for real-corpus evaluation. |
| Workspace-wide lint/build/test commands and mobile regression | Not executed; scoped checks are recorded above. |

## Modified files and purpose

Paths are relative to the repository root.

| Files | Purpose |
| --- | --- |
| `services/ai/app/knowledge_ingestion.py` | Enable supported Docling OCR, retain parsed cells, replace broken text layers, combine raster/native/structural gates before embedding. |
| `services/ai/app/knowledge_ocr.py` | Fixed OCR runtime checks, TSV evidence, confidence, critical values, blank-page detection, raster coverage and page reports. |
| `services/ai/app/ocr_artifacts.py`, `prefetch_knowledge_models.py` | Checksum-pinned OCR models and reproducible public model prefetching. |
| `services/ai/app/knowledge_chunking.py` | Provenance validation, native numeric/unit preservation, validated scan backgrounds, OCR-aware native-text comparison. |
| `services/ai/app/knowledge_models.py`, `knowledge_api.py` | Pipeline v2, page evidence contract, sanitized retryable OCR-runtime errors. |
| `services/ai/requirements-ingestion.txt`, `infra/docker/ingestion.Dockerfile` | Pin raster/OpenCV dependencies, CPU Tesseract build, model provisioning and offline serving. |
| `services/api/src/modules/knowledge-chunks/knowledge-chunks.types.ts`, `knowledge-chunks.policy.ts`, `knowledge-chunks.provider.ts` | Matching v2 configuration hash, validate page evidence and classify runtime errors. Existing repository/worker lifecycle remains reused. |
| `services/api/src/modules/survival-documents/source-policy.ts` | Accept Admin-confirmed uploaded medical content while retaining explicit rejection and use restrictions. |
| `apps/web/src/features/survival-documents/components/SourceChunkingStatus.tsx` | Actionable Vietnamese extraction/runtime messages in the existing status component. |
| Python `test_knowledge_api.py`, `test_knowledge_chunking.py`, `test_knowledge_ocr.py`, `test_ocr_fixtures.py`, `test_docling_ocr_stage.py`, `test_knowledge_ocr_integration.py`, `fixtures/ocr/*` | Contract, chunking and quality regression; real image-only PDF fixtures and OCR tests. |
| Nest provider/policy/source-policy spec files, `rag-retrieval.service.spec.ts`, `test/knowledge-chunks.integration-spec.ts`, `test/survival-documents.integration-spec.ts` | Reprocessing, source policy, compatibility, cache, atomicity and existing lifecycle regression. |
| `apps/web/src/features/survival-documents/components/SourceChunkingStatus.test.tsx` | READY and OCR error messages with no extra approval action. |
| `.github/workflows/knowledge-ocr.yml` | Build the pinned runtime and run full real OCR tests with container networking disabled. |
| `.gitignore` | Exclude local runtime binaries, model caches and provisioning helpers. |
| CTMS-050/051 implementation notes and specifications; `CTMS-051-OCR.md` | Align Admin source confirmation, OCR behavior, version rollout, runtime setup and test instructions. |

## Follow-up: localhost rollout mismatch

Read-only diagnostics of the reported Admin failure established that all four
current document versions had a v2 set failing on its first attempt with
`ingestion_http_422` and no extraction quality report. The service's
`http://127.0.0.1:8001/openapi.json` still accepted only `ctms-hybrid-v1`.
Both health endpoints were up; the old process rejected the new contract before
PDF conversion.

The fix adds an authenticated readiness pipeline header, distinguishes literal
configuration mismatch from ordinary invalid requests, and permits empty legacy
v2 HTTP 422 failures to enter the existing capped recovery after a matching
service is available. A read-only predicate check found four eligible failures;
no database rows were directly modified. The Dockerfile fixes the prefetched
cache path so the Compose `HF_HOME` volume cannot hide image-baked artifacts.

Follow-up commands and observed results:

```powershell
# services/api — 63 passed across three suites; tsc passed
.\node_modules\.bin\jest.cmd --runInBand --runTestsByPath src/modules/knowledge-chunks/knowledge-chunks.provider.spec.ts src/modules/knowledge-chunks/knowledge-chunks.policy.spec.ts src/modules/survival-documents/source-policy.spec.ts
.\node_modules\.bin\tsc.cmd --noEmit

# services/ai — 12 passed
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
$env:HF_HUB_OFFLINE='1'
$env:TRANSFORMERS_OFFLINE='1'
..\..\.venv-ingestion\Scripts\python.exe -B -m pytest app/test_knowledge_api.py -q -p no:cacheprovider

# apps/web — 5 passed
.\node_modules\.bin\vitest.cmd run src/features/survival-documents/components/SourceChunkingStatus.test.tsx
```

The new PostgreSQL recovery-cap case is added to
`knowledge-chunks.integration-spec.ts`; its database execution remains pending.
Local Docker API access still returns permission denied, so the running v1
container was not rebuilt in this session. Rebuild instructions are in
[OCR deployment](CTMS-051-OCR.md#api-v2-talking-to-an-old-v1-ingestion-container).

## Follow-up: reproducible post-conversion HTTP 502

The supplied container log showed OSD warnings with too few characters, while
health checks succeeded and inspection reported `OOMKilled=false` and zero
restarts. Docling's fixed-language OCR adapter catches the OSD error and continues
recognition; it is not evidence that the whole page was skipped.

Two implementation failures were reproduced independently of layout/model
downloads with real PDF bytes and Docling documents:

1. `get_expected_page_nos()` in the pinned Docling 2.148 implementation returns
   one-based page numbers. The integration indexed Python native-page lists
   directly with those keys. A two-page regression failed at the final confidence
   lookup with `IndexError: list index out of range`. Conversion pages,
   confidence and OCR-cell mappings now consistently preserve one-based identity;
   native/PDFium list access explicitly subtracts one.
2. After fixing that lookup, the page-local OCR regression exposed
   `TypeError: 'PdfPage' object does not support the context manager protocol`.
   PDFium pages and bitmap resources now close in `finally` blocks.

The tests also cover a broken text layer on the first and last page, and reject
invalid zero-based conversion provenance without returning chunks. Runtime errors
now log exception class and code locations while preserving sanitized responses.
Docker copies only model-provisioning inputs before the download layers, then
copies application code, so subsequent runtime-only edits can reuse those layers.

From `services/ai`, the following passed **54 tests**, including five new page
numbering/resource regressions and the safe-log assertion:

```powershell
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
$env:HF_HUB_OFFLINE='1'
$env:TRANSFORMERS_OFFLINE='1'
..\..\.venv-ingestion\Scripts\python.exe -B -m pytest app/test_knowledge_page_numbers.py app/test_knowledge_chunking.py app/test_knowledge_ocr.py app/test_knowledge_api.py app/test_ocr_fixtures.py -q -p no:cacheprovider
```

The conversion/model stage is injected in the page-index regression to isolate
the failure. This result does not claim a successful complete real-model run or
a READY result for the uploaded documents. The separate real OCR/model and Docker
verification limitations above still apply. Rebuild ingestion to deploy the fix;
do not edit source PDFs, chunk-set quality status or source checksums manually.

The expanded Python regression subsequently passed **72 tests** with the same
offline/plugin settings, using this command from `services/ai`:

```powershell
..\..\.venv-ingestion\Scripts\python.exe -B -m pytest app/test_knowledge_page_numbers.py app/test_knowledge_chunking.py app/test_knowledge_ocr.py app/test_knowledge_api.py app/test_ocr_fixtures.py app/test_knowledge_recall.py app/test_rag_knowledge_api.py app/test_document_editor.py -q -p no:cacheprovider
```

The changed Python files parsed successfully, the OCR workflow YAML parsed, and
`git diff --check` reported no whitespace issues. Container rebuild and complete
real-model verification were not executed in this session.

## 2026-11-20: native text and OCR region correction (v3)

The reported 12-page Trip Planning Guide had native/mixed pages rejected by a
whole-page raster audit, including low-confidence OCR and unexplained picture
pixels. Pipeline `ctms-hybrid-ocr-v3` scopes OCR and its audit to selected text
regions, retains native figure labels, accounts for identified page metadata,
and preserves numeric value/unit pairings. Images are not interpreted as safety
instructions. Native text, OCR confidence, table, formula, provenance and
procedure checks still gate activation. Empty selected crops cannot prove that
an original scanned page is blank. A scan detected entirely as a picture retains
an OCR fallback. Existing v1/v2 quality reports are preserved.

The API now probes the authenticated matching ingestion service before claiming
pending work. Downtime/version mismatch therefore leaves new queued work pending
without spending attempts. In-flight failures keep their bounded retry rules.

| Check | Observed result |
| --- | --- |
| Final combined Python chunking/native-page/OCR/page-number/fixture/recall/editor/checksum regression, including actual Tesseract adapter tests | 76 passed; 8 use the provisioned real OCR adapter, including a native page with a raster paragraph |
| NestJS output policy, provider, RAG retrieval and new pre-claim readiness guard | 59 passed in 4 suites (57 existing boundary/RAG tests plus 2 readiness tests) |
| API `tsc --noEmit` | Passed |
| Changed PostgreSQL integration suite, TypeScript compiler API | Passed typecheck; database execution not performed |
| Biome on changed API TypeScript and `git diff --check` | Passed |

The final Python run used the local Tesseract/traineddata paths documented above,
`RUN_KNOWLEDGE_OCR_INTEGRATION=true`, offline/telemetry-disable flags and disabled
external pytest plugin loading. From `services/ai`:

```powershell
..\..\.venv-ingestion\Scripts\python.exe -u -B -m pytest app/test_knowledge_chunking.py app/test_knowledge_native_pages.py app/test_knowledge_page_numbers.py app/test_knowledge_ocr.py app/test_ocr_fixtures.py app/test_knowledge_recall.py app/test_document_editor.py app/test_knowledge_api.py::test_checksum_or_invalid_pdf_rejected_before_loading_models app/test_docling_ocr_stage.py -q -p no:cacheprovider
```

Full FastAPI HTTP tests could not complete in this environment. A faulthandler
trace identified the first TestClient request waiting in Windows asyncio's
`socketpair` fallback (`socket.accept`), before the ASGI route ran. Those runs
were stopped and are not counted as passed. Docker access was denied at its
named pipe; the complete Heron/TableFormer model cache was also unavailable.
Consequently this result does not claim a full-model conversion or READY status
for the uploaded Trip Planning Guide. The existing container CI workflow still
exercises complete conversion with prefetched models and no network.

To apply locally, rebuild ingestion first and restart the API with the matching
v3 contract. Reconciliation creates fresh v3 sets from stored published PDFs;
do not change previous quality failures to READY or erase their reports.

## 2026-11-20: actual source PDFs and complete model validation (v4)

The local model artifacts were subsequently made available from the existing
ingestion image. Actual conversion of the stored original PDFs reproduced both
reported v3 issue lists. Those source files were read without changing their
bytes, checksums, database state or publication history.

The v4 implementation corrects these independently reproduced causes:

- Native text on colored backgrounds was unnecessarily selected for OCR; narrow
  bitmap intersections and overlapping detections also created partial words.
  Native coverage now considers the smaller source/text region, separate raster
  fragments remain eligible, and overlapping OCR detections are recognized once.
- Consecutive sibling headings could be overwritten before HybridChunker emitted
  body text. Original headings and meaningful publication headers are retained
  as sourced chunks. Body repetition cannot substitute for a source title.
- pypdf inserted spaces within Vietnamese font runs, for example `s ự` versus
  `sự`. Alignment now requires the complete ordered glyphs and unchanged number
  spellings/signs and number/unit pairings. Missing warnings and changed values
  still fail the cross-check.
- A contents list and blank forms had no column headers to infer. They serialize
  literal cells. Real adjacent-page table continuations repeat only source-backed
  headers with validated column geometry and original header citations. This
  includes a missing illustration column, restored empty rather than inventing
  an image description. Header citations do not reorder continuation data.
- Tight source crops now keep a one-point source margin and white recognition
  padding. Small crops rescale their coordinates using floating-point columns;
  assigning fractional positions into integer pandas columns previously failed
  complete OCR batches. Colored/reversed labels receive contrast normalization;
  ordinary white-paper anti-aliasing is retained. OCR language follows the
  document locale.
- Native font decoding is retained, while owned PDFium resources supply exact
  source rasters/crops for extraction and audit. This avoids the threaded native
  renderer image-buffer access violation observed on Windows. A real backend
  test compares complete page/crop pixels and prevents use of that native buffer.
- Grid tables use rule removal and sparse text segmentation in recognition
  inputs, while geometry and residual-ink checks retain the original raster.
  Page-local structured evidence includes separate ordered-list markers. A low
  layout score is exempt only for a raster-verified blank page with no claimed
  text. These fixes were exposed by the complete real-model fixture suite.

The OCR confidence thresholds remain 0.75 per word, 0.90 mean and 0.90 for
audited critical lines, numbers and units. Formula, procedure, provenance,
numeric pairing and token-budget checks remain active. Generic prose detections
inside artwork on native pages are excluded; detected captions/headings and
native figure labels remain subject to their respective source checks. Scans
without native text retain the OCR fallback.

### Final actual-document result

Both documents ran through the real `KnowledgeIngestionService.generate` path
using the pinned local OCR, layout, table, tokenizer and embedding models.

| Stored original | Final local v4 outcome |
| --- | --- |
| Trip planning guide, 12 pages | `PASSED`, no issues, 100 chunks and 100 embeddings of 384 dimensions; largest embedding input 322 tokens. All six raster category labels are retained. |
| Phòng ngừa thảm họa, 40 pages | `NEEDS_REVIEW`. Native warning/numeric/coverage and table-header failures are resolved. OCR/raster failures remain on physical pages 17, 31, 34, 35 and 36. There are 92 internal prepared candidates, but **zero accepted chunks/embeddings** from `generate`, as required for a rejected document. |

The remaining Vietnamese-document regions include a small handwritten caption
and raster figure labels. The minimum observed confidence on page 17 was about
0.072; other rejected pages include unread or low-confidence label characters.
The final remaining codes are `ocr_critical_content_unverified`,
`ocr_low_confidence`, `ocr_unverified_visual_content` and
`visual_content_requires_review`. They were not rewritten to PASSED. Waiting for
a retry time does not repair this source/recognition uncertainty.

These are local pipeline results, not a claim that the running Docker service or
database has already switched to READY. The separate 594-page and 136-page
first-aid documents were not converted completely in this validation.

### Final regression results

| Check | Observed result |
| --- | --- |
| Chunking, native/region OCR guards, literal/continuation tables, actual PDF backend raster identity, page numbering/blank pages, fixtures, recall, editor and pre-model checksum rejection | 107 passed |
| Complete real-model OCR/native/mixed conversion, deterministic outputs, embeddings, unreadable-source rejection and actual Tesseract adapter tests | 18 passed, no skipped cases. OCR suites forbid network connections; the native model smoke uses cached offline artifacts. |
| NestJS output policy, provider, RAG retrieval and pre-claim readiness guard | 59 passed in 4 suites |
| API `tsc --noEmit --incremental false` | Passed |
| Updated knowledge PostgreSQL integration suite, TypeScript compiler API | Passed typecheck; database execution unavailable |
| Biome, Python AST, OCR workflow YAML and `git diff --check` | Passed |

With the local runtime paths, offline/telemetry flags and disabled external pytest
plugins described above, the Python commands from the repository root were:

```powershell
.venv-ingestion/Scripts/python.exe -B -m pytest services/ai/app/test_knowledge_chunking.py services/ai/app/test_knowledge_native_pages.py services/ai/app/test_knowledge_tables.py services/ai/app/test_knowledge_pdf_backend.py services/ai/app/test_knowledge_page_numbers.py services/ai/app/test_knowledge_ocr.py services/ai/app/test_ocr_fixtures.py services/ai/app/test_knowledge_recall.py services/ai/app/test_document_editor.py services/ai/app/test_knowledge_api.py::test_checksum_or_invalid_pdf_rejected_before_loading_models -q -p no:cacheprovider

$env:RUN_KNOWLEDGE_OCR_INTEGRATION='true'
$env:RUN_KNOWLEDGE_MODEL_SMOKE='true'
.venv-ingestion/Scripts/python.exe -u -B -m pytest services/ai/app/test_knowledge_ocr_integration.py services/ai/app/test_knowledge_smoke.py services/ai/app/test_docling_ocr_stage.py -q -p no:cacheprovider
```

Full HTTP TestClient execution and Docker/database access retain the environment
limitations recorded in the prior checkpoint. They are not counted as passed.
Deploy matching v4 ingestion/API code before checking the new configuration's
status. Reconciliation queues fresh v4 sets from stored originals and preserves
historical v1/v2/v3 results; no manual status override or PDF re-upload is needed
to apply the algorithm update.
