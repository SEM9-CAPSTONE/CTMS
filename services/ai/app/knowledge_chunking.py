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
UNITS = {"mg", "g", "kg", "ml", "l", "mm", "cm", "m", "km", "seconds", "minutes", "giây", "phút",
         "yd", "yds", "yard", "yards", "ft", "feet"}
UNIT_PATTERN = "(?:" + "|".join(sorted(UNITS, key=len, reverse=True)) + ")"
NUMBERS = r"\d+(?:[.,]\d+)*"
SIGNED_NUMBERS = r"(?<!\w)[+\-−]?\d+(?:[.,]\d+)*"
QUANTITIES = re.compile(r"(" + NUMBERS + r")\s*(" + UNIT_PATTERN + r")\b", re.I)
METADATA_LINE = re.compile(
    r"(?:(?:page|trang)\s+\d+(?:\s*(?:of|/)\s*\d+)?|"
    r"(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|"
    r"Form\s+\d+(?:[-/]\d+)*(?:\s*\(Rev[.\s]*\d+(?:[/.-]\d+)*\))?)", re.I,
)


def low_extraction_confidence(parse_score: float, layout_score: float, table_score: float) -> bool:
    # Layout scores classify regions, not text coverage. Reject Docling's POOR grade;
    # FAIR layouts still must pass the independent text, table and procedure gates.
    return any(math.isfinite(score) and score < minimum for score, minimum in
               [(parse_score, MIN_TEXT_CONFIDENCE), (layout_score, MIN_LAYOUT_CONFIDENCE),
                (table_score, MIN_TEXT_CONFIDENCE)])


class TextTokenizer(Protocol):
    def encode(self, text: str, *, add_special_tokens: bool = True) -> list[int]: ...


def words(text: str) -> list[str]:
    normalized = unicodedata.normalize("NFKC", text).casefold()
    # A source quantity can be serialized as either "250ml" or "250 ml".
    normalized = QUANTITIES.sub(lambda match: match[1] + " " + match[2], normalized)
    return re.findall(r"[^\W_]+", normalized)


def matching_glyph_span(source: str, output: str) -> str | None:
    """Match the same ordered glyphs despite PDF font-run spacing/Markdown.

    This is not spell correction: letters/accents must match exactly in order.
    Number spellings/signs and number/unit pairings must also remain unchanged.
    """
    source = unicodedata.normalize("NFKC", source).casefold()
    output = unicodedata.normalize("NFKC", output).casefold()
    key = "".join(re.findall(r"[^\W_]+", source))
    if not key:
        return None
    positions = [index for index, char in enumerate(output) if char.isalnum()]
    compact = "".join(output[index] for index in positions)
    start = compact.find(key)
    while start >= 0:
        span = output[positions[start]:positions[start + len(key) - 1] + 1]
        quantities = lambda value: Counter((number, unit.casefold()) for number, unit in QUANTITIES.findall(value))
        if (Counter(re.findall(SIGNED_NUMBERS, source)) == Counter(re.findall(SIGNED_NUMBERS, span))
                and quantities(source) == quantities(span)):
            return span
        start = compact.find(key, start + 1)
    return None


def contains_words(source: str, output: str) -> bool:
    """Multiset comparison tolerates table serialization and whitespace, not missing words."""
    return not (Counter(words(source)) - Counter(words(output))) or matching_glyph_span(source, output) is not None


def invalid_bbox(box, page) -> bool:
    if not page or not all(math.isfinite(v) and v >= 0 for v in (box.l, box.t, box.r, box.b)):
        return True
    return (box.r <= box.l or
            (box.t >= box.b if box.coord_origin.value == "TOPLEFT" else box.t <= box.b) or
            max(box.l, box.r) > page.size.width or max(box.t, box.b) > page.size.height)


