"""Docling parsing + HybridChunker + a pinned local multilingual embedding model."""

import base64
import hashlib
import math
import copy
import logging
import time
from io import BytesIO
from threading import Lock
from contextlib import contextmanager

from app.knowledge_chunking import compare_pdf_text, low_extraction_confidence, split_document, visual_content_issues
from app.knowledge_artifacts import LAYOUT_REVISION
from app.knowledge_ocr import check_ocr_runtime, tessdata_path, tesseract_command, validate_ocr_pages
from app.knowledge_models import (
    EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, EMBEDDING_REVISION, MAX_EMBEDDING_TOKENS,
    MAX_PAGES, MAX_PDF_BYTES, EmbeddedChunk,
    IngestionRequest, IngestionResponse, PreparedIngestionResponse, QualityReport,
)


class InvalidPdf(ValueError):
    pass


class InvalidEmbedding(ValueError):
    pass


class InvalidQuery(ValueError):
    pass


class ModelBusy(RuntimeError):
    pass


class KnowledgeIngestionService:
    """One conversion at a time per worker process bounds local model resource usage."""

    def __init__(self):
        self._lock = Lock()
        self._conversion_lock = Lock()
        self._model = None
        self._converter = None
        self._converters = {}

    @property
    def busy(self):
        return self._conversion_lock.locked() or self._lock.locked()

    @contextmanager
    def _available_lock(self, lock=None):
        lock = lock if lock is not None else self._lock
        if not lock.acquire(blocking=False):
            raise ModelBusy()
        try:
            yield
        finally:
            lock.release()

    def _load_model(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            options = dict(revision=EMBEDDING_REVISION, device="cpu", trust_remote_code=False)
            try:
                self._model = SentenceTransformer(EMBEDDING_MODEL, **options, local_files_only=True)
            except OSError:
                self._model = SentenceTransformer(EMBEDDING_MODEL, **options)
    def _load(self, locale="vi"):
        self._load_model()
        languages = ("eng",) if locale == "en" else ("vie", "eng")
        if languages not in self._converters:
            from docling.datamodel.base_models import InputFormat
            from docling.datamodel.pipeline_options import LayoutObjectDetectionOptions, PdfPipelineOptions, TesseractCliOcrOptions, OcrMode
            from docling.document_converter import DocumentConverter, PdfFormatOption
            from app.knowledge_pdf_backend import KnowledgePdfDocumentBackend
            from app.knowledge_pdf_pipeline import KnowledgePdfPipeline
            layout = LayoutObjectDetectionOptions()
            layout.model_spec = layout.model_spec.model_copy(update={"revision": LAYOUT_REVISION})
            check_ocr_runtime()
            options = PdfPipelineOptions(
                document_timeout=25 * 60,
                do_ocr=True, do_table_structure=True, layout_options=layout, generate_parsed_pages=True,
                ocr_options=TesseractCliOcrOptions(
                    lang=list(languages), tesseract_cmd=tesseract_command(), path=tessdata_path(),
                    mode=OcrMode.PDF_AWARE_LAYOUT_REGIONS, scale=3.0,
                    replace_broken_text_layer=True, psm=6,
                ),
            )
            self._converters[languages] = DocumentConverter(format_options={InputFormat.PDF: PdfFormatOption(
                pipeline_options=options, pipeline_cls=KnowledgePdfPipeline, backend=KnowledgePdfDocumentBackend,
            )})
        self._converter = self._converters[languages]

    def embed_query(self, question: str) -> list[float]:
        question = question.strip()
        if not question or "\0" in question:
            raise InvalidQuery()
        if not self._lock.acquire(blocking=False):
            raise ModelBusy()
        try:
            self._load_model()
            text = f"query: {question}"
            if len(self._model.tokenizer.encode(text, add_special_tokens=True, truncation=False)) > MAX_EMBEDDING_TOKENS:
                raise InvalidQuery()
            vectors = self._model.encode([text], normalize_embeddings=True, show_progress_bar=False).tolist()
            validate_embeddings(vectors, 1, EMBEDDING_DIMENSIONS)
            if not math.isclose(math.hypot(*vectors[0]), 1.0, abs_tol=0.001):
                raise InvalidEmbedding("invalid_query_embedding_norm")
            return vectors[0]
        finally:
            self._lock.release()

    def count_context_prefixes(self, blocks: list[str]) -> list[int]:
        if not self._lock.acquire(blocking=False):
            raise ModelBusy()
        try:
            self._load_model()
            return [
                len(self._model.tokenizer.encode(
                    "[" + ",".join(blocks[:size]) + "]", add_special_tokens=False, truncation=False,
                ))
                for size in range(1, len(blocks) + 1)
            ]
        finally:
            self._lock.release()

    def embed_passages(self, passages: list[str], dimensions: int) -> list[list[float]]:
        with self._available_lock():
            self._load_model()
            vectors = self._model.encode(passages, batch_size=16, normalize_embeddings=True,
                                         show_progress_bar=False).tolist()
            validate_embeddings(vectors, len(passages), dimensions)
            return vectors

    def generate(self, request: IngestionRequest) -> IngestionResponse:
        prepared = self.prepare(request)
        vectors = (self.embed_passages([chunk.embedding_text for chunk in prepared.chunks],
                                       request.configuration.embedding_dimensions)
                   if prepared.quality.status == "PASSED" else [])
        return IngestionResponse(
            **prepared.model_dump(exclude={"chunks"}),
            chunks=[EmbeddedChunk(**chunk.model_dump(), embedding=vector)
                    for chunk, vector in zip(prepared.chunks, vectors, strict=True)],
        )

    def prepare(self, request: IngestionRequest) -> PreparedIngestionResponse:
        result, _, _ = self._prepare(request)
        return result

    def editor_content(self, request: IngestionRequest):
        from app.document_editor import extract_sections
        result, document, native_pages = self._prepare(request)
        # Editing creates a separately reviewed PDF; it does not activate RAG.
        # Keep the existing strict editor structural/source checks while the
        # new table-interpretation gate remains mandatory for RAG eligibility.
        blocking = set(result.quality.issues) - {"table_relationships_unverified"}
        if blocking or result.quality.status != "PASSED" and not result.quality.issues:
            raise InvalidPdf("editor_extraction_unverified")
        return extract_sections(document, native_pages, request.title)

    def _prepare(self, request: IngestionRequest):
        try:
            pdf = base64.b64decode(request.pdf_base64, validate=True)
        except ValueError as error:
            raise InvalidPdf("invalid_pdf_encoding") from error
        if not pdf.startswith(b"%PDF-") or len(pdf) > MAX_PDF_BYTES or hashlib.sha256(pdf).hexdigest() != request.checksum:
            raise InvalidPdf("pdf_checksum_or_format_mismatch")
        from pypdf import PdfReader
        try:
            logging.getLogger("uvicorn.error").info("integrity_stage stage=source_open version=%s", request.document_version_id)
            source = PdfReader(BytesIO(pdf), strict=True)
            if source.is_encrypted:
                raise InvalidPdf("pdf_encrypted")
            if not source.pages:
                raise InvalidPdf("pdf_no_pages")
            if len(source.pages) > MAX_PAGES:
                raise InvalidPdf("pdf_page_limit_exceeded")
            if request.extraction_snapshot:
                native_pages = request.extraction_snapshot.get("native_pages", [])
            else:
                logging.getLogger("uvicorn.error").info("integrity_stage stage=source_text_started version=%s pages=%s", request.document_version_id, len(source.pages))
                native_pages = []
                for number, page in enumerate(source.pages, 1):
                    native_pages.append(page.extract_text() or "")
                    if number % 25 == 0 or number == len(source.pages):
                        logging.getLogger("uvicorn.error").info("integrity_stage stage=source_text_progress version=%s page=%s", request.document_version_id, number)
            if len(native_pages) != len(source.pages):
                raise InvalidPdf("integrity_snapshot_page_mismatch")
            # The raster audit determines page evidence directly. Enumerating
            # pypdf image objects adds work but supplies no validation signal.
            bitmap_pages = []
        except InvalidPdf:
            raise
        except Exception as error:
            raise InvalidPdf("pdf_text_read_failed") from error

        with self._available_lock(self._conversion_lock):
            with self._lock:
                self._load(request.locale)
            if request.extraction_snapshot:
                with self._lock:
                    return self._restore(request)
            from docling.datamodel.base_models import DocumentStream
            from docling_core.transforms.chunker.hybrid_chunker import HybridChunker
            from docling_core.transforms.chunker.tokenizer.huggingface import HuggingFaceTokenizer
            from app.knowledge_serializer import TablePreservingSerializerProvider
            started = time.monotonic()
            logging.getLogger("uvicorn.error").info("integrity_stage stage=conversion_started version=%s pages=%s", request.document_version_id, len(native_pages))
            conversion = self._converter.convert(DocumentStream(name="source.pdf", stream=BytesIO(pdf)), raises_on_error=False)
            logging.getLogger("uvicorn.error").info("integrity_stage stage=conversion_finished version=%s seconds=%.2f", request.document_version_id, time.monotonic() - started)
            from app.knowledge_tables import prepare_tables
            header_sources, literal_tables = prepare_tables(conversion.document, conversion.pages)
            reference_pages = list(native_pages)
            issues = []
            for page in conversion.pages:
                if not 1 <= page.page_no <= len(reference_pages):
                    issues.append("invalid_source_page")
                    continue
                if page._broken_text_layer:
                    # Docling has explicitly replaced an invalid native layer.
                    # That page now needs raster/OCR evidence, not garbled text.
                    reference_pages[page.page_no - 1] = ""
            if str(conversion.status.value) != "success" or conversion.errors:
                issues.append("pdf_conversion_incomplete")
            if len(conversion.document.pages) != len(native_pages):
                issues.append("pdf_page_count_mismatch")
            low_confidence_pages = set()
            for page_no, scores in conversion.confidence.pages.items():
                if not 1 <= page_no <= len(reference_pages):
                    issues.append("invalid_source_page")
                    continue
                # Parse confidence describes the native text layer, not OCR accuracy.
                parse_score = scores.parse_score if reference_pages[page_no - 1].strip() else float("nan")
                if low_extraction_confidence(parse_score, scores.layout_score, scores.table_score):
                    low_confidence_pages.add(page_no)
            # Budget includes the title, E5 prefix and tokenizer special tokens. Never silently truncate input.
            with self._lock:
                reserve = len(self._model.tokenizer.encode(f"passage: {request.title}\n", add_special_tokens=True)) + 8
                budget = request.configuration.max_tokens - reserve
                prepared = []
                if budget < 64:
                    issues.append("context_exceeds_token_budget")
                else:
                    tokenizer = HuggingFaceTokenizer(tokenizer=self._model.tokenizer, max_tokens=budget)
                    chunker = HybridChunker(tokenizer=tokenizer, merge_peers=True, repeat_table_header=True,
                                            omit_header_on_overflow=False, serializer_provider=TablePreservingSerializerProvider())
                    prepared, chunk_issues = split_document(conversion.document, chunker, self._model.tokenizer,
                                                           request.title, len(native_pages), request.configuration.max_tokens,
                                                           check_visuals=False, header_sources=header_sources,
                                                           literal_tables=literal_tables)
                    issues.extend(chunk_issues)
            page_reports, scan_backgrounds = validate_ocr_pages(pdf, conversion, reference_pages, prepared, bitmap_pages,
                                                                locale=request.locale)
            verified_blank_pages = {report.page for report in page_reports
                                    if report.mode == "blank" and not report.issues}
            if low_confidence_pages - verified_blank_pages:
                issues.append("low_extraction_confidence")
                for report in page_reports:
                    if report.page in low_confidence_pages - verified_blank_pages:
                        report.issues = sorted(set([*report.issues, "low_extraction_confidence"]))
            issues.extend(compare_pdf_text(reference_pages, prepared, page_reports, document=conversion.document))
            issues.extend(issue for page in page_reports for issue in page.issues)
            text_pages = {report.page for report in page_reports if not report.issues
                          and report.mode in {"native", "ocr", "mixed"}}
            issues.extend(visual_content_issues(conversion.document, scan_backgrounds, text_pages=text_pages))
            from app.knowledge_integrity import build_regions, integrity_summary, snapshot_for
            regions = build_regions(conversion.document, page_reports, issues, scan_backgrounds, literal_tables, reference_pages)
            unresolved = [region for region in regions if region["assessment"] != "verified"]
            issues.extend(code for region in unresolved for code in region["issues"])
            snapshot = snapshot_for(request, conversion.document, reference_pages, page_reports, prepared, regions, issues)
            snapshot["literal_tables"] = list(literal_tables)
            snapshot["header_sources"] = {ref: item.self_ref for ref, item in header_sources.items()}
            result = PreparedIngestionResponse(
                **request.model_dump(exclude={"pdf_base64", "title", "extraction_snapshot"}),
                quality=QualityReport(status="NEEDS_REVIEW" if issues else "PASSED",
                                      issues=sorted(set(issues)), page_count=len(native_pages), pages=page_reports,
                                      integrity=integrity_summary(regions, 0)),
                chunks=[] if issues else prepared,
                extraction_snapshot=snapshot,
            )
            logging.getLogger("uvicorn.error").info("integrity_stage stage=validation_finished version=%s unresolved=%s", request.document_version_id, len(unresolved))
            return result, conversion.document, native_pages

    def _restore(self, request):
        """Use the durable extraction; no PDF conversion or repeated OCR here."""
        from docling_core.types.doc import DoclingDocument
        from docling_core.transforms.chunker.hybrid_chunker import HybridChunker
        from docling_core.transforms.chunker.tokenizer.huggingface import HuggingFaceTokenizer
        from app.knowledge_serializer import TablePreservingSerializerProvider
        from app.knowledge_integrity import (
            apply_decisions, check_snapshot, comparison_pages, incremental_split, integrity_summary, make_region, validate_content,
        )
        from app.knowledge_models import PageExtractionReport
        snapshot = copy.deepcopy(request.extraction_snapshot)
        check_snapshot(request, snapshot)
        document = DoclingDocument.model_validate(snapshot["document"])
        regions = snapshot["regions"]
        applied = snapshot.setdefault("applied", {})
        decision_refs = snapshot.setdefault("decision_refs", {})
        changed = apply_decisions(document, regions, applied, decision_refs)
        logging.getLogger("uvicorn.error").info("integrity_stage stage=cached_review version=%s revision=%s changed_items=%s", request.document_version_id, snapshot["revision"], len(changed))
        reserve = len(self._model.tokenizer.encode(f"passage: {request.title}\n", add_special_tokens=True)) + 8
        tokenizer = HuggingFaceTokenizer(tokenizer=self._model.tokenizer, max_tokens=request.configuration.max_tokens - reserve)
        chunker = HybridChunker(tokenizer=tokenizer, merge_peers=True, repeat_table_header=True,
                                omit_header_on_overflow=False, serializer_provider=TablePreservingSerializerProvider())
        items = {item.self_ref: item for item, _ in document.iterate_items(traverse_pictures=True)}
        headers = {ref: items[source] for ref, source in snapshot.get("header_sources", {}).items() if source in items}
        if changed:
            prepared, chunk_issues = incremental_split(document, chunker, self._model.tokenizer, request.title,
                len(snapshot["native_pages"]), snapshot, changed, max_tokens=request.configuration.max_tokens,
                header_sources=headers, literal_tables=set(snapshot.get("literal_tables", [])))
        else:
            from app.knowledge_models import PreparedChunk
            prepared = [PreparedChunk.model_validate(chunk) for chunk in snapshot["prepared"]]
            chunk_issues = []
        # Cache/budget and complete item checks are repeated independently even
        # when only one semantic interval needed rechunking.
        issues = set(chunk_issues) | set(validate_content(document, prepared, self._model.tokenizer,
            request.configuration.max_tokens, snapshot.get("literal_tables", [])))
        issues.update(code for code in snapshot["base_issues"] if code in {
            "pdf_conversion_incomplete", "pdf_page_count_mismatch", "invalid_source_page",
            "invalid_source_bbox", "missing_source_location", "context_exceeds_token_budget"})
        reports = [PageExtractionReport.model_validate(report) for report in snapshot["reports"]]
        for report in reports:
            page_regions = [region for region in regions if region["page"] == report.page]
            covered = {code for region in page_regions for code in region["issues"]}
            pending = {code for region in page_regions if not region.get("decision") and region["assessment"] != "verified"
                       for code in region["issues"]}
            report.issues = sorted((set(report.issues) - covered) | pending)
            if report.mode == "unverified" and not report.issues and any(region.get("decision") for region in page_regions) and all(region.get("decision") or region["assessment"] == "verified" for region in page_regions):
                report.mode = "manual"
        native_issues = compare_pdf_text(comparison_pages(snapshot["native_pages"], regions), prepared, reports, document=document)
        issues.update(native_issues)
        for report in reports:
            if report.issues:
                pending = any(r["page"] == report.page and not r.get("decision") and r["assessment"] != "verified" for r in regions)
                if not pending:
                    size = document.pages[report.page].size
                    region = make_region(document, report.page, dict(l=0, t=0, r=size.width, b=size.height, coord_origin="TOPLEFT"), report.issues, kind="page")
                    if not any(r["id"] == region["id"] for r in regions):
                        regions.append(region)
            issues.update(report.issues)
        issues.update(code for region in regions if not region.get("decision") and region["assessment"] != "verified" for code in region["issues"])
        snapshot["document"] = document.model_dump(mode="json")
        snapshot["prepared"] = [chunk.model_dump() for chunk in prepared]
        snapshot["configuration"] = request.configuration.model_dump()
        summary = integrity_summary(regions, snapshot["revision"])
        summary["complete"] = summary["complete"] and not issues
        result = PreparedIngestionResponse(**request.model_dump(exclude={"pdf_base64", "title", "extraction_snapshot"}),
            quality=QualityReport(status="NEEDS_REVIEW" if issues else "PASSED", issues=sorted(issues),
                page_count=len(snapshot["native_pages"]), pages=reports, integrity=summary),
            chunks=[] if issues else prepared, extraction_snapshot=snapshot)
        return result, document, snapshot["native_pages"]


def validate_embeddings(vectors: list[list[float]], count: int, dimensions: int) -> None:
    if len(vectors) != count or not count:
        raise InvalidEmbedding("embedding_count_mismatch")
    for vector in vectors:
        if len(vector) != dimensions or not all(math.isfinite(value) for value in vector) or not any(vector):
            raise InvalidEmbedding("invalid_embedding")
