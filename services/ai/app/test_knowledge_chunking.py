"""Real DoclingDocument + HybridChunker, with an offline word tokenizer for boundary tests."""

import re

import pytest
from docling_core.transforms.chunker.hybrid_chunker import HybridChunker
from docling_core.transforms.chunker.tokenizer.base import BaseTokenizer
from docling_core.types.doc import (
    BoundingBox, DocItemLabel, DoclingDocument, ProvenanceItem, Size, TableCell, TableData,
)

from app.knowledge_chunking import compare_pdf_text, low_extraction_confidence, split_document
from app.knowledge_ingestion import InvalidEmbedding, validate_embeddings
from app.knowledge_serializer import TablePreservingSerializerProvider


class WordTokenizer(BaseTokenizer):
    limit: int = 400

    def count_tokens(self, text: str) -> int:
        return len(re.findall(r"\S+", text))

    def get_max_tokens(self) -> int:
        return self.limit

    def get_tokenizer(self):
        return self.count_tokens

    def encode(self, text: str, *, add_special_tokens: bool = True) -> list[int]:
        return list(range(self.count_tokens(text) + (2 if add_special_tokens else 0)))


def prov(page: int = 1) -> ProvenanceItem:
    return ProvenanceItem(page_no=page, charspan=(0, 1), bbox=BoundingBox(l=10, t=20, r=100, b=10))


def doc() -> DoclingDocument:
    document = DoclingDocument(name="Fictional test source")
    document.add_page(page_no=1, size=Size(width=600, height=800))
    document.add_page(page_no=2, size=Size(width=600, height=800))
    return document


def text(document: DoclingDocument, value: str, page: int = 1):
    return document.add_text(label=DocItemLabel.TEXT, text=value, prov=prov(page))


def split(document: DoclingDocument, limit: int = 400):
    tokenizer = WordTokenizer(limit=limit)
    return split_document(document, HybridChunker(tokenizer=tokenizer, merge_peers=True,
                                                repeat_table_header=True, omit_header_on_overflow=False,
                                                serializer_provider=TablePreservingSerializerProvider()),
                          tokenizer, "Fictional handbook", 2, max_tokens=480)


def test_350_tokens_remain_one_chunk_and_preserve_heading_and_location():
    document = doc()
    document.add_heading(text="Weather checks", prov=prov())
    original = " ".join(f"word{i}" for i in range(350))
    text(document, original)
    chunks, issues = split(document)
    assert issues == []
    assert len(chunks) == 1
    assert chunks[0].content == original
    assert chunks[0].headings == ["Weather checks"]
    assert chunks[0].locations[0].page == 1
    assert "Weather checks" in chunks[0].embedding_text


def test_1800_tokens_split_without_losing_or_reordering_content():
    document = doc()
    document.add_heading(text="Fictional section", prov=prov())
    originals = [" ".join(f"word{paragraph}_{i}" for i in range(180)) + "." for paragraph in range(10)]
    for paragraph in originals:
        text(document, paragraph)
    chunks, issues = split(document)
    assert issues == []
    assert len(chunks) > 1
    combined = " ".join(chunk.content for chunk in chunks)
    positions = [combined.index(paragraph) for paragraph in originals]
    assert positions == sorted(positions)
    assert all(chunk.token_count <= 480 for chunk in chunks)
    assert [chunk.chunk_index for chunk in chunks] == list(range(len(chunks)))


def test_small_same_topic_paragraphs_merge_across_pages_but_different_topics_do_not():
    document = doc()
    document.add_heading(text="Topic A", prov=prov())
    text(document, " ".join(f"first{i}" for i in range(40)))
    text(document, " ".join(f"second{i}" for i in range(40)), page=2)
    document.add_heading(text="Topic B", prov=prov(2))
    text(document, "Unrelated short text.", page=2)
    chunks, issues = split(document)
    assert issues == []
    assert len(chunks) == 2
    assert {location.page for location in chunks[0].locations} == {1, 2}
    assert chunks[0].headings == ["Topic A"]
    assert chunks[1].headings == ["Topic B"]


