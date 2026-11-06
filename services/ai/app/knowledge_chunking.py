"""Structure-aware, deterministic chunk preparation and conservative quality gates."""

import re
import math
import unicodedata
from collections import Counter, defaultdict
from typing import TYPE_CHECKING, Protocol

from app.knowledge_models import MAX_CHUNKS, PreparedChunk, SourceLocation

if TYPE_CHECKING:
    from docling_core.transforms.chunker.hybrid_chunker import HybridChunker
    from docling_core.types.doc import DoclingDocument

CRITICAL = re.compile(r"warning|caution|danger|must|only if|unless|do not|contraindicat|"
                      r"cảnh báo|chú ý|lưu ý|nguy hiểm|điều kiện|không được|chống chỉ định|"
                      r"chỉ áp dụng|áp dụng khi|không áp dụng|bắt buộc|phải", re.I)
NON_BODY_LABELS = {"page_header", "page_footer", "section_header", "title"}
MIN_TEXT_CONFIDENCE = 0.8
MIN_LAYOUT_CONFIDENCE = 0.5


def low_extraction_confidence(parse_score: float, layout_score: float, table_score: float) -> bool:
    # Layout scores classify regions, not text coverage. Reject Docling's POOR grade;
    # FAIR layouts still must pass the independent text, table and procedure gates.
    return any(math.isfinite(score) and score < minimum for score, minimum in
               [(parse_score, MIN_TEXT_CONFIDENCE), (layout_score, MIN_LAYOUT_CONFIDENCE),
                (table_score, MIN_TEXT_CONFIDENCE)])


class TextTokenizer(Protocol):
    def encode(self, text: str, *, add_special_tokens: bool = True) -> list[int]: ...


def words(text: str) -> list[str]:
    return re.findall(r"\w+", unicodedata.normalize("NFKC", text).casefold())


def contains_words(source: str, output: str) -> bool:
    """Multiset comparison tolerates table serialization and whitespace, not missing words."""
    return not (Counter(words(source)) - Counter(words(output)))


def split_document(document: "DoclingDocument", chunker: "HybridChunker", tokenizer: TextTokenizer,
                   title: str, page_count: int, max_tokens: int = 480) -> tuple[list[PreparedChunk], list[str]]:
    chunks = list(chunker.chunk(dl_doc=document))
    issues: set[str] = set()
    if not chunks or len(chunks) > MAX_CHUNKS:
        return [], ["empty_or_excessive_chunks"]

    prepared: list[PreparedChunk] = []
    item_outputs: dict[str, list[str]] = defaultdict(list)
    item_chunk_indices: dict[str, list[int]] = defaultdict(list)
    section_indices: dict[tuple[str, ...], set[int]] = defaultdict(set)
    critical_sections: set[tuple[str, ...]] = set()
    procedure_sections: set[tuple[str, ...]] = set()
    for index, chunk in enumerate(chunks):
        context = chunker.contextualize(chunk=chunk)
        embedding_text = f"passage: {title}\n{context}"
        count = len(tokenizer.encode(embedding_text, add_special_tokens=True))
        if count > max_tokens or not chunk.text.strip():
            issues.add("token_budget_or_empty_chunk")
        locations: list[SourceLocation] = []
        section = tuple(chunk.meta.headings or [])
        section_indices[section].add(index)
        if CRITICAL.search(chunk.text):
            critical_sections.add(section)
        for item in chunk.meta.doc_items:
            if str(item.label.value) == "list_item" and getattr(item, "enumerated", False):
                procedure_sections.add(section)
            item_outputs[item.self_ref].append(chunk.text)
            item_chunk_indices[item.self_ref].append(index)
            for provenance in item.prov:
                if not 1 <= provenance.page_no <= page_count:
                    issues.add("invalid_source_page")
                locations.append(SourceLocation(page=provenance.page_no, item_ref=item.self_ref,
                                                bbox=provenance.bbox.model_dump()))
        if not locations:
            issues.add("missing_source_location")
        prepared.append(PreparedChunk(chunk_index=index, content=chunk.text, embedding_text=embedding_text,
                                      token_count=count, headings=chunk.meta.headings or [], locations=locations))

    # Check every extracted body item independently: repeated words in another section cannot hide omissions.
    procedures: dict[str, list[str]] = defaultdict(list)
    for item, _level in document.iterate_items():
        label = str(item.label.value)
        if label in NON_BODY_LABELS:
            continue
        output = "\n".join(item_outputs.get(item.self_ref, []))
        text = getattr(item, "text", "")
        if label == "table":
            text = " ".join(cell.text for cell in item.data.table_cells)
            if not item.data.table_cells or not any(cell.column_header for cell in item.data.table_cells):
                issues.add("table_header_unverified")
        if text and not contains_words(text, output):
            issues.add("missing_extracted_content")
            if CRITICAL.search(text):
                issues.add("missing_critical_content")
        if label in {"picture", "formula"}:
            # Text coverage cannot establish that a diagram or formula preserves safety information.
            issues.add("visual_content_requires_review")
        if label == "list_item" and getattr(item, "enumerated", False):
            parent = item.parent.cref if item.parent else item.self_ref
            procedures[parent].append(item.self_ref)

    # Do not silently fragment ordered procedures across chunks. Large procedures require review.
    for refs in procedures.values():
        indices = {index for ref in refs for index in item_chunk_indices.get(ref, [])}
        if len(indices) > 1:
            issues.add("procedure_split_requires_review")
    for section in critical_sections & procedure_sections:
        if len(section_indices[section]) > 1:
            issues.add("procedure_context_split_requires_review")
    return prepared, sorted(issues)


def compare_pdf_text(native_pages: list[str], prepared: list[PreparedChunk]) -> list[str]:
    """Independent extraction cross-check, scoped to original page locations."""
    issues: set[str] = set()
    for page, native in enumerate(native_pages, start=1):
        output = "\n".join(chunk.embedding_text for chunk in prepared
                           if any(location.page == page for location in chunk.locations))
        if not native.strip():
            # OCR-only/blank pages have no independent text evidence. Fail closed for survival content.
            issues.add("page_text_unverifiable")
            continue
        # Page numbers and headers can differ. Any missing safety-bearing line is always blocking.
        for line in native.splitlines():
            if CRITICAL.search(line) and not contains_words(line, output):
                issues.add("missing_critical_pdf_text")
        native_words = Counter(words(native))
        missing = sum((native_words - Counter(words(output))).values())
        if missing / max(1, sum(native_words.values())) > 0.02:
            issues.add("pdf_text_coverage_incomplete")
    return sorted(issues)
