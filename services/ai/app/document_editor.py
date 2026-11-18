"""Structured source sections and deterministic Unicode PDF composition."""

from typing import Literal

from pydantic import BaseModel, Field

from app.knowledge_chunking import contains_words, words
from app.knowledge_ingestion import InvalidPdf
from app.knowledge_models import MAX_PAGES



class EditorItem(BaseModel):
    kind: Literal["heading", "paragraph", "list", "table"]
    text: str = Field(default="", max_length=24000)
    rows: list[list[str]] = Field(default_factory=list, max_length=200)


class EditorSection(BaseModel):
    heading: str = Field(min_length=1, max_length=300)
    items: list[EditorItem] = Field(min_length=1, max_length=400)
    pages: list[int] = Field(default_factory=list, max_length=MAX_PAGES)
    item_refs: list[str] = Field(default_factory=list, max_length=400)


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
