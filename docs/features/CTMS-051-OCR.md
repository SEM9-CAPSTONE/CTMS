   # CTMS-051 OCR runtime and validation

Pipeline identity is `ctms-hybrid-ocr-v4` in Python and NestJS. The exact-version,
checksum, locale, token limit, model and revision fields retain their existing
contract. Quality reports additionally contain page mode, OCR word count,
minimum observed confidence, text coverage and issue codes. Reports contain no
new public source-text payload.

## Runtime choice and artifacts

CTMS uses Docling 2.148.0's supported `TesseractCliOcrOptions` integration with
Tesseract 5.5.0 and `tessdata_best` 4.1.0 `vie`, `eng` and `osd` files. The CLI
engine exposes individual word confidence and coordinates, works on CPU and
does not require GPU services or Python native Tesseract bindings. EasyOCR also
supports Vietnamese/English but adds a separate detector/recognizer and Torch
model provisioning. RapidOCR's default recognition models are not selected as
evidence of Vietnamese support. Automatic engine fallback would change results
without changing configuration identity, so this deployment selects one engine.

`app/ocr_artifacts.py` pins and verifies SHA-256 for all three language models.
It provisions the required `configs/tsv` file. Language-file presence alone is
insufficient: without this configuration Tesseract can output plain text instead
of the TSV required by Docling. The runtime validates the engine version, model
hashes and TSV configuration before conversion. Artifact/runtime failures return
sanitized HTTP 503 `ocr_runtime_unavailable`, eligible for the existing bounded
technical retry/recovery lifecycle.

The ingestion Dockerfile builds Tesseract from the checksum-pinned 5.5.0 source
archive on Debian Bookworm. It copies the runtime binary into Python 3.12,
installs Leptonica, OpenMP, PDFium/OpenCV dependencies and DejaVu fonts, and
prefetches OCR, Heron, TableFormer and E5 artifacts at image build time. Heron is
pinned to `8f39ad3c0b4c58e9c2d2c84a38465abf757272d8`; TableFormer v2.3.0 is
pinned to commit `fc0f2d45e2218ea24bce5045f58a389aed16dc23`. E5 keeps its existing
revision. Serving runs with Hugging Face/Transformers offline and telemetry off.
The image fixes `HF_HUB_CACHE` to `/opt/ctms/huggingface/hub`; the existing Compose
`HF_HOME` volume cannot hide prefetched artifacts on a clean deployment.

### Production image size and build cache

`app/knowledge_artifacts.py` owns the pinned model identities independently of
the ingestion request/response schemas. E5 provisioning downloads only the
Safetensors weights, tokenizer and SentenceTransformer configuration, including
the pooling module. Duplicate pickle weights, ONNX/OpenVINO exports and model
evaluation datasets are excluded. The model revision, 384 dimensions, tokenizer,
normalization, OCR artifacts and quality gates are unchanged. A missing required
E5 file fails the build. No existing stored embedding needs rebuilding for this
packaging change.

Embedding, layout and table artifacts occupy separate cached Docker layers.
Application/schema-only changes do not invalidate model provisioning. Production
defaults to the `runtime` target without pytest, test modules or fixture PDFs.
The `test` target adds these to the same production base. For offline regression,
build and run from the repository root:

```bash
docker build --target test -f infra/docker/ingestion.Dockerfile -t ctms-ingestion-tests .
docker run --rm --network none -e RUN_KNOWLEDGE_MODEL_SMOKE=true ctms-ingestion-tests python -B -m pytest -q -p no:cacheprovider app/test_prefetch_knowledge_models.py
```

The dedicated OCR workflow uses this test target and also exercises real scanned,
native and mixed PDFs with `--network none`. To measure the production image,
build the default target separately and use `docker image inspect` and
`docker history`; the test image includes additional files and is not the
production size. The first deployment of the optimized model layers still needs
to download those layers. Old images and interrupted downloads on the VPS are not
removed by this source change. Retain the running release and a rollback release
when reviewing images for cleanup; do not remove volumes or containerd files by
hand.

Local configuration, from the repository root, after installing Tesseract 5.5.0:

