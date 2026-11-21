"""Native text, page metadata and region OCR regressions without model downloads."""

from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from docling.datamodel.base_models import Cluster, LayoutPrediction, Page, PagePredictions
from docling.datamodel.pipeline_options import OcrMode, TesseractCliOcrOptions
from docling_core.types.doc import BoundingBox, ContentLayer, CoordOrigin, DocItemLabel, Size
from docling_core.types.doc.page import SegmentedPdfPage
from pydantic import ValidationError

from app.knowledge_chunking import compare_pdf_text, matching_glyph_span, visual_content_issues
from app.knowledge_models import IngestionConfiguration, PageExtractionReport
from app.knowledge_ocr import validate_ocr_pages
from app.knowledge_pdf_pipeline import TextRegionTesseractOcrModel
from app.test_knowledge_chunking import doc, prov, split, text
from app.test_knowledge_page_numbers import source_pdf


def test_native_page_with_pictures_does_not_get_a_whole_page_ocr_audit(monkeypatch):
    document = doc()
    text(document, "Fictional page one.", page=1)
    text(document, "Fictional page two.", page=2)
    chunks, _ = split(document)
    conversion = SimpleNamespace(document=document, pages=[Page(page_no=n) for n in [1, 2]])
    recognize = Mock(side_effect=AssertionError("Native text must not be re-read with OCR"))
    monkeypatch.setattr("app.knowledge_ocr.recognize", recognize)
    reports, _ = validate_ocr_pages(source_pdf(), conversion,
                                  ["Fictional page one.", "Fictional page two."], chunks, [True, True])
    assert [report.mode for report in reports] == ["native", "native"]
    assert all(not report.issues for report in reports)
    recognize.assert_not_called()


@pytest.mark.parametrize("pipeline", ["ctms-hybrid-v1", "ctms-hybrid-ocr-v2", "ctms-hybrid-ocr-v3", "ctms-hybrid-ocr-v4"])
def test_old_pipeline_contract_cannot_silently_use_integrity_rules(pipeline):
    assert IngestionConfiguration().pipeline_version == "ctms-content-integrity-v5"
    with pytest.raises(ValidationError):
        IngestionConfiguration(pipeline_version=pipeline)


def test_region_selection_excludes_photographs_without_mutating_layout(monkeypatch):
    model = TextRegionTesseractOcrModel.__new__(TextRegionTesseractOcrModel)
    model.options = TesseractCliOcrOptions(lang=["eng"])
    clusters = [Cluster(id=n, label=label, bbox=BoundingBox(l=0, t=n * 50, r=100, b=(n + 1) * 50,
                                                         coord_origin=CoordOrigin.TOPLEFT))
                for n, label in enumerate([DocItemLabel.PICTURE, DocItemLabel.TEXT, DocItemLabel.TABLE])]
    page = Page(page_no=1, size=Size(width=600, height=800),
                predictions=PagePredictions(layout=LayoutPrediction(clusters=clusters)))

    def select(self, selection):
        assert [cluster.label for cluster in selection.predictions.layout.clusters] == [
            DocItemLabel.TEXT, DocItemLabel.TABLE,
        ]
        return [clusters[1].bbox, clusters[2].bbox]

    monkeypatch.setattr("docling.models.base_ocr_model.BaseOcrModel.get_ocr_rects", select)
    regions = model.get_ocr_rects(page)
    assert len(regions) == 2
    assert all(region.intersection_area_with(cluster.bbox) == cluster.bbox.area()
               for region, cluster in zip(regions, clusters[1:]))
    assert len(page.predictions.layout.clusters) == 3
    assert page._ctms_ocr_regions == regions


def test_a_broken_text_layer_keeps_the_full_page_ocr_path(monkeypatch):
    model = TextRegionTesseractOcrModel.__new__(TextRegionTesseractOcrModel)
    model.options = TesseractCliOcrOptions(lang=["eng"], mode=OcrMode.PDF_AWARE_LAYOUT_REGIONS,
                                         replace_broken_text_layer=True)
    page = Page(page_no=1, size=Size(width=600, height=800))
    page._broken_text_layer = True
    regions = model.get_ocr_rects(page)
    assert len(regions) == 1
    assert regions[0].area() == 600 * 800