def split_document(document: "DoclingDocument", chunker: "HybridChunker", tokenizer: TextTokenizer,
                   title: str, page_count: int, max_tokens: int = 480, *, check_visuals: bool = True,
                   header_sources=None, literal_tables=frozenset(), scope_refs=None) -> tuple[list[PreparedChunk], list[str]]:
    issues: set[str] = set()
    # Inspect original provenance before serializers can clamp/normalize boxes.
    for item, _ in document.iterate_items(traverse_pictures=True):
        if getattr(item, "text", "") or item.label.value in {"table", "document_index"}:
            if not item.prov:
                issues.add("missing_source_location")
            for p in item.prov:
                if not 1 <= p.page_no <= page_count:
                    issues.add("invalid_source_page")
                if invalid_bbox(p.bbox, document.pages.get(p.page_no)):
                    issues.add("invalid_source_bbox")
    chunks = list(chunker.chunk(dl_doc=document))
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
                    continue
                if invalid_bbox(provenance.bbox, document.pages.get(provenance.page_no)):
                    issues.add("invalid_source_bbox")
                locations.append(SourceLocation(page=provenance.page_no, item_ref=item.self_ref,
                                                bbox=provenance.bbox.model_dump()))
            inherited = (header_sources or {}).get(item.self_ref)
            if inherited is not None:
                for provenance in inherited.prov:
                    if 1 <= provenance.page_no <= page_count:
                        locations.append(SourceLocation(page=provenance.page_no, item_ref=inherited.self_ref,
                                                        bbox=provenance.bbox.model_dump()))
        if not locations:
            issues.add("missing_source_location")
        prepared.append(PreparedChunk(chunk_index=index, content=chunk.text, embedding_text=embedding_text,
                                      token_count=count, headings=chunk.meta.headings or [], locations=locations))

    # Check every extracted body item independently: repeated words in another section cannot hide omissions.
    procedures: dict[str, list[str]] = defaultdict(list)
    for item, _level in document.iterate_items(traverse_pictures=True):
        label = str(item.label.value)
        if label in NON_BODY_LABELS:
            continue
        output = "\n".join(item_outputs.get(item.self_ref, []))
        text = getattr(item, "text", "")
        if label in {"table", "document_index"}:
            text = " ".join(cell.text for cell in item.data.table_cells)
            if (item.self_ref not in literal_tables and
                    (not item.data.table_cells or not any(cell.column_header for cell in item.data.table_cells))):
                issues.add("table_header_unverified")
        if text and not contains_words(text, output):
            issues.add("missing_extracted_content")
            if CRITICAL.search(text):
                issues.add("missing_critical_content")
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
    # Docling may assign sibling levels to consecutive headings. HybridChunker
    # then overwrites the first heading before emitting any body chunk. Retain
    # those original labels, including publication headers, as sourced text.
    from docling_core.types.doc import ContentLayer
    source_order = {item.self_ref: index for index, (item, _) in enumerate(
        document.iterate_items(traverse_pictures=True, included_content_layers=set(ContentLayer)))}
    chunk_order = {id(prepared[index]): min((source_order.get(item.self_ref, len(source_order))
                                            for item in chunk.meta.doc_items), default=len(source_order))
                   for index, chunk in enumerate(chunks)}
    for item in document.texts:
        if scope_refs is not None and item.self_ref not in scope_refs:
            continue
        if item.label.value not in NON_BODY_LABELS or not item.text.strip():
            continue
        if item.label.value in {"page_header", "page_footer"} and any(
            item.text.strip() == str(p.page_no) for p in item.prov
        ):
            continue
        # A phrase repeated in body text does not stand in for its source title.
        # Only its own serialized item or an actual retained heading counts.
        normalize = lambda value: " ".join(unicodedata.normalize("NFKC", value).casefold().split())
        represented = any(
            any(part.self_ref == item.self_ref for part in chunk.meta.doc_items) or
            (item.label.value in {"section_header", "title"} and
             normalize(item.text) in [normalize(value) for value in chunk.meta.headings or []] and
             any(p.page_no == loc.page for p in item.prov for loc in prepared[index].locations))
            for index, chunk in enumerate(chunks)
        )
        if represented:
            continue
        locations = [SourceLocation(page=p.page_no, item_ref=item.self_ref, bbox=p.bbox.model_dump())
                     for p in item.prov if 1 <= p.page_no <= page_count]
        if not locations:
            issues.add("missing_source_location")
            continue
        if any(invalid_bbox(p.bbox, document.pages.get(p.page_no)) for p in item.prov):
            issues.add("invalid_source_bbox")
        embedding_text = f"passage: {title}\n{item.text}"
        count = len(tokenizer.encode(embedding_text, add_special_tokens=True))
        if count > max_tokens:
            issues.add("token_budget_or_empty_chunk")
        if item.label.value in {"section_header", "title"} and CRITICAL.search(item.text) and procedure_sections:
            issues.add("procedure_context_split_requires_review")
        label_chunk = PreparedChunk(chunk_index=0, content=item.text, embedding_text=embedding_text,
                                    token_count=count, headings=[], locations=locations)
        prepared.append(label_chunk)
        chunk_order[id(label_chunk)] = source_order.get(item.self_ref, len(source_order))
    # Inherited header citations belong to the earlier page; they must not move
    # continuation data ahead of the actual intervening source content.
    prepared.sort(key=lambda chunk: chunk_order[id(chunk)])
    for index, chunk in enumerate(prepared):
        chunk.chunk_index = index
    if len(prepared) > MAX_CHUNKS:
        issues.add("empty_or_excessive_chunks")
    if check_visuals:
        issues.update(visual_content_issues(document))
    return prepared, sorted(issues)