def test_ordered_procedure_and_warning_fit_together():
    document = doc()
    document.add_heading(text="Fictional procedure", prov=prov())
    text(document, "WARNING: Only if the fictional precondition is met.")
    group = document.add_ordered_list()
    for i in range(3):
        document.add_list_item(text=f"Fictional step {i}.", enumerated=True, marker=f"{i+1}.", parent=group, prov=prov())
    chunks, issues = split(document)
    assert issues == []
    assert len(chunks) == 1
    assert "WARNING" in chunks[0].content
    assert chunks[0].content.index("step 0") < chunks[0].content.index("step 2")


def test_large_procedure_is_flagged_for_review():
    document = doc()
    document.add_heading(text="Fictional procedure", prov=prov())
    text(document, "WARNING: Fictional prerequisite.")
    group = document.add_ordered_list()
    for i in range(10):
        document.add_list_item(text=" ".join(f"step{i}_{j}" for j in range(80)), enumerated=True, parent=group, prov=prov())
    _chunks, issues = split(document)
    assert "procedure_split_requires_review" in issues


def test_large_table_repeats_headers_units_and_keeps_every_cell():
    document = doc()
    document.add_heading(text="Fictional table", prov=prov())
    cells = []
    for row in range(30):
        for column, header in enumerate(["Item", "Value (metres)"]):
            cells.append(TableCell(text=header if row == 0 else f"cell{row}_{column}",
                                   start_row_offset_idx=row, end_row_offset_idx=row+1,
                                   start_col_offset_idx=column, end_col_offset_idx=column+1,
                                   column_header=row == 0))
    document.add_table(data=TableData(num_rows=30, num_cols=2, table_cells=cells), prov=prov())
    chunks, issues = split(document, limit=70)
    assert issues == []
    assert len(chunks) > 1
    assert all("metres" in chunk.content and "Item" in chunk.content for chunk in chunks)
    combined = " ".join(chunk.content for chunk in chunks)
    assert all(f"cell{row}_{column}" in combined for row in range(1, 30) for column in range(2))


def test_missing_provenance_and_headerless_tables_require_review():
    document = doc()
    document.add_text(label=DocItemLabel.TEXT, text="Fictional text without source location.")
    _chunks, issues = split(document)
    assert "missing_source_location" in issues
    document = doc()
    cell = TableCell(text="Unverified", start_row_offset_idx=0, end_row_offset_idx=1,
                     start_col_offset_idx=0, end_col_offset_idx=1)
    document.add_table(data=TableData(num_rows=1, num_cols=1, table_cells=[cell]), prov=prov())
    _chunks, issues = split(document)
    assert "table_header_unverified" in issues


def test_independent_pdf_crosscheck_blocks_lost_warnings_and_ocr_only_pages():
    document = doc()
    text(document, "Fictional ordinary content.")
    chunks, _issues = split(document)
    assert compare_pdf_text(["Fictional ordinary content."], chunks) == []
    issues = compare_pdf_text(["Fictional ordinary content.\nWARNING: Fictional prerequisite."], chunks)
    assert "missing_critical_pdf_text" in issues
    assert "pdf_text_coverage_incomplete" in issues
    assert compare_pdf_text([""], chunks) == ["page_text_unverifiable"]


@pytest.mark.parametrize("vectors,count", [([], 1), ([[1.0]], 1), ([[0.0]*384], 1), ([[float("nan")]*384], 1)])
def test_invalid_or_missing_embeddings_are_rejected(vectors, count):
    with pytest.raises(InvalidEmbedding):
        validate_embeddings(vectors, count, 384)


def test_valid_embeddings_are_accepted():
    validate_embeddings([[1.0]*384], 1, 384)


def test_confidence_distinguishes_region_classification_from_text_and_table_extraction():
    assert not low_extraction_confidence(1.0, 0.75, float("nan"))
    assert low_extraction_confidence(0.79, 0.95, float("nan"))
    assert low_extraction_confidence(1.0, 0.49, float("nan"))
    assert low_extraction_confidence(1.0, 0.95, 0.79)