def test_a_scan_detected_only_as_a_picture_still_gets_ocr():
    model = TextRegionTesseractOcrModel.__new__(TextRegionTesseractOcrModel)
    model.options = TesseractCliOcrOptions(lang=["eng"])
    page = Page(page_no=1, size=Size(width=600, height=800), predictions=PagePredictions(
        layout=LayoutPrediction(clusters=[Cluster(id=0, label=DocItemLabel.PICTURE,
            bbox=BoundingBox(l=0, t=0, r=600, b=800, coord_origin=CoordOrigin.TOPLEFT))]),
    ))
    assert sum(box.area() for box in model.get_ocr_rects(page)) > 0.9 * 600 * 800


def test_audit_receives_only_the_recognized_region_and_keeps_mixed_mode(monkeypatch):
    document = doc()
    text(document, "Native text.")
    text(document, "Scanned text.")
    box = BoundingBox(l=20, t=30, r=120, b=80, coord_origin=CoordOrigin.TOPLEFT)
    cell = SimpleNamespace(from_ocr=True, text="Scanned text.", confidence=0.99,
                           rect=SimpleNamespace(to_bounding_box=lambda: box))
    page = SimpleNamespace(page_no=1, cells=[cell], _ctms_ocr_regions=[box])
    conversion = SimpleNamespace(document=document, pages=[page, Page(page_no=2)])
    observed = []

    def audit(image, number, native, cells, output, has_table, **kwargs):
        assert kwargs == {"psm": 6, "audit_evidence": []}
        observed.append((image.size, native, cells))
        return PageExtractionReport(page=number, mode="ocr", ocr_words=2,
                                    minimum_confidence=0.99, text_coverage=1)

    monkeypatch.setattr("app.knowledge_ocr.validate_page", audit)
    chunks, _ = split(document)
    reports, _ = validate_ocr_pages(source_pdf(), conversion,
                                  ["Native text.", "Fictional page two."], chunks, [True, False])
    assert observed == [((300, 150), "", [cell])]
    assert reports[0].mode == "mixed" and not reports[0].issues


def test_native_text_does_not_mask_a_region_that_ocr_failed_to_read(monkeypatch):
    document = doc()
    text(document, "Native text.")
    box = BoundingBox(l=20, t=30, r=120, b=80, coord_origin=CoordOrigin.TOPLEFT)
    page = SimpleNamespace(page_no=1, cells=[], _ctms_ocr_regions=[box])
    conversion = SimpleNamespace(document=document, pages=[page, Page(page_no=2)])
    audit = Mock(return_value=PageExtractionReport(page=1, mode="unverified", issues=["ocr_text_unverifiable"]))
    monkeypatch.setattr("app.knowledge_ocr.validate_page", audit)
    reports, _ = validate_ocr_pages(source_pdf(), conversion,
                                  ["Native text.", "Fictional page two."], [], [True, False])
    audit.assert_called_once()
    assert reports[0].issues == ["ocr_text_unverifiable"]


def test_empty_selected_crops_do_not_hide_a_nonblank_scan(monkeypatch):
    document = doc()
    box = BoundingBox(l=0, t=0, r=10, b=10, coord_origin=CoordOrigin.TOPLEFT)
    page = SimpleNamespace(page_no=1, cells=[], _ctms_ocr_regions=[box])
    conversion = SimpleNamespace(document=document, pages=[page, Page(page_no=2)])
    audit = Mock(side_effect=[
        PageExtractionReport(page=1, mode="blank"),
        PageExtractionReport(page=1, mode="unverified", issues=["ocr_text_unverifiable"]),
    ])
    monkeypatch.setattr("app.knowledge_ocr.validate_page", audit)
    reports, _ = validate_ocr_pages(source_pdf(), conversion,
                                  ["", "Fictional page two."], [], [True, False])
    assert [call.args[0].size for call in audit.call_args_list] == [(30, 30), (1800, 2400)]
    assert reports[0].mode == "unverified" and reports[0].issues == ["ocr_text_unverifiable"]


@pytest.mark.parametrize("value", ["December 2022", "Form 10-1700 (Rev 3/23)", "1"])
def test_source_metadata_is_preserved_except_for_the_physical_page_counter(value):
    document = doc()
    text(document, "Native body text.")
    document.add_text(label=DocItemLabel.PAGE_FOOTER, text=value, prov=prov(),
                      content_layer=ContentLayer.FURNITURE)
    chunks, _ = split(document)
    assert (value in "\n".join(chunk.content for chunk in chunks)) == (value != "1")
    assert all(chunk.locations for chunk in chunks)
    assert compare_pdf_text(["Native body text.\n" + value], chunks, document=document) == []


