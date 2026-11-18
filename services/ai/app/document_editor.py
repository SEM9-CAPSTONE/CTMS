"""Structured source sections and deterministic Unicode PDF composition."""

import os
import unicodedata
from io import BytesIO
from pathlib import Path
from typing import Literal
from xml.sax.saxutils import escape

from pydantic import BaseModel, Field

from app.knowledge_chunking import contains_words, words
from app.knowledge_ingestion import InvalidPdf
from app.knowledge_models import MAX_PAGES, MAX_PDF_BYTES

ATTRIBUTION = "Tài liệu do CTMS biên soạn từ các nguồn đã xác minh."


class EditorItem(BaseModel):
    kind: Literal["heading", "paragraph", "list", "table"]
    text: str = Field(default="", max_length=24000)
    rows: list[list[str]] = Field(default_factory=list, max_length=200)


class EditorSection(BaseModel):
    heading: str = Field(min_length=1, max_length=300)
    items: list[EditorItem] = Field(min_length=1, max_length=400)
    pages: list[int] = Field(default_factory=list, max_length=MAX_PAGES)
    item_refs: list[str] = Field(default_factory=list, max_length=400)


class ComposeRequest(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    sections: list[EditorSection] = Field(min_length=1, max_length=200)


def item_text(item: EditorItem) -> str:
    return " ".join(cell for row in item.rows for cell in row) if item.kind == "table" else item.text


def table_item(item) -> EditorItem:
    data = item.data
    if data.num_cols > 10 or not data.num_cols or not data.num_rows or any(
        cell.row_span != 1 or cell.col_span != 1 for cell in data.table_cells
    ):
        raise InvalidPdf("editor_table_layout_unsupported")
    if not all(cell.column_header and cell.text.strip() for cell in data.grid[0]):
        raise InvalidPdf("editor_table_header_unverified")
    return EditorItem(kind="table", rows=[[cell.text for cell in row] for row in data.grid])


def extract_sections(document, native_pages: list[str], title: str) -> list[EditorSection]:
    sections = []
    content = []
    refs = []
    pages = set()
    by_page = [[] for _ in native_pages]
    heading = title
    heading_levels = [getattr(item, "level", 1) for item, _ in document.iterate_items()
                      if item.label.value == "section_header"]
    top_level = min(heading_levels, default=1)
    for item, _ in document.iterate_items():
        label = item.label.value
        if label == "table":
            block = table_item(item)
        elif label in {"title", "section_header", "paragraph", "text", "list_item", "caption", "footnote", "page_header", "page_footer"}:
            text = getattr(item, "text", "").strip()
            if not text:
                continue
            kind = "heading" if label in {"title", "section_header"} else "paragraph"
            if label == "list_item":
                kind = "list"
                marker = getattr(item, "marker", "")
                if getattr(item, "enumerated", False) and not marker:
                    raise InvalidPdf("editor_list_marker_unverified")
                if marker and not text.startswith(marker):
                    text = f"{marker} {text}"
            if label == "section_header" and item.level == top_level:
                if content:
                    sections.append(EditorSection(heading=heading, items=content, pages=sorted(pages), item_refs=refs))
                heading, content, refs, pages = text, [], [], set()
            block = EditorItem(kind=kind, text=text)
        else:
            raise InvalidPdf("editor_item_unsupported")

        if not item.prov:
            raise InvalidPdf("editor_location_unverified")
        for location in item.prov:
            page = location.page_no
            if not 1 <= page <= len(native_pages):
                raise InvalidPdf("editor_location_unverified")
            by_page[page - 1].append(item_text(block))
            pages.add(page)
        refs.append(item.self_ref)
        content.append(block)
    if content:
        sections.append(EditorSection(heading=heading, items=content, pages=sorted(pages), item_refs=refs))
    if not sections or len(sections) > 200 or any(
        not contains_words(native, "\n".join(blocks)) for native, blocks in zip(native_pages, by_page, strict=True)
    ):
        raise InvalidPdf("editor_text_coverage_unverified")
    return sections


def compose_pdf(request: ComposeRequest) -> bytes:
    from pypdf import PdfReader
    from reportlab.lib.colors import HexColor
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Table, TableStyle

    default_font = (Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts/arial.ttf" if os.name == "nt"
                    else Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
    font = TTFont("CtmsEditor", os.environ.get("SURVIVAL_EDITOR_FONT_PATH", str(default_font)))
    pdfmetrics.registerFont(font)
    expected = [request.title, ATTRIBUTION]
    body = ParagraphStyle("CTMS body", fontName=font.fontName, fontSize=10, leading=15, spaceAfter=7)
    heading = ParagraphStyle("CTMS heading", parent=body, fontSize=12, leading=17, keepWithNext=True)

    def paragraph(value: str, style):
        value = unicodedata.normalize("NFC", value)
        if any(not char.isspace() and not font.face.charToGlyph.get(ord(char)) for char in value):
            raise InvalidPdf("editor_font_missing_glyph")
        return Paragraph(escape(value).replace("\n", "<br/>"), style)

    story = [paragraph(request.title, heading), paragraph(ATTRIBUTION, body)]
    for section in request.sections:
        for item in section.items:
            expected.append(item_text(item))
            if item.kind == "table":
                if not item.rows or not 1 <= len(item.rows[0]) <= 10 or any(len(row) != len(item.rows[0]) for row in item.rows):
                    raise InvalidPdf("editor_table_layout_unsupported")
                table = Table([[paragraph(cell, body) for cell in row] for row in item.rows], repeatRows=1)
                table.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), .35, HexColor("#778073")),
                                           ("BACKGROUND", (0, 0), (-1, 0), HexColor("#eef3ee")),
                                           ("VALIGN", (0, 0), (-1, -1), "TOP")]))
                story.append(table)
            else:
                story.append(paragraph(item.text, heading if item.kind == "heading" else body))

    stream = BytesIO()
    SimpleDocTemplate(stream, pagesize=A4, title=request.title, author="CTMS", invariant=1).build(story)
    pdf = stream.getvalue()
    parsed = PdfReader(BytesIO(pdf), strict=True)
    extracted = "\n".join(page.extract_text() or "" for page in parsed.pages)
    wanted = iter(words(extracted))
    if len(pdf) > MAX_PDF_BYTES or len(parsed.pages) > MAX_PAGES or not all(
        any(actual == word for actual in wanted) for word in words("\n".join(expected))
    ):
        raise InvalidPdf("editor_rendered_content_mismatch")
    return pdf
