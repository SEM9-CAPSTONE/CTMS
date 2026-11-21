"""Source geometry, header provenance and literal empty-form regressions."""

from types import SimpleNamespace

import pytest
from docling_core.transforms.chunker.hybrid_chunker import HybridChunker
from docling_core.types.doc import BoundingBox, CoordOrigin, ProvenanceItem, TableCell, TableData

from app.knowledge_chunking import split_document
from app.knowledge_serializer import TablePreservingSerializerProvider
from app.knowledge_tables import prepare_tables
from app.test_knowledge_chunking import WordTokenizer, doc, prov, text


def cell(value, row, col, left, right, *, header=False):
    return TableCell(text=value, start_row_offset_idx=row, end_row_offset_idx=row + 1,
                     start_col_offset_idx=col, end_col_offset_idx=col + 1, column_header=header,
                     bbox=BoundingBox(l=left, t=600 if header else 650, r=right,
                                      b=615 if header else 665, coord_origin=CoordOrigin.TOPLEFT))


def continuation(document, *, missing_picture_column=False):
    columns = [(70, 180), (280, 450)] if not missing_picture_column else [(70, 100), (150, 200), (280, 450)]
    cells = [cell(value, 0, col, *columns[col], header=True)
             for col, value in enumerate(["Level", "Value (km/h)"] if len(columns) == 2 else
                                         ["Level", "Illustration", "Value (km/h)"])]
    cells += [cell("1" if col == 0 else "30", 1, col, *bounds) for col, bounds in enumerate(columns) if col != 1 or len(columns) == 2]
    before = document.add_table(data=TableData(num_rows=2, num_cols=len(columns), table_cells=cells),
        prov=ProvenanceItem(page_no=1, charspan=(0, 0), bbox=BoundingBox(l=50, t=580, r=500, b=760,
                                                                     coord_origin=CoordOrigin.TOPLEFT)))
    cells = [cell("2", 0, 0, 70, 100), cell("50", 0, 1, 280, 310)]
    for value in cells:
        value.bbox.t, value.bbox.b = 80, 95
    after = document.add_table(data=TableData(num_rows=1, num_cols=2, table_cells=cells),
        prov=ProvenanceItem(page_no=2, charspan=(0, 0), bbox=BoundingBox(l=50, t=60, r=500, b=360,
                                                                     coord_origin=CoordOrigin.TOPLEFT)))
    return before, after


def split_tables(document, pages=()):
    headers, literals = prepare_tables(document, pages)
    tokenizer = WordTokenizer()
    return split_document(document, HybridChunker(tokenizer=tokenizer, merge_peers=True,
        repeat_table_header=True, omit_header_on_overflow=False,
        serializer_provider=TablePreservingSerializerProvider()), tokenizer, "Fictional handbook", 2,
        header_sources=headers, literal_tables=literals)


@pytest.mark.parametrize("missing_picture_column", [False, True])
def test_adjacent_aligned_continuation_repeats_only_real_headers_and_retains_both_sources(missing_picture_column):
    document = doc()
    before, after = continuation(document, missing_picture_column=missing_picture_column)
    chunks, issues = split_tables(document)
    assert not issues
    continuation_chunk = next(chunk for chunk in chunks if any(loc.item_ref == after.self_ref for loc in chunk.locations))
    assert "Value (km/h)" in continuation_chunk.content and "50" in continuation_chunk.content
    assert {(loc.page, loc.item_ref) for loc in continuation_chunk.locations} >= {(1, before.self_ref), (2, after.self_ref)}
    if missing_picture_column:
        assert after.data.num_cols == 3
        assert next(value.start_col_offset_idx for value in after.data.table_cells if value.text == "50") == 2
        assert "Illustration" in continuation_chunk.content


@pytest.mark.parametrize("change", ["different_margin", "not_next_page", "not_page_end", "ambiguous_columns", "new_section"])
def test_similar_tables_cannot_borrow_headers_without_continuation_evidence(change):
    document = doc()
    before, after = continuation(document)
    if change == "different_margin":
        after.prov[0].bbox.l += 100
    elif change == "not_next_page":
        after.prov[0].page_no = 1
    elif change == "not_page_end":
        before.prov[0].bbox.b = 500
    elif change == "ambiguous_columns":
        after.data.table_cells[1].bbox.l = 180
    else:
        document.add_heading(text="Another section", prov=ProvenanceItem(page_no=2, charspan=(0, 0),
            bbox=BoundingBox(l=50, t=30, r=300, b=45, coord_origin=CoordOrigin.TOPLEFT)))
    assert "table_header_unverified" in split_tables(document)[1]
    assert not any(value.column_header for value in after.data.table_cells)


@pytest.mark.parametrize("values,cols", [(["1. Overview", "2. Preparedness"], 1),
                                        (["Name", "Location", "Phone", "Household"], 3)])
def test_contents_and_blank_forms_keep_source_text_without_invented_column_numbers(values, cols):
    document = doc()
    cells = [cell(value, index if cols == 1 else index // cols, index % cols, 50, 100)
             for index, value in enumerate(values)]
    document.add_table(data=TableData(num_rows=len(values) if cols == 1 else 2, num_cols=cols, table_cells=cells), prov=prov())
    chunks, issues = split_tables(document)
    assert not issues
    content = "\n".join(chunk.content for chunk in chunks)
    assert all(value in content for value in values)
    assert "| 0" not in content and "---" not in content


def test_unknown_numeric_table_without_headers_stays_blocked():
    document = doc()
    document.add_table(data=TableData(num_rows=1, num_cols=2,
        table_cells=[cell("250", 0, 0, 50, 100), cell("500", 0, 1, 150, 200)]), prov=prov())
    assert "table_header_unverified" in split_tables(document)[1]


def test_empty_structural_table_does_not_hide_overlapping_source_text():
    document = doc()
    text(document, "Body text outside the blank form.")
    table = document.add_table(data=TableData(num_rows=0, num_cols=0, table_cells=[]), prov=prov())
    page = SimpleNamespace(page_no=1, size=document.pages[1].size, cells=[])
    assert "table_header_unverified" not in split_tables(document, [page])[1]
    page.cells = [SimpleNamespace(text="Unread source label", rect=SimpleNamespace(to_bounding_box=lambda: table.prov[0].bbox))]
    assert "table_header_unverified" in split_tables(document, [page])[1]


def test_inherited_header_citation_does_not_reorder_continuation_data_before_intervening_text():
    document = doc()
    before, after = continuation(document)
    marker = "Intervening source paragraph " + "detail " * 390
    text(document, marker)
    document.body.children.insert(1, document.body.children.pop())
    chunks, _ = split_tables(document)
    position = next(chunk.chunk_index for chunk in chunks if "Intervening source paragraph" in chunk.content)
    assert all(chunk.chunk_index > position for chunk in chunks
               if any(loc.item_ref == after.self_ref for loc in chunk.locations))