@pytest.mark.parametrize("value", ["December 2022", "Volume 250 ml", "Call 911", "250"])
def test_body_numbers_and_safety_footer_text_are_never_exempted(value):
    document = doc()
    text(document, "Native body text.")
    chunks, _ = split(document)
    document.add_text(label=DocItemLabel.PAGE_FOOTER if value != "December 2022" else DocItemLabel.TEXT,
                      text=value, prov=prov())
    reports = [PageExtractionReport(page=1, mode="native")]
    assert "missing_numeric_pdf_text" in compare_pdf_text(
        ["Native body text.\n" + value], chunks, reports, document=document,
    )
    assert "missing_numeric_pdf_text" in reports[0].issues


def test_unit_spacing_is_equivalent_but_changed_values_and_swapped_units_are_blocked():
    document = doc()
    text(document, "Volume 250ml and distance 50yds.")
    chunks, _ = split(document)
    assert compare_pdf_text(["Volume 250 ml and distance 50 yds."], chunks) == []
    assert "missing_numeric_pdf_text" in compare_pdf_text(["Volume 200 ml and distance 50 yds."], chunks)
    assert "missing_numeric_pdf_text" in compare_pdf_text(["Volume 250 yds and distance 50 ml."], chunks)
    assert "missing_numeric_pdf_text" in compare_pdf_text(["Volume 250\nmg and distance 50 yds."], chunks)


def test_native_figure_labels_reach_chunks_and_formulas_remain_blocking():
    document = doc()
    picture = document.add_picture(prov=prov())
    document.add_text(label=DocItemLabel.TEXT, text="50 yds 100 yds", parent=picture, prov=prov())
    chunks, _ = split(document)
    assert "50 yds 100 yds" in " ".join(chunk.content for chunk in chunks)
    assert compare_pdf_text(["50 yds 100 yds"], chunks, document=document) == []
    assert visual_content_issues(document, text_pages={1}) == []
    document.add_text(label=DocItemLabel.FORMULA, text="x = 2", prov=prov())
    assert visual_content_issues(document, text_pages={1}) == ["visual_content_requires_review"]


@pytest.mark.parametrize("native,extracted", [
    ("Phải có s ự g ắng s ức.", "Phải có sự gắng sức."),
    ("Không được về nhà ho ặc qua suối.", "Không được về nhà hoặc qua suối."),
    ("Phải theo chính quy ền địa ph ương để s ơ tán.", "Phải theo chính quyền địa phương để sơ tán."),
])
def test_vietnamese_font_run_spacing_does_not_look_like_missing_warnings(native, extracted):
    document = doc()
    text(document, extracted)
    chunks, _ = split(document)
    assert compare_pdf_text([native], chunks) == []


@pytest.mark.parametrize("source,output", [
    ("Không được đi.", "Được đi."),
    ("Phải theo chính quyền.", "Phải theo chính quyên."),
    ("Use 2 50 ml.", "Use 250 ml."),
    ("Use 2.50 ml.", "Use 250 ml."),
    ("Use -250 ml.", "Use 250 ml."),
    ("Use 250 ml and 50 mg.", "Use 250 mg and 50 ml."),
])
def test_glyph_alignment_never_repairs_changed_words_numbers_signs_or_units(source, output):
    assert matching_glyph_span(source, output) is None


def test_consecutive_sibling_headings_retain_the_original_numbered_section_title():
    document = doc()
    heading = "5. LOOK FOR REGULATIONS, PERMITS, AND RESERVATIONS"
    document.add_heading(text=heading, level=1, prov=prov())
    document.add_heading(text="Regulations", level=1, prov=prov())
    text(document, "Check the park rules before arrival.")
    chunks, issues = split(document)
    assert not issues
    assert any(chunk.content == heading and chunk.locations[0].item_ref == "#/texts/0" for chunk in chunks)
    assert compare_pdf_text([heading + "\nRegulations\nCheck the park rules before arrival."], chunks) == []


def test_unselected_layout_detection_cannot_become_an_ocr_audit_region(monkeypatch):
    model = TextRegionTesseractOcrModel.__new__(TextRegionTesseractOcrModel)
    model.options = TesseractCliOcrOptions(lang=["eng"])
    page = Page(page_no=1, size=Size(width=600, height=800), predictions=PagePredictions(
        layout=LayoutPrediction(clusters=[Cluster(id=0, label=DocItemLabel.TEXT,
            bbox=BoundingBox(l=20, t=30, r=40, b=50, coord_origin=CoordOrigin.TOPLEFT))]),
    ))
    monkeypatch.setattr("docling.models.base_ocr_model.BaseOcrModel.get_ocr_rects", lambda *_: [])
    assert model.get_ocr_rects(page) == []
    assert page._ctms_ocr_audit_regions == []