```powershell
$env:CTMS_TESSERACT_CMD='C:/Program Files/Tesseract-OCR/tesseract.exe'
$env:CTMS_TESSDATA_PATH="$PWD/.cache/ocr-runtime/tessdata"
$env:DOCLING_ARTIFACTS_PATH="$PWD/.cache/ocr-runtime/models"
$env:HF_HUB_CACHE="$PWD/.cache/ocr-runtime/hf"
$env:HF_HUB_DISABLE_TELEMETRY='1'
$env:DO_NOT_TRACK='1'
$env:HF_HUB_DISABLE_XET='1'
$env:OMP_THREAD_LIMIT='2'
Push-Location services/ai
..\..\.venv-ingestion\Scripts\python.exe -m pip install -r requirements-ingestion.txt
..\..\.venv-ingestion\Scripts\python.exe -m pip install pytest==8.3.4
..\..\.venv-ingestion\Scripts\python.exe -m app.ocr_artifacts
..\..\.venv-ingestion\Scripts\python.exe -m app.prefetch_knowledge_models
Pop-Location
$env:HF_HUB_OFFLINE='1'
$env:TRANSFORMERS_OFFLINE='1'
```

The language directory is also assigned to `TESSDATA_PREFIX` by the checked
runtime because Docling's initial language probe uses `--list-langs` without its
configured data-directory argument. Keep a single fixed OCR configuration per
worker process. Changes to engine/models/thresholds require another pipeline
identity; swapping models in place fails checksum verification.

One worker converts one document at a time. The raster audit renders one page at
216 dpi at a time; Docling retains parsed OCR cells for validation. A4 RGB raster
buffers use roughly 14 MB each before OpenCV masks and conversion/model memory.
CPU time grows with page count and OCR regions. The independent audit adds one
recognition pass on pages containing scanned content. Benchmark large real PDFs
against the existing ten-minute request timeout and deployment RAM/CPU before
raising concurrency. The 50 MiB upload limit and 1,000-page limit are unchanged.

## Extraction evidence and quality outcomes

1. Docling uses native PDF cells first and OCRs missing text/table layout regions
   with overlap filtering. `KnowledgePdfPipeline` selects the pinned Tesseract
   adapter with picture clusters excluded and records its exact OCR rectangles.
   Detected captions/headings inside pictures remain eligible; generic prose
   detections inside photographs/artwork on native pages are excluded. Native text coverage checks
   prevent a colored background from forcing lossy OCR of readable PDF text.
   Photographs/illustrations are not recognized as prose. An image-only page
   detected entirely as a picture retains OCR when there are no native cells or
   other text regions. Native labels nested
   in figures are retained by the chunk serializer. Broken native text layers
   are explicitly replaced by full-page OCR.
   Docling retains native font decoding; a backend with owned PDFium resources
   renders source-aligned images for both OCR and the independent audit, avoiding
   the threaded native renderer's retained image buffer. Small crops retain a
   one-point source margin and white recognition padding with coordinates mapped
   back to the original page. English uses `eng`; Vietnamese uses `vie+eng`.
   Colored/reversed labels receive contrast normalization; ordinary white-paper
   scans retain their anti-aliasing. Source reading order, item references, bounding boxes and page numbers stay
   within Docling's structured document.
   In Docling 2.148, conversion pages and page confidence keys are one-based.
   Python lists and PDFium page access are zero-based; convert indices only at
   those boundaries. PDFium 5.14 page objects require explicit `close()` rather
   than a context manager.
2. Reliable native pages retain the independent pypdf check. Missing critical
   lines or numerical values/units block activation. Ordinary native-text loss
   above 2% remains blocking. Meaningful publication headers and otherwise lost
   consecutive headings are retained as sourced chunks. Physical page counters
   can be accounted for separately. Values in body text, emergency contacts and quantities are
   not exempt. Number/unit spacing is normalized without changing values,
   units or their pairing. Vietnamese font-run spaces can align only where the
   complete ordered glyph sequence and numerical signatures are present in the
   output; spelling, accents, signs and values are not repaired or guessed.
   Native mismatches are recorded per page too.
3. Raster/OCR regions receive a separate cropped-raster TSV recognition pass.
   Native pages without OCR regions/cells do not get a whole-page OCR audit
   merely because they contain pictures. A selected region that yields no cells
   still requires audit. Empty crops cannot establish that an original page is
   blank. Without usable native/region evidence, full-raster validation remains
   required. Individual
   OCR word confidence must be at least 0.75, combined mean at least 0.90, and
   numbers, units and words on identified critical lines at least 0.90. Nonfinite confidence
   is blocking. Audit words must survive into page-associated chunk content and
   heading context. Page-local structured items must preserve Docling OCR cells;
   normal item-reference checks preserve those items during chunking.