def visual_content_issues(document, verified_scan_pages=frozenset(), *, text_pages=frozenset()) -> list[str]:
    for item, _ in document.iterate_items(traverse_pictures=True):
        if item.label.value not in {"picture", "formula"}:
            continue
        # This pipeline retrieves source text, including figure captions/labels,
        # not a generated interpretation of photographs or illustrations. Text
        # on these pages still passes native and/or region OCR checks separately.
        if item.label.value == "picture" and item.prov and all(p.page_no in text_pages for p in item.prov):
            continue
        # Only a verified, full-page raster is a scan background. Smaller pictures,
        # actual figures and formulas keep their existing conservative gate.
        if item.label.value == "picture" and item.prov and all(
            p.page_no in verified_scan_pages and
            abs((p.bbox.r - p.bbox.l) * (p.bbox.t - p.bbox.b)) >=
            document.pages[p.page_no].size.width * document.pages[p.page_no].size.height * 0.90
            for p in item.prov
        ):
            continue
        return ["visual_content_requires_review"]
    return []


def page_metadata(document, page: int) -> str:
    """Only independently extracted, identified page furniture is non-body text.

    Do not exempt dates/form numbers occurring in body text, or a footer that
    contains a warning, quantity or emergency contact number.
    """
    if document is None:
        return ""
    parts = []
    for item in document.texts:
        if item.label.value not in {"page_header", "page_footer"}:
            continue
        if not any(p.page_no == page for p in item.prov):
            continue
        value = " ".join(unicodedata.normalize("NFKC", item.text).split())
        if METADATA_LINE.fullmatch(value) or value == str(page):
            parts.append(value)
    return "\n".join(parts)


def compare_pdf_text(native_pages: list[str], prepared: list[PreparedChunk], page_reports=(), *, document=None) -> list[str]:
    """Independent extraction cross-check, scoped to original page locations."""
    issues: set[str] = set()
    for page, native in enumerate(native_pages, start=1):
        page_issues = set()
        output = "\n".join("\n".join([*chunk.headings, chunk.content]) for chunk in prepared
                           if any(location.page == page for location in chunk.locations))
        # HybridChunker deliberately excludes page furniture. Compare the
        # narrowly identified metadata too, without adding it to retrieval text.
        output += "\n" + page_metadata(document, page)
        native = unicodedata.normalize("NFKC", native)
        output = unicodedata.normalize("NFKC", output)
        if not native.strip():
            evidence = next((report for report in page_reports if report.page == page), None)
            if not evidence or evidence.mode == "unverified":
                page_issues.add("page_text_unverifiable")
            issues.update(page_issues)
            continue
        # PDF extractors can insert spaces within Vietnamese font runs ("s ự"
        # vs "sự"). Align only source lines whose complete glyph sequence and
        # numerical signatures are independently present in the chunk output.
        native = "\n".join(matching_glyph_span(line, output) or line for line in native.splitlines())
        # Page numbers and headers can differ. Any missing safety-bearing line is always blocking.
        for line in native.splitlines():
            if CRITICAL.search(line) and not contains_words(line, output):
                page_issues.add("missing_critical_pdf_text")
            if re.search(r"\d", line):
                if (Counter(re.findall(NUMBERS, line)) - Counter(re.findall(NUMBERS, output)) or
                        Counter(w for w in words(line) if w in UNITS) - Counter(words(output)) or
                        Counter((value, unit.casefold()) for value, unit in QUANTITIES.findall(line)) -
                        Counter((value, unit.casefold()) for value, unit in QUANTITIES.findall(output))):
                    page_issues.add("missing_numeric_pdf_text")
        native_words = Counter(words(native))
        if (Counter(re.findall(SIGNED_NUMBERS, native)) - Counter(re.findall(SIGNED_NUMBERS, output)) or
                Counter((value, unit.casefold()) for value, unit in QUANTITIES.findall(native)) -
                Counter((value, unit.casefold()) for value, unit in QUANTITIES.findall(output))):
            page_issues.add("missing_numeric_pdf_text")
        missing = sum((native_words - Counter(words(output))).values())
        if missing / max(1, sum(native_words.values())) > 0.02:
            page_issues.add("pdf_text_coverage_incomplete")
        evidence = next((report for report in page_reports if report.page == page), None)
        if evidence is not None:
            evidence.issues = sorted(set(evidence.issues) | page_issues)
        issues.update(page_issues)
    if document is not None:
        # A merged chunk can cite two pages. Text on the second page must not
        # conceal an omission on the first, even when common words repeat.
        from types import SimpleNamespace
        items = {item.self_ref: item for item, _ in document.iterate_items(traverse_pictures=True)}
        items.update({item.self_ref: item for item in document.texts})
        structured = []
        for item in items.values():
            value = (" ".join(cell.text for cell in item.data.table_cells) if item.label.value in {"table", "document_index"} else
                     " ".join([getattr(item, "marker", ""), getattr(item, "text", "")]))
            for provenance in item.prov:
                structured.append(SimpleNamespace(content=value, headings=[], locations=[SimpleNamespace(page=provenance.page_no)]))
        issues.update(compare_pdf_text(native_pages, structured, page_reports))
    return sorted(issues)