@pytest.mark.parametrize("raster_fragment", [False, True])
def test_native_text_on_colored_background_keeps_pdf_cells_but_separate_raster_text_gets_ocr(monkeypatch, raster_fragment):
    model = TextRegionTesseractOcrModel.__new__(TextRegionTesseractOcrModel)
    model.options = TesseractCliOcrOptions(lang=["eng"])
    box = BoundingBox(l=20, t=30, r=120, b=80, coord_origin=CoordOrigin.TOPLEFT)
    native_box = BoundingBox(l=25, t=35, r=100, b=45 if raster_fragment else 70, coord_origin=CoordOrigin.TOPLEFT)
    bitmap = BoundingBox(l=30, t=60, r=100, b=75, coord_origin=CoordOrigin.TOPLEFT) if raster_fragment else box
    page = Page(page_no=1, size=Size(width=600, height=800), predictions=PagePredictions(
        layout=LayoutPrediction(clusters=[Cluster(id=0, label=DocItemLabel.TEXT, bbox=box)]),
    ))
    page.parsed_page = SegmentedPdfPage.model_construct(textline_cells=[SimpleNamespace(
        text="Native source text", from_ocr=False, rect=SimpleNamespace(to_bounding_box=lambda: native_box))])
    page._backend = SimpleNamespace(get_bitmap_rects=lambda: [bitmap])

    def select(self, candidate):
        return [cluster.bbox for cluster in candidate.predictions.layout.clusters]

    monkeypatch.setattr("docling.models.base_ocr_model.BaseOcrModel.get_ocr_rects", select)
    regions = model.get_ocr_rects(page)
    assert len(regions) == int(raster_fragment)
    if raster_fragment:
        assert regions[0].intersection_area_with(bitmap) == bitmap.area()
    assert page.cells[0].text == "Native source text" and not page.cells[0].from_ocr


def test_picture_overlap_does_not_discard_detected_captions_or_hide_failed_ocr(monkeypatch):
    model = TextRegionTesseractOcrModel.__new__(TextRegionTesseractOcrModel)
    model.options = TesseractCliOcrOptions(lang=["eng"])
    box = BoundingBox(l=20, t=30, r=120, b=80, coord_origin=CoordOrigin.TOPLEFT)
    native_box = BoundingBox(l=200, t=300, r=400, b=320, coord_origin=CoordOrigin.TOPLEFT)
    page = Page(page_no=1, size=Size(width=600, height=800), predictions=PagePredictions(
        layout=LayoutPrediction(clusters=[Cluster(id=0, label=DocItemLabel.PICTURE, bbox=box),
            Cluster(id=1, label=DocItemLabel.TEXT, bbox=box, confidence=0.95),
            Cluster(id=2, label=DocItemLabel.CAPTION, bbox=box, confidence=0.8)]),
    ))
    page.parsed_page = SegmentedPdfPage.model_construct(textline_cells=[SimpleNamespace(
        text="Native source text", from_ocr=False, rect=SimpleNamespace(to_bounding_box=lambda: native_box))])
    page._backend = SimpleNamespace(get_bitmap_rects=lambda: [])

    def select(self, candidate):
        assert [cluster.label for cluster in candidate.predictions.layout.clusters] == [DocItemLabel.CAPTION]
        return [box]

    monkeypatch.setattr("docling.models.base_ocr_model.BaseOcrModel.get_ocr_rects", select)
    assert model.get_ocr_rects(page)[0].intersection_area_with(box) == box.area()
    audit = Mock(return_value=PageExtractionReport(page=1, mode="unverified", issues=["ocr_text_unverifiable"]))
    monkeypatch.setattr("app.knowledge_ocr.validate_page", audit)
    reports, _ = validate_ocr_pages(source_pdf(), SimpleNamespace(document=doc(), pages=[page, Page(page_no=2)]),
                                  ["Native source text", "Fictional page two."], [], [True, False])
    audit.assert_called_once()
    assert reports[0].issues == ["ocr_text_unverifiable"]