4. Rendered ink outside recognized text boxes is checked inside the OCR input
   region. Table rules are removed only when an extracted table exists.
   Significant unexplained marks block the region. This pipeline ingests text:
   pictures on pages whose native/OCR text passes validation do not block textual
   chunks, and their pixels are not interpreted as safety instructions. Unverified
   formulas remain blocking. A page is blank only when the rendered raster is essentially white and
   neither recognition nor native extraction claims text.
   Tesseract OSD can fail on small regions with too few characters to detect
   orientation. With the configured fixed `vie`/`eng` languages, Docling continues
   OCR for that region in its original orientation. The warning does not itself
   validate or discard the page; normal confidence/coverage gates still apply.
5. A source table of contents or blank form serializes literal cells without
   invented numeric column names. An adjacent-page continuation can repeat real
   headers only when page-edge position, horizontal column geometry and absence
   of an intervening section agree. Missing illustration columns can be restored
   as empty columns only where the original textual header/data geometry proves
   that mapping. Continuation chunks cite the actual header's earlier source
   page without moving their data before intervening content. Unknown headerless
   numeric tables remain blocked. Empty grids additionally require raster proof
   of rules without unread text.
   Raster table grids are removed only from recognition inputs, leaving the
   structured source geometry unchanged. Sparse text segmentation reads their
   cells and units; the audit still checks the original raster, including rules.
6. Existing ordered-procedure/context, provenance and 480-token
   embedding-input gates still apply. Original provenance is validated before
   serializers can clamp invalid coordinates. Only a complete `PASSED` result
   can proceed to embedding and atomic READY publication.
   A low layout score on a blank page is exempt only after the original raster
   proves it blank and neither extraction path claims content. Ordered-list
   markers remain part of page-local source evidence when Docling separates
   them from the list item's text. Overlapping OCR detections are merged before
   recognition to avoid inconsistent duplicate fragments.

The second pass uses the same recognition engine with different region/page
segmentation. Its errors can be correlated with the first pass. Confidence and
raster coverage are conservative technical evidence, not proof of perfect OCR or
clinical correctness. Complex layouts, faint scans, diagrams, handwriting or
uncertain critical values can remain `NEEDS_REVIEW`. This state exposes an
automatic extraction failure; there is no added Admin/chunk approval workflow.

Unexpected server errors retain their sanitized HTTP response. Server logs record
the exception class and code-frame locations without exception messages, source
text, request bodies, vectors or tokens. This makes an internal `IndexError` or
similar failure distinguishable from OSD warnings without exposing PDF content.

Admin-confirmed uploaded PDFs are already approved at source/content level.
An absent legacy specialist status no longer blocks such uploads. An explicit
medical rejection, restricted usage status, translation/distribution restrictions
and source/version checks remain enforced. Internal derived-document editing
retains its separately authorized composition rules.

## Reprocessing and deployment

Deploy the Python ingestion image and API with matching v4 contracts. Build:

```powershell
docker build -f infra/docker/ingestion.Dockerfile -t ctms-ingestion-ocr .
```

The existing reconciliation worker queues each eligible current published
version lacking `(document_version_id, v4_config_hash)`. It reads the original
private PDF already stored by CTMS-050. No source migration, checksum rewrite or
re-upload is required. Historical v1/v2/v3 sets and quality reports remain intact. A replay or concurrent
reconciliation cannot create a second set for the same version/configuration.

The active publication pointer switches only after a complete READY transaction.
Replacement, archival, deletion, lease/retry and late-completion fencing retain
their existing behavior. Embedding reuse still requires exact input and matching
configuration hash within the same document; v1/v2/v3 vectors are not assumed
compatible with v4. Reuse remains available across versions processed under v4.

### API talking to an older ingestion container

The authenticated `/readiness` endpoint advertises `X-CTMS-Pipeline-Version`.
The worker checks it before claiming pending work, so an unavailable or older
service does not consume attempts during deployment or downtime.
Automatic failure recovery requires this header to match the API's current
pipeline; a healthy HTTP listener alone is insufficient. A FastAPI literal
validation error under `configuration` is classified as retryable
`ingestion_configuration_mismatch` rather than a permanent bad-PDF error.

The initial v2 rollout could record these requests as permanent
`ingestion_http_422`. Empty v2 failures with no quality report are eligible for
the existing capped recovery rounds after a matching service is available.
Quality-review results and completed chunks are not reset. Source version,
stored PDF and checksum remain unchanged. This is a bounded compatibility retry;
another validation error still cannot activate content and recovery stops at the
existing cap.

For the local Compose deployment, rebuild the ingestion container rather than
only restarting an old image:

```powershell
cd D:\Capstone\CTMS
docker compose up -d --build --no-deps ingestion
docker compose logs --tail 100 ingestion
```

Run the updated API as well (`pnpm dev:api:local` for a local watcher, or
`docker compose up -d --build --no-deps api` for its Compose container). Within
the normal recovery polling interval, the worker can retry affected current
versions using their stored PDFs. Model downloads happen during the image build.
Confirm `/openapi.json`'s `IngestionConfiguration.pipeline_version` is
`ctms-hybrid-ocr-v4` when diagnosing an old service at localhost:8001.

## Tests and fixture scope

`app/fixtures/ocr` contains synthetic, committed PDFs. `test_ocr_fixtures.py`
checks that the scans really have no native text. The mixed fixtures contain
native text plus scanned pages or a scanned region on the same page. The fixture
generator uses rasterized typography; the original external documents are not
used or redistributed.

| Coverage | Test |
| --- | --- |
| Native text, multilingual encoder, token budget and deterministic chunks | `test_knowledge_smoke.py`, `test_knowledge_chunking.py` |
| Vietnamese/English image-only PDFs, warnings, tables, multiple pages and blank page evidence | `test_docling_ocr_stage.py` uses the actual Docling Tesseract adapter and actual image-only PDFs |
| Full native/scanned/mixed Docling conversion, headings, lists, table values, locations, deterministic chunks and embeddings | `test_knowledge_ocr_integration.py` plus native smoke |
| Low confidence, missing critical words/numbers/units, unexplained diagrams, invalid locations | `test_knowledge_ocr.py`, `test_knowledge_chunking.py` |
| One-based Docling confidence, first/last replaced text layers, page-local OCR cells and PDFium resource handling | `test_knowledge_page_numbers.py` |
| Native illustrated pages, text-region selection/crops, missing OCR regions, page furniture, figure labels and number/unit preservation | `test_knowledge_native_pages.py` |
| Literal contents/forms, source-backed table continuations, rejected ambiguous grids and actual header provenance | `test_knowledge_tables.py` |
| Native font decoding and exact original PDFium raster/crop identity without native-renderer buffers | `test_knowledge_pdf_backend.py` |
| Exact version and new configuration reprocessing, atomic failure, leases, cache reuse/miss, replacement, archival, deletion | `knowledge-chunks.integration-spec.ts` and existing provider/policy tests |
| Admin confirmation and explicit source rejection | `source-policy.spec.ts`, `survival-documents.integration-spec.ts` |
| Version contract mismatch and retryable OCR runtime error | Python API and Nest provider/policy tests |
| READY, extraction failure messages, existing document workflows, no additional approval button | `SourceChunkingStatus.test.tsx`, `SurvivalDocumentsPage.test.tsx` |

Run the real OCR suites with provisioned artifacts. An opted-in test fails when
dependencies are missing; it does not convert that failure into a skipped test.
The full OCR test disables Python socket connections. CI additionally runs the
entire regression in a container with `--network none`.

```powershell
Push-Location services/ai
$env:RUN_KNOWLEDGE_OCR_INTEGRATION='true'
$env:RUN_KNOWLEDGE_MODEL_SMOKE='true'
..\..\.venv-ingestion\Scripts\python.exe -B -m pytest -q -p no:cacheprovider app/test_knowledge_api.py app/test_knowledge_chunking.py app/test_knowledge_native_pages.py app/test_knowledge_tables.py app/test_knowledge_pdf_backend.py app/test_knowledge_page_numbers.py app/test_knowledge_ocr.py app/test_ocr_fixtures.py app/test_docling_ocr_stage.py app/test_knowledge_ocr_integration.py app/test_knowledge_smoke.py app/test_knowledge_recall.py app/test_rag_knowledge_api.py app/test_document_editor.py
Pop-Location
```

For PostgreSQL lifecycle regression, start the isolated test service and set the
test database URL in the same terminal:

```powershell
docker compose -f docker-compose.test.yml up -d --wait postgres
$env:TEST_DATABASE_URL='postgresql://ctms:ctms@127.0.0.1:55451/ctms_test'
Push-Location services/api
.\node_modules\.bin\jest.cmd --config test/jest-integration.json --runInBand --runTestsByPath test/knowledge-chunks.integration-spec.ts test/survival-documents.integration-spec.ts
Pop-Location
```

See [OCR validation results](CTMS-051-OCR-Validation.md) for executed commands,
observed results and checks still blocked in the implementation environment.
