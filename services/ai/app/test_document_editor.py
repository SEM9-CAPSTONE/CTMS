from io import BytesIO
from types import SimpleNamespace as Item

import pytest
from pypdf import PdfReader

from app.document_editor import ATTRIBUTION, ComposeRequest, EditorItem, EditorSection, compose_pdf, extract_sections
from app.knowledge_ingestion import InvalidPdf


def item(label, text, reference, page=1, level=1):
    return Item(label=Item(value=label), text=text, self_ref=reference, level=level,
                prov=[Item(page_no=page)])


def test_extracts_nested_warning_and_numbered_steps_in_one_section():
    records = [
        item("section_header", "Chuẩn bị", "#/a"),
        item("section_header", "Điều kiện", "#/b", level=2),
        item("paragraph", "Cảnh báo: Kiểm tra điều kiện.", "#/c"),
        item("list_item", "Kiểm tra lần hai.", "#/d", page=2),
        item("section_header", "Kết thúc", "#/e", page=2),
    ]
    records[3].marker = "1."
    records[3].enumerated = True
    document = Item(iterate_items=lambda: iter((entry, 0) for entry in records))
    sections = extract_sections(document, [
        "Chuẩn bị\nĐiều kiện\nCảnh báo: Kiểm tra điều kiện.",
        "1. Kiểm tra lần hai.\nKết thúc",
    ], "Sổ tay")
    assert [section.heading for section in sections] == ["Chuẩn bị", "Kết thúc"]
    assert sections[0].pages == [1, 2]
    assert sections[0].item_refs == ["#/a", "#/b", "#/c", "#/d"]
    assert sections[0].items[-1].text == "1. Kiểm tra lần hai."


def test_rejects_missing_text_and_unsupported_diagram():
    record = item("paragraph", "Nội dung", "#/a")
    document = Item(iterate_items=lambda: iter([(record, 0)]))
    with pytest.raises(InvalidPdf, match="editor_text_coverage_unverified"):
        extract_sections(document, ["Nội dung. Cảnh báo bổ sung."], "Sổ tay")
    record.label.value = "picture"
    with pytest.raises(InvalidPdf, match="editor_item_unsupported"):
        extract_sections(document, ["Nội dung"], "Sổ tay")


def test_pdf_roundtrip_multiple_pages_with_vietnamese_and_table():
    pytest.importorskip("reportlab")
    table = EditorItem(kind="table", rows=[["Tên cột", "Đơn vị"], ["Đường đi", "mét"]])
    items = [
        EditorItem(kind="heading", text="Chuẩn bị"), table,
        EditorItem(kind="paragraph", text="Cảnh báo: Giữ nguyên tất cả điều kiện."),
    ]
    request = ComposeRequest(title="Sổ tay sinh tồn", sections=[
        EditorSection(heading="Chuẩn bị", items=items * 12),
    ])
    pdf = compose_pdf(request)
    parsed = PdfReader(BytesIO(pdf), strict=True)
    extracted = "\n".join(page.extract_text() or "" for page in parsed.pages)
    assert len(parsed.pages) > 1
    assert ATTRIBUTION in extracted
    assert extracted.index("Tên cột") < extracted.index("Cảnh báo")
    assert extracted.count("Giữ nguyên tất cả điều kiện.") == 12
    assert compose_pdf(request) == pdf
