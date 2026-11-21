"""Regressions for Docling 2.148's one-based conversion pages and confidence.

Use real PDF bytes, Docling documents and HybridChunker. Conversion is injected
to isolate page indexing without downloading layout/embedding models.
"""

import base64
import hashlib
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4

import pytest
from docling.datamodel.base_models import Page, PageConfidenceScores
from reportlab.pdfgen.canvas import Canvas

from app.knowledge_ingestion import KnowledgeIngestionService
from app.knowledge_models import IngestionConfiguration, IngestionRequest, PageExtractionReport
from app.knowledge_ocr import validate_ocr_pages
from app.test_knowledge_chunking import WordTokenizer, doc, text


def source_pdf():
    stream = BytesIO()
    canvas = Canvas(stream, pagesize=(600, 800), invariant=1)
    for value in ["Fictional page one.", "Fictional page two."]:
        canvas.drawString(40, 740, value)
        canvas.showPage()
    canvas.save()
    return stream.getvalue()


def conversion():
    document = doc()
    text(document, "Fictional page one.", page=1)
    text(document, "Fictional page two.", page=2)
    return SimpleNamespace(
        document=document, pages=[Page(page_no=1), Page(page_no=2)],
        status=SimpleNamespace(value="success"), errors=[],
        confidence=SimpleNamespace(pages={n: PageConfidenceScores(parse_score=1, layout_score=1)
                                         for n in [1, 2]}),
    )


def prepare(monkeypatch, result):
    service = KnowledgeIngestionService()
    service._load = Mock()
    service._model = SimpleNamespace(tokenizer=WordTokenizer())
    service._converter = SimpleNamespace(convert=Mock(return_value=result))
    monkeypatch.setattr("docling_core.transforms.chunker.tokenizer.huggingface.HuggingFaceTokenizer",
                        lambda **kwargs: WordTokenizer(limit=kwargs["max_tokens"]))
    pdf = source_pdf()
    payload = IngestionRequest(document_version_id=uuid4(), source_version=1,
                               checksum=hashlib.sha256(pdf).hexdigest(), locale="en", title="Fictional handbook",
                               configuration=IngestionConfiguration(), pdf_base64=base64.b64encode(pdf).decode())
    return service.prepare(payload)


def test_last_page_confidence_uses_one_based_docling_page_numbers(monkeypatch):
    result = prepare(monkeypatch, conversion())
    assert result.quality.status == "PASSED", result.quality.issues
    assert [(p.page, p.mode) for p in result.quality.pages] == [(1, "native"), (2, "native")]
    assert {loc.page for chunk in result.chunks for loc in chunk.locations} == {1, 2}


def test_invalid_conversion_page_never_indexes_the_last_native_page(monkeypatch):
    converted = conversion()
    converted.pages[0].page_no = 0
    converted.confidence.pages[0] = PageConfidenceScores(parse_score=1, layout_score=1)
    result = prepare(monkeypatch, converted)
    assert result.quality.status == "NEEDS_REVIEW"
    assert "invalid_source_page" in result.quality.issues
    assert not result.chunks


@pytest.mark.parametrize("number", [1, 2])
def test_broken_native_layer_replaces_only_its_own_page(monkeypatch, number):
    converted = conversion()
    converted.pages[number - 1]._broken_text_layer = True
    converted.confidence.pages[number].parse_score = 0

    def audit(pdf, conversion, native, prepared, bitmap_pages, **kwargs):
        assert kwargs == {"locale": "en"}
        assert native[number - 1] == ""
        assert native[2 - number].strip()
        return [PageExtractionReport(page=n, mode="ocr" if n == number else "native") for n in [1, 2]], set()

    monkeypatch.setattr("app.knowledge_ingestion.validate_ocr_pages", audit)
    result = prepare(monkeypatch, converted)
    assert result.quality.status == "PASSED", result.quality.issues


def test_ocr_cells_are_matched_to_the_same_one_based_source_page(monkeypatch):
    converted = conversion()
    converted.pages = [SimpleNamespace(page_no=n, cells=[
        SimpleNamespace(from_ocr=True, text=value, confidence=1)
    ]) for n, value in [(1, "Fictional page one."), (2, "Fictional page two.")]]
    observed = []

    def validate(image, number, native, cells, output, has_table):
        observed.append((number, [c.text for c in cells]))
        return PageExtractionReport(page=number, mode="ocr")

    monkeypatch.setattr("app.knowledge_ocr.validate_page", validate)
    reports, _ = validate_ocr_pages(source_pdf(), converted, ["", ""], [], [True, True])
    assert observed == [(1, ["Fictional page one."]), (2, ["Fictional page two."])]
    assert all(not report.issues for report in reports)


@pytest.mark.parametrize("blank", [True, False])
def test_low_layout_score_is_exempt_only_for_a_pixel_verified_blank_page(monkeypatch, blank):
    stream = BytesIO()
    canvas = Canvas(stream, pagesize=(600, 800), invariant=1)
    canvas.drawString(40, 740, "Fictional page one.")
    canvas.showPage()
    if not blank:
        canvas.circle(100, 100, 20, stroke=1, fill=1)
    canvas.showPage()
    canvas.save()
    monkeypatch.setattr("app.test_knowledge_page_numbers.source_pdf", lambda: stream.getvalue())
    monkeypatch.setattr("app.knowledge_ocr.recognize", lambda _, **kwargs: [])
    converted = conversion()
    converted.document = doc()
    text(converted.document, "Fictional page one.")
    converted.confidence.pages[2].layout_score = 0
    result = prepare(monkeypatch, converted)
    if blank:
        assert result.quality.status == "PASSED", result.quality.issues
        assert result.quality.pages[1].mode == "blank"
    else:
        assert result.quality.status == "NEEDS_REVIEW"
        assert "low_extraction_confidence" in result.quality.issues
