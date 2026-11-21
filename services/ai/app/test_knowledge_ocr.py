from types import SimpleNamespace

import pytest
from PIL import Image, ImageDraw

from app.knowledge_chunking import compare_pdf_text, split_document, visual_content_issues
from app.knowledge_models import PageExtractionReport
from app.knowledge_ocr import OcrWord, OcrRuntimeError, check_ocr_runtime, validate_page
from app.test_knowledge_chunking import doc, prov, split, text


def evidence(monkeypatch, tokens, confidences=None):
    image = Image.new("RGB", (600, 600), "white")
    draw = ImageDraw.Draw(image)
    audit = []
    for index, token in enumerate(tokens):
        left = index * 25 + 10
        draw.rectangle((left * 3, 30, left * 3 + 30, 60), fill="black")
        audit.append(OcrWord(token, (confidences or [0.99] * len(tokens))[index],
                             (left, 10, left + 10, 20), (1, 1, 1)))
    monkeypatch.setattr("app.knowledge_ocr.recognize", lambda _image: audit)
    cells = [SimpleNamespace(text=w.text, confidence=w.confidence) for w in audit]
    return image, cells


def test_ocr_page_is_validated_without_native_text(monkeypatch):
    image, cells = evidence(monkeypatch, ["Nội", "dung", "tiếng", "Việt"])
    result = validate_page(image, 1, "", cells, "Nội dung tiếng Việt")
    assert result.mode == "ocr" and result.issues == []
    assert result.minimum_confidence == 0.99 and result.text_coverage == 1


def test_blank_requires_pixel_evidence_and_rejects_hallucinated_text():
    image = Image.new("RGB", (600, 600), "white")
    assert validate_page(image, 1, "", [], "").mode == "blank"
    assert validate_page(image, 1, "", [], "invented").issues == ["blank_page_has_text"]


@pytest.mark.parametrize("confidence,expected", [(0.6, "ocr_low_confidence"), (float("nan"), "ocr_low_confidence"),
                                                  (0.85, "ocr_critical_content_unverified")])
def test_low_confidence_critical_numbers_are_blocked(monkeypatch, confidence, expected):
    image, cells = evidence(monkeypatch, ["WARNING", "250", "ml"], [0.99, confidence, 0.99])
    assert expected in validate_page(image, 1, "", cells, "WARNING 250 ml").issues


def test_nonempty_serialized_chunks_do_not_prove_ocr_accuracy(monkeypatch):
    image, cells = evidence(monkeypatch, ["WARNING", "250", "ml"])
    result = validate_page(image, 1, "", cells, "WARNING 200 ml")
    assert {"missing_ocr_content", "ocr_text_coverage_incomplete", "ocr_critical_content_unverified"} <= set(result.issues)


def test_distance_units_require_critical_confidence_even_without_a_warning(monkeypatch):
    image, cells = evidence(monkeypatch, ["Distance", "50", "yds"], [0.99, 0.99, 0.85])
    assert "ocr_critical_content_unverified" in validate_page(image, 1, "", cells, "Distance 50 yds").issues


def test_unrecognized_marks_and_real_diagrams_remain_blocking(monkeypatch):
    image, cells = evidence(monkeypatch, ["Text"])
    ImageDraw.Draw(image).ellipse((300, 300, 500, 500), fill="black")
    assert "ocr_unverified_visual_content" in validate_page(image, 1, "", cells, "Text").issues


def test_mixed_text_keeps_native_crosscheck(monkeypatch):
    image, cells = evidence(monkeypatch, ["Scanned", "content"])
    result = validate_page(image, 1, "Native content", cells, "Native content Scanned content")
    assert result.mode == "mixed" and not result.issues
    document = doc()
    text(document, "Ordinary content.")
    chunks, _ = split(document)
    assert "missing_critical_pdf_text" in compare_pdf_text(["WARNING: Missing prerequisite"], chunks, [result])


def test_absent_native_text_requires_ocr_or_blank_evidence():
    assert compare_pdf_text([""], []) == ["page_text_unverifiable"]
    assert compare_pdf_text([""], [], [PageExtractionReport(page=1, mode="blank")]) == []


def test_native_missing_numbers_cannot_be_hidden_by_high_overall_coverage():
    document = doc()
    original = "Ordinary text " * 150
    text(document, original)
    chunks, _ = split(document)
    assert "missing_numeric_pdf_text" in compare_pdf_text([original + "\nVolume 250 ml"], chunks)


def test_invalid_bounding_box_requires_review():
    document = doc()
    item = text(document, "Text")
    item.prov[0].bbox.r = 10000
    assert "invalid_source_bbox" in split(document)[1]


def test_only_validated_fullpage_backgrounds_are_exempted():
    document = doc()
    p = prov()
    p.bbox.l, p.bbox.r, p.bbox.t, p.bbox.b = 0, 600, 800, 0
    picture = document.add_picture(prov=p)
    assert visual_content_issues(document) == ["visual_content_requires_review"]
    assert visual_content_issues(document, {1}) == []
    picture.prov[0].bbox.r = 100
    assert visual_content_issues(document, {1}) == ["visual_content_requires_review"]


def test_missing_or_mismatched_runtime_is_a_technical_failure(monkeypatch):
    monkeypatch.setattr("app.knowledge_ocr.run_tesseract", lambda args: "tesseract 4.0.0")
    with pytest.raises(OcrRuntimeError):
        check_ocr_runtime()


def test_empty_form_rules_are_accepted_only_with_table_structure_and_no_unread_text(monkeypatch):
    image = Image.new("RGB", (600, 600), "white")
    draw = ImageDraw.Draw(image)
    for position in [30, 180, 330, 570]:
        draw.line((30, position, 570, position), fill="black", width=2)
        draw.line((position, 30, position, 570), fill="black", width=2)
    monkeypatch.setattr("app.knowledge_ocr.recognize", lambda _, **kwargs: [])
    result = validate_page(image, 1, "", [], "", has_table=True)
    assert result.mode == "ocr" and not result.issues and result.ocr_words == 0
    assert "ocr_text_unverifiable" in validate_page(image, 1, "", [], "").issues
    draw.ellipse((65, 65, 100, 105), outline="black", width=4)
    assert "ocr_unverified_visual_content" in validate_page(image, 1, "", [], "", has_table=True).issues


def test_colored_paper_is_not_unexplained_ink_but_unread_foreground_remains_blocked(monkeypatch):
    image, cells = evidence(monkeypatch, ["Water"])
    colored = Image.new("RGB", image.size, (240, 170, 80))
    colored.paste(image, mask=image.convert("L").point(lambda value: 255 - value))
    # Restore the actual black foreground after replacing the paper color.
    ImageDraw.Draw(colored).rectangle((30, 30, 60, 60), fill="black")
    assert not validate_page(colored, 1, "", cells, "Water").issues
    ImageDraw.Draw(colored).ellipse((300, 300, 450, 450), fill="black")
    assert "ocr_unverified_visual_content" in validate_page(colored, 1, "", cells, "Water").issues