def test_small_crop_rescaling_preserves_fractional_source_coordinates(monkeypatch, tmp_path):
    import pandas as pd
    from PIL import Image, ImageDraw
    model = TextRegionTesseractOcrModel.__new__(TextRegionTesseractOcrModel)
    model.scale = 3.0
    model.options = TesseractCliOcrOptions(lang=["eng"], psm=6)
    image = Image.new("RGB", (180, 60), "white")
    ImageDraw.Draw(image).ellipse((20, 10, 60, 50), outline="black", width=3)
    filename = tmp_path / "crop.png"
    image.save(filename)
    monkeypatch.setattr("docling.models.stages.ocr.tesseract_ocr_cli_model.TesseractOcrCliModel._run_tesseract",
        lambda *_: pd.DataFrame([dict(text="Label", conf=99, left=21, top=25, width=131, height=31)]))
    result = model._run_tesseract(str(filename), None)
    assert result.iloc[0]["left"] == 4.5 and result.iloc[0]["top"] == 6.5
    assert result.iloc[0]["width"] == 65.5 and result.iloc[0]["height"] == 15.5


@pytest.mark.parametrize("source", ["Temperature -25 degrees.", "Temperature −25 degrees.", "Temperature +25 degrees."])
def test_changed_numeric_sign_is_blocked_by_the_native_source_crosscheck(source):
    document = doc()
    text(document, "Temperature 25 degrees.")
    chunks, _ = split(document)
    assert "missing_numeric_pdf_text" in compare_pdf_text([source], chunks)


def test_ocr_list_markers_are_part_of_the_page_local_structured_source(monkeypatch):
    document = doc()
    document.add_list_item(text="Keep the original step.", enumerated=True, marker="1.", prov=prov())
    chunks, _ = split(document)
    cell = SimpleNamespace(from_ocr=True, text="1.", confidence=0.99)
    conversion = SimpleNamespace(document=document, pages=[SimpleNamespace(page_no=1, cells=[cell]), Page(page_no=2)])
    monkeypatch.setattr("app.knowledge_ocr.validate_page", lambda *args, **kwargs: PageExtractionReport(page=1, mode="ocr"))
    reports, _ = validate_ocr_pages(source_pdf(), conversion, ["", "Fictional page two."], chunks, [True, False])
    assert not reports[0].issues


def test_overlapping_ocr_detections_are_recognized_once_without_mutating_the_layout(monkeypatch):
    model = TextRegionTesseractOcrModel.__new__(TextRegionTesseractOcrModel)
    model.options = TesseractCliOcrOptions(lang=["eng"])
    boxes = [BoundingBox(l=20 + n, t=30, r=120 + n, b=80, coord_origin=CoordOrigin.TOPLEFT) for n in [0, 1]]
    page = Page(page_no=1, size=Size(width=600, height=800), predictions=PagePredictions(
        layout=LayoutPrediction(clusters=[Cluster(id=n, label=DocItemLabel.TEXT, bbox=box) for n, box in enumerate(boxes)])))
    monkeypatch.setattr("docling.models.base_ocr_model.BaseOcrModel.get_ocr_rects", lambda *_: boxes)
    regions = model.get_ocr_rects(page)
    assert len(regions) == 1 and all(regions[0].intersection_area_with(box) == box.area() for box in boxes)
    assert [cluster.bbox for cluster in page.predictions.layout.clusters] == boxes


def test_grid_ocr_preserves_text_and_uses_sparse_table_segmentation(monkeypatch, tmp_path):
    import pandas as pd
    from PIL import Image, ImageDraw
    model = TextRegionTesseractOcrModel.__new__(TextRegionTesseractOcrModel)
    model.scale = 3.0
    model.options = TesseractCliOcrOptions(lang=["eng"], psm=6)
    image = Image.new("RGB", (800, 600), "white")
    draw = ImageDraw.Draw(image)
    for y in [30, 250, 550]:
        draw.line((30, y, 770, y), fill="black", width=2)
    for x in [30, 400, 770]:
        draw.line((x, 30, x, 550), fill="black", width=2)
    draw.text((100, 100), "Value ml", fill="black")
    filename = tmp_path / "grid.png"
    image.save(filename)

    def recognize(self, path, osd):
        assert self.options.psm == 11
        with Image.open(path) as normalized:
            assert normalized.getpixel((36, 36)) == 255
            assert normalized.getextrema()[0] < 128
        return pd.DataFrame([dict(text="ml", conf=99, left=110, top=110, width=15, height=10)])

    monkeypatch.setattr("docling.models.stages.ocr.tesseract_ocr_cli_model.TesseractOcrCliModel._run_tesseract", recognize)
    result = model._run_tesseract(str(filename), None)
    assert result.iloc[0]["text"] == "ml" and model.options.psm == 6
