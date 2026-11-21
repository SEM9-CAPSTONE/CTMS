"""Real Docling OCR engine integration without layout/embedding model downloads.

This tests the OCR adapter and raster evidence, not full document ingestion.
The separate test_knowledge_ocr_integration suite exercises that full pipeline.
"""

import os
import socket
from pathlib import Path

import pytest
from pypdf import PdfReader

from app.knowledge_ocr import check_ocr_runtime, tessdata_path, tesseract_command, validate_page

ROOT = Path(__file__).parent / "fixtures" / "ocr"
pytestmark = pytest.mark.skipif(os.environ.get("RUN_KNOWLEDGE_OCR_INTEGRATION") != "true",
                                reason="Requires provisioned Tesseract 5.5.0 and pinned traineddata")


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    def deny(*args, **kwargs):
        raise AssertionError("Real OCR stage tests cannot use network")
    monkeypatch.setattr(socket.socket, "connect", deny)
    monkeypatch.setattr(socket, "create_connection", deny)


@pytest.mark.parametrize("name,expected", [("scan-vi.pdf", "tiếng Việt"), ("scan-en.pdf", "Equipment"),
                                          ("scan-warning.pdf", "WARNING"), ("scan-table.pdf", "250"),
                                          ("scan-multipage.pdf", "tiếng Việt"), ("scan-blank.pdf", "tiếng Việt"),
                                          ("scan-unreadable.pdf", None)])
def test_real_docling_tesseract_stage_reads_an_image_only_pdf(name, expected):
    from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend
    from docling.datamodel.accelerator_options import AcceleratorOptions
    from docling.datamodel.base_models import InputFormat, Page
    from docling.datamodel.document import ConversionResult, InputDocument
    from docling.datamodel.pipeline_options import OcrMode, TesseractCliOcrOptions
    from docling.models.stages.ocr.tesseract_ocr_cli_model import TesseractOcrCliModel

    assert all(not p.extract_text().strip() for p in PdfReader(ROOT / name).pages)
    check_ocr_runtime()
    source = InputDocument(ROOT / name, format=InputFormat.PDF, backend=PyPdfiumDocumentBackend)
    result = ConversionResult(input=source)
    english = name in {"scan-en.pdf", "scan-warning.pdf", "scan-table.pdf", "scan-unreadable.pdf"}
    options = TesseractCliOcrOptions(lang=["eng"] if english else ["vie", "eng"], tesseract_cmd=tesseract_command(),
                                     path=tessdata_path(), mode=OcrMode.FULL_PAGE, scale=3.0)
    engine = TesseractOcrCliModel(True, None, options, AcceleratorOptions())
    try:
        for index in range(source.page_count):
            page = Page(page_no=index + 1)
            page._backend = source._backend.load_page(index)
            page.size = page._backend.get_size()
            converted = list(engine(result, [page]))[0]
            text = " ".join(c.text for c in converted.cells)
            if index == 0 and expected:
                assert expected in text
            assert all(c.from_ocr and 0 <= c.confidence <= 1 for c in converted.cells)
            for cell in converted.cells:
                box = cell.rect.to_bounding_box().to_top_left_origin(page.size.height)
                assert 0 <= box.l < box.r <= page.size.width and 0 <= box.t < box.b <= page.size.height
            report = validate_page(page._backend.get_page_image(scale=3.0), index + 1, "", converted.cells,
                                    text, has_table=name == "scan-table.pdf", language="eng" if english else "vie+eng")
            if name == "scan-unreadable.pdf":
                assert report.issues, report.model_dump()
            else:
                assert report.issues == [], report.model_dump()
            assert (report.mode == "blank") == (name == "scan-blank.pdf" and index == 1)
            page._backend.unload()
    finally:
        source._backend.unload()


def test_real_text_region_adapter_preserves_native_text_and_reads_a_scanned_paragraph():
    from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend
    from docling.datamodel.accelerator_options import AcceleratorOptions
    from docling.datamodel.base_models import Cluster, InputFormat, LayoutPrediction, Page, PagePredictions
    from docling.datamodel.document import ConversionResult, InputDocument
    from docling.datamodel.pipeline_options import TesseractCliOcrOptions
    from docling_core.types.doc import BoundingBox, CoordOrigin, DocItemLabel
    from app.knowledge_pdf_pipeline import TextRegionTesseractOcrModel

    check_ocr_runtime()
    source = InputDocument(ROOT / "mixed-page.pdf", format=InputFormat.PDF, backend=PyPdfiumDocumentBackend)
    result = ConversionResult(input=source)
    engine = TextRegionTesseractOcrModel(True, None, TesseractCliOcrOptions(
        lang=["vie", "eng"], tesseract_cmd=tesseract_command(), path=tessdata_path(),
    ), AcceleratorOptions())
    page = Page(page_no=1)
    page._backend = source._backend.load_page(0)
    try:
        page.size = page._backend.get_size()
        page.parsed_page = page._backend.get_segmented_page()
        page.predictions = PagePredictions(layout=LayoutPrediction(clusters=[
            Cluster(id=i, label=label, bbox=BoundingBox(l=l, t=t, r=r, b=b, coord_origin=CoordOrigin.TOPLEFT))
            for i, (label, l, t, r, b) in enumerate([
                (DocItemLabel.TEXT, 40, 35, 400, 70),
                (DocItemLabel.TEXT, 0, 308, 595, 542),
                (DocItemLabel.PICTURE, 0, 560, 595, 800),
            ])
        ]))
        converted = list(engine(result, [page]))[0]
        assert "Fictional mixed page" in " ".join(c.text for c in converted.cells if not c.from_ocr)
        assert "Equipment" in " ".join(c.text for c in converted.cells if c.from_ocr)
        assert len(page._ctms_ocr_regions) == 1
        assert page._ctms_ocr_regions[0].area() < page.size.width * page.size.height / 2
    finally:
        page._backend.unload()
        source._backend.unload()
