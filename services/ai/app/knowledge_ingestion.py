"""Docling parsing + HybridChunker + a pinned local multilingual embedding model."""

import base64
import hashlib
import math
from io import BytesIO
from threading import Lock

from app.knowledge_chunking import compare_pdf_text, low_extraction_confidence, split_document
from app.knowledge_models import (
    EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, EMBEDDING_REVISION, MAX_EMBEDDING_TOKENS,
    MAX_PAGES, MAX_PDF_BYTES, EmbeddedChunk,
    IngestionRequest, IngestionResponse, QualityReport,
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
        self._model = None
        self._converter = None

    def _load_model(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(EMBEDDING_MODEL, revision=EMBEDDING_REVISION, device="cpu",
                                               trust_remote_code=False)
    def _load(self):
        self._load_model()
        if self._converter is None:
            from docling.datamodel.base_models import InputFormat
            from docling.datamodel.pipeline_options import LayoutObjectDetectionOptions, PdfPipelineOptions
            from docling.document_converter import DocumentConverter, PdfFormatOption
            layout = LayoutObjectDetectionOptions()
            layout.model_spec = layout.model_spec.model_copy(update={"revision": "8f39ad3c0b4c58e9c2d2c84a38465abf757272d8"})
            options = PdfPipelineOptions(do_ocr=False, do_table_structure=True, layout_options=layout)
            self._converter = DocumentConverter(format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=options)})

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

    def generate(self, request: IngestionRequest) -> IngestionResponse:
        try:
            pdf = base64.b64decode(request.pdf_base64, validate=True)
        except ValueError as error:
            raise InvalidPdf("invalid_pdf_encoding") from error
        if not pdf.startswith(b"%PDF-") or len(pdf) > MAX_PDF_BYTES or hashlib.sha256(pdf).hexdigest() != request.checksum:
            raise InvalidPdf("pdf_checksum_or_format_mismatch")
        from pypdf import PdfReader
        try:
            source = PdfReader(BytesIO(pdf), strict=True)
            if source.is_encrypted or not 0 < len(source.pages) <= MAX_PAGES:
                raise InvalidPdf("unsupported_pdf")
            native_pages = [page.extract_text() or "" for page in source.pages]
        except Exception as error:
            raise InvalidPdf("unreadable_pdf") from error

        with self._lock:
            self._load()
            from docling.datamodel.base_models import DocumentStream
            from docling_core.transforms.chunker.hybrid_chunker import HybridChunker
            from docling_core.transforms.chunker.tokenizer.huggingface import HuggingFaceTokenizer
            from app.knowledge_serializer import TablePreservingSerializerProvider
            conversion = self._converter.convert(DocumentStream(name="source.pdf", stream=BytesIO(pdf)), raises_on_error=False)
            issues = []
            if str(conversion.status.value) != "success" or conversion.errors:
                issues.append("pdf_conversion_incomplete")
            if len(conversion.document.pages) != len(native_pages):
                issues.append("pdf_page_count_mismatch")
            for scores in conversion.confidence.pages.values():
                # OCR is intentionally disabled. Layout, parse and available table confidence remain gating.
                if low_extraction_confidence(scores.parse_score, scores.layout_score, scores.table_score):
                    issues.append("low_extraction_confidence")
            # Budget includes the title, E5 prefix and tokenizer special tokens. Never silently truncate input.
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
                                                       request.title, len(native_pages), request.configuration.max_tokens)
                issues.extend(chunk_issues)
                issues.extend(compare_pdf_text(native_pages, prepared))
            vectors = []
            if not issues:
                vectors = self._model.encode([chunk.embedding_text for chunk in prepared], batch_size=16,
                                              normalize_embeddings=True, show_progress_bar=False).tolist()
                validate_embeddings(vectors, len(prepared), request.configuration.embedding_dimensions)
            return IngestionResponse(
                **request.model_dump(exclude={"pdf_base64", "title"}),
                quality=QualityReport(status="NEEDS_REVIEW" if issues else "PASSED",
                                      issues=sorted(set(issues)), page_count=len(native_pages)),
                chunks=[] if issues else [EmbeddedChunk(**chunk.model_dump(), embedding=vector)
                                          for chunk, vector in zip(prepared, vectors, strict=True)],
            )


def validate_embeddings(vectors: list[list[float]], count: int, dimensions: int) -> None:
    if len(vectors) != count or not count:
        raise InvalidEmbedding("embedding_count_mismatch")
    for vector in vectors:
        if len(vector) != dimensions or not all(math.isfinite(value) for value in vector) or not any(vector):
            raise InvalidEmbedding("invalid_embedding")
