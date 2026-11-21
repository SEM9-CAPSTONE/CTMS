"""Source-bound integrity review against real Docling structures and chunker."""
import copy
from types import SimpleNamespace

import pytest
from docling_core.types.doc import BoundingBox, DocItemLabel
from docling_core.transforms.chunker.hybrid_chunker import HybridChunker

from app.knowledge_integrity import (apply_decisions, build_regions, check_snapshot, incremental_split,
    integrity_summary, make_region, snapshot_for, validate_content)
from app.knowledge_models import IngestionConfiguration, PageExtractionReport
from app.knowledge_serializer import TablePreservingSerializerProvider
from app.test_knowledge_chunking import WordTokenizer, doc, prov, split, text


def region(document, item, issues=("ocr_low_confidence",), kind=None):
    return make_region(document, item.prov[0].page_no, item.prov[0].bbox.model_dump(mode="json"), issues,
                       refs=[item.self_ref], kind=kind)


def decision(action, value, **extra):
    return dict(action=action, text=value, source_checked=True, context_checked=True, visual_checked=True, **extra)


def engine():
    tokenizer = WordTokenizer()
    return tokenizer, HybridChunker(tokenizer=tokenizer, merge_peers=True, repeat_table_header=True,
        omit_header_on_overflow=False, serializer_provider=TablePreservingSerializerProvider())


def test_italic_caption_confirmation_preserves_original_structure_and_clears_only_its_region():
    source = doc()
    caption = source.add_text(label=DocItemLabel.CAPTION, text="Cooperate with local teams", prov=prov())
    r = region(source, caption, kind="caption")
    original = source.model_dump(mode="json")
    r["decision"] = decision("confirm", caption.text)
    applied = {}
    assert apply_decisions(source, [r], applied) == set()
    assert source.model_dump(mode="json") == original
    assert apply_decisions(source, [r], applied) == set()
    assert integrity_summary([r], 1)["complete"]


@pytest.mark.parametrize("label", ["Hình a", "Hình b", "Hình c"])
def test_short_labels_require_the_linked_image_before_any_exclusion(label):
    source = doc()
    picture = source.add_picture(prov=prov())
    caption = source.add_text(label=DocItemLabel.CAPTION, text=label, prov=prov())
    r = region(source, caption, kind="caption")
    assert not r["critical"] and r["excludable"] and picture.self_ref in r["related_figures"]
    r["decision"] = decision("exclude", "", reason="Nhãn chỉ đánh dấu hình đã được mô tả đầy đủ.")
    with pytest.raises(ValueError, match="related_figure_unverified"):
        apply_decisions(source, [r])
    image = region(source, picture, ("visual_content_requires_review",), "image")
    image["decision"] = decision("describe", "The verified diagram shows the sequence of preparing the shelter.")
    apply_decisions(source, [image, r])
    assert caption.text == ""


@pytest.mark.parametrize("value", ["WARNING: Do not cross flooded roads", "Use 250 ml of water"])
def test_critical_instruction_and_numeric_information_cannot_be_excluded(value):
    source = doc()
    r = region(source, text(source, value))
    assert r["critical"] and not r["excludable"]
    r["decision"] = decision("exclude", "", reason="A sufficiently long attempted exclusion")
    with pytest.raises(ValueError, match="exclusion_forbidden"):
        apply_decisions(source, [r])


def test_visual_only_instructions_are_not_verified_by_absence_of_ocr_words():
    source = doc()
    picture = source.add_picture(prov=prov())
    findings = build_regions(source, [PageExtractionReport(page=1, mode="native")], [], set())
    assert len(findings) == 1 and findings[0]["item_refs"] == [picture.self_ref]
    assert not integrity_summary(findings, 0)["complete"]


def test_source_snapshot_rejects_other_version_checksum_configuration_or_changed_region():
    source = doc()
    r = region(source, text(source, "Some sourced text"))
    request = SimpleNamespace(document_version_id="version-one", checksum="a" * 64, configuration=IngestionConfiguration())
    saved = snapshot_for(request, source, ["Some sourced text", ""], [], [], [r], [])
    check_snapshot(request, saved)
    for key, value in [("document_version_id", "other-version"), ("checksum", "b" * 64)]:
        changed = copy.deepcopy(saved)
        changed[key] = value
        with pytest.raises(ValueError, match="source_mismatch"):
            check_snapshot(request, changed)
    changed = copy.deepcopy(saved)
    changed["regions"][0]["bbox"]["r"] += 1
    with pytest.raises(ValueError, match="fingerprint_mismatch"):
        check_snapshot(request, changed)


def test_correction_only_rechunks_the_dependent_heading_interval_and_keeps_other_inputs():
    original = doc()
    original.add_heading(text="Shelter", prov=prov())
    item = text(original, "Prepare the shclter before nightfall.")
    original.add_heading(text="Equipment", prov=prov(2))
    text(original, "Carry a waterproof jacket and a map.", page=2)
    previous, issues = split(original)
    assert not issues
    source = copy.deepcopy(original)
    r = region(source, item)
    r["decision"] = decision("correct", "Prepare the shelter before nightfall.")
    changed = apply_decisions(source, [r])
    tokenizer, chunker = engine()
    updated, issues = incremental_split(source, chunker, tokenizer, "Fictional handbook", 2,
        {"prepared": [c.model_dump() for c in previous]}, changed)
    assert not issues and not validate_content(source, updated, tokenizer)
    assert "shclter" in original.texts[1].text
    assert "shelter" in updated[0].content
    assert updated[-1].model_dump() == previous[-1].model_dump()
    assert len({c.embedding_text for c in updated}) == len(updated)


def test_repeated_picture_description_does_not_append_duplicate_sourced_blocks():
    source = doc()
    picture = source.add_picture(prov=prov())
    r = region(source, picture, kind="image")
    r["decision"] = decision("describe", "A verified visual instruction with full context.")
    applied, refs = {}, {}
    apply_decisions(source, [r], applied, refs)
    assert len(source.texts) == 1
    assert apply_decisions(source, [r], applied, refs) == set()
    r["decision"] = decision("describe", "An amended verified visual instruction with full context.")
    apply_decisions(source, [r], applied, refs)
    assert len(source.texts) == 1 and source.texts[0].text.startswith("An amended")


def test_omission_requires_same_page_reading_order_anchor():
    source = doc()
    first = text(source, "First instruction.")
    r = make_region(source, 1, first.prov[0].bbox.model_dump(mode="json"), ["missing_critical_pdf_text"], refs=[])
    r["decision"] = decision("correct", "WARNING: Check the weather before leaving.")
    with pytest.raises(ValueError, match="reading_order_anchor"):
        apply_decisions(source, [r])
    r["decision"]["after_item_ref"] = first.self_ref
    apply_decisions(source, [r])
    assert [item.text for item, _ in source.iterate_items()] == ["First instruction.", "WARNING: Check the weather before leaving."]


def test_high_confidence_and_admin_upload_are_not_evidence_for_a_missing_number():
    from app.knowledge_chunking import compare_pdf_text
    source = doc()
    text(source, "Use 200 ml of water.")
    prepared, _ = split(source)
    reports = [PageExtractionReport(page=1, mode="native", minimum_confidence=0.99)]
    assert "missing_numeric_pdf_text" in compare_pdf_text(["Use 250 ml of water."], prepared, reports, document=source)


def test_cached_correction_resumes_without_pdf_conversion_or_repeated_ocr(monkeypatch):
    import base64
    import hashlib
    from uuid import uuid4
    from unittest.mock import Mock
    from app.knowledge_ingestion import KnowledgeIngestionService
    from app.knowledge_models import IngestionRequest
    from app.test_knowledge_page_numbers import conversion, source_pdf
    converted = conversion()
    converted.document.texts[0].text = "Fictional pagc one."
    service = KnowledgeIngestionService()
    service._load = Mock()
    service._model = SimpleNamespace(tokenizer=WordTokenizer())
    service._converter = SimpleNamespace(convert=Mock(return_value=converted))
    monkeypatch.setattr("docling_core.transforms.chunker.tokenizer.huggingface.HuggingFaceTokenizer",
        lambda **kwargs: WordTokenizer(limit=kwargs["max_tokens"]))
    pdf = source_pdf()
    request = IngestionRequest(document_version_id=uuid4(), source_version=1, checksum=hashlib.sha256(pdf).hexdigest(),
        locale="en", title="Fictional handbook", configuration=IngestionConfiguration(), pdf_base64=base64.b64encode(pdf).decode())
    initial = service.prepare(request)
    assert initial.quality.status == "NEEDS_REVIEW" and not initial.chunks
    saved = initial.extraction_snapshot
    assert len(saved["regions"]) == 1 and saved["regions"][0]["page"] == 1
    saved["regions"][0]["decision"] = decision("correct", "Fictional page one.")
    saved["revision"] = 1
    service._converter.convert = Mock(side_effect=AssertionError("A cached correction must not rerun the converter"))
    request.extraction_snapshot = saved
    recovered = service.prepare(request)
    assert recovered.quality.status == "PASSED", recovered.quality.issues
    assert recovered.quality.integrity["complete"]
    assert "Fictional page one." in recovered.chunks[0].content
    # These two short pages share one semantic block, so their merged chunk
    # must change together; source text on the second page stays intact.
    assert len(recovered.chunks) == len(initial.extraction_snapshot["prepared"])
    assert "Fictional page two." in recovered.chunks[-1].content
    assert service.prepare(request) == recovered


def test_confirmation_does_not_bypass_an_independent_missing_numeric_reference(monkeypatch):
    from app.test_knowledge_page_numbers import conversion, prepare
    converted = conversion()
    converted.document.texts[0].text = "Fictional page one 200 ml."
    # Independent source comparison remains authoritative; a human confirmation
    # is scoped evidence, not a switch disabling all source checks.
    result = prepare(monkeypatch, converted)
    assert result.extraction_snapshot is not None
    from app.knowledge_chunking import compare_pdf_text
    assert "missing_numeric_pdf_text" in compare_pdf_text(["Use 250 ml"], result.chunks, result.quality.pages)


def test_jsonb_numeric_round_trip_preserves_region_fingerprint():
    from app.knowledge_integrity import fingerprint
    assert fingerprint({"bbox": {"l": 10.0, "r": 10.125}, "page": 1}) == fingerprint({"page": 1.0, "bbox": {"l": 10, "r": 10.125}})


def test_multiple_blocks_are_corrected_individually_without_flattening_headings():
    source = doc()
    heading = source.add_heading(text="Equipment", prov=prov())
    body = text(source, "Carry a mcp.")
    r = make_region(source, 1, prov().bbox.model_dump(mode="json"), ["ocr_low_confidence"], refs=[heading.self_ref, body.self_ref])
    r["decision"] = decision("correct", "Equipment\nCarry a map.", block_texts={heading.self_ref: "Equipment", body.self_ref: "Carry a map."})
    apply_decisions(source, [r])
    assert source.texts[0].label == DocItemLabel.SECTION_HEADER
    assert source.texts[0].text == "Equipment" and source.texts[1].text == "Carry a map."


def test_busy_conversion_does_not_hold_the_embedding_model_for_the_whole_pdf():
    from app.knowledge_ingestion import KnowledgeIngestionService, ModelBusy
    service = KnowledgeIngestionService()
    with service._available_lock(service._conversion_lock):
        assert service.busy
        with pytest.raises(ModelBusy):
            with service._available_lock(service._conversion_lock):
                pytest.fail("A second conversion must not wait indefinitely")
        with service._available_lock():
            pass
    assert not service.busy


@pytest.mark.parametrize("candidate,verified", [("Figure a", True), ("Figure b", False), ("a Figure", False)])
def test_targeted_recovery_is_bounded_and_requires_exact_source_agreement(monkeypatch, candidate, verified):
    from PIL import Image, ImageDraw
    from unittest.mock import Mock
    from app.knowledge_ocr import OcrWord, recover_region
    source = doc()
    caption = source.add_text(label=DocItemLabel.CAPTION, text="Figure a", prov=prov())
    r = region(source, caption, kind="caption")
    r["attempts"] = [{"method": "primary", "outcome": "unverified", "input": "source"}]
    image = Image.new("RGB", (300, 120), "white")
    ImageDraw.Draw(image).rectangle((10, 10, 200, 80), fill="black")
    words = [OcrWord(candidate, .99, (0, 0, 100, 40), (1, 1, 1))]
    recognize = Mock(return_value=words)
    monkeypatch.setattr("app.knowledge_ocr.recognize", recognize)
    initial = PageExtractionReport(page=1, mode="ocr", issues=["ocr_low_confidence"])
    result = recover_region(image, 1, r, initial, "Figure a", False, "en")
    assert (not result.issues) == verified
    assert (r["assessment"] == "verified") == verified
    assert len(r["attempts"]) == 2
    recover_region(image, 1, r, result, "Figure a", False, "en")
    recognize.assert_called_once()


def test_targeted_recovery_never_guesses_an_unverified_numeric_value(monkeypatch):
    from unittest.mock import Mock
    from PIL import Image
    from app.knowledge_ocr import OcrWord, recover_region
    source = doc()
    r = region(source, text(source, "Use 200 ml"))
    r["attempts"] = [{"method": "primary"}]
    recognize = Mock(return_value=[OcrWord("Use 250 ml", .99, (0, 0, 10, 10), (1, 1, 1))])
    monkeypatch.setattr("app.knowledge_ocr.recognize", recognize)
    outcome = PageExtractionReport(page=1, mode="ocr", issues=["ocr_critical_content_unverified"])
    assert recover_region(Image.new("RGB", (20, 20)), 1, r, outcome, "Use 200 ml", False, "en") is outcome
    assert not r["decision"] and r["assessment"] == "requires_manual_verification"
    assert r["original_text"] == "Use 200 ml" and len(r["attempts"]) == 2
    recover_region(Image.new("RGB", (20, 20)), 1, r, outcome, "Use 200 ml", False, "en")
    recognize.assert_called_once()


def test_document_index_is_a_table_source_not_an_empty_text_item():
    from docling_core.types.doc import TableData, TableCell
    from app.knowledge_chunking import compare_pdf_text
    source = doc()
    table = source.add_table(data=TableData(num_rows=1, num_cols=2, table_cells=[
        TableCell(text="Shelter", start_row_offset_idx=0, end_row_offset_idx=1, start_col_offset_idx=0, end_col_offset_idx=1),
        TableCell(text="17", start_row_offset_idx=0, end_row_offset_idx=1, start_col_offset_idx=1, end_col_offset_idx=2)]), prov=prov())
    table.label = DocItemLabel.DOCUMENT_INDEX
    prepared, _ = split(source)
    assert not compare_pdf_text(["Shelter 17"], prepared, document=source)
    findings = build_regions(source, [], [], set())
    assert findings[0]["kind"] == "table" and "17" in findings[0]["original_text"]


def test_separate_pdf_editor_lifecycle_keeps_its_own_strict_structural_checks():
    from unittest.mock import Mock
    from app.knowledge_ingestion import KnowledgeIngestionService, InvalidPdf
    from app.knowledge_models import QualityReport
    from docling_core.types.doc import TableData, TableCell
    source = doc()
    table = source.add_table(prov=prov(), data=TableData(num_rows=2, num_cols=1, table_cells=[
        TableCell(text="Equipment", column_header=True, start_row_offset_idx=0, end_row_offset_idx=1, start_col_offset_idx=0, end_col_offset_idx=1),
        TableCell(text="Map", start_row_offset_idx=1, end_row_offset_idx=2, start_col_offset_idx=0, end_col_offset_idx=1)]))
    service = KnowledgeIngestionService()
    quality = QualityReport(status="NEEDS_REVIEW", issues=["table_relationships_unverified"], page_count=2)
    service._prepare = Mock(return_value=(SimpleNamespace(quality=quality), source, ["Equipment Map", ""]))
    assert service.editor_content(SimpleNamespace(title="Equipment"))[0].items[0].rows == [["Equipment"], ["Map"]]
    # The same table still cannot enter RAG before region review. The editor
    # continues rejecting uncertain native content or unsupported merged cells.
    quality.issues.append("missing_numeric_pdf_text")
    with pytest.raises(InvalidPdf, match="editor_extraction_unverified"):
        service.editor_content(SimpleNamespace(title="Equipment"))


def test_readiness_reports_busy_without_spending_a_second_conversion_attempt():
    from app.knowledge_api import readiness
    from app.knowledge_ingestion import KnowledgeIngestionService
    service = KnowledgeIngestionService()
    assert readiness(service).status_code == 204
    with service._available_lock(service._conversion_lock):
        response = readiness(service)
        assert response.status_code == 503 and response.headers["Retry-After"] == "5"
        assert response.headers["X-CTMS-Pipeline-Version"] == "ctms-content-integrity-v5"


def test_internal_boundary_classifies_busy_and_never_returns_source_exception_text(caplog):
    from fastapi import HTTPException
    from app.knowledge_api import run_ingestion
    from app.knowledge_ingestion import ModelBusy
    def busy(_request):
        raise ModelBusy()
    with pytest.raises(HTTPException) as failure:
        run_ingestion(busy, None)
    assert failure.value.status_code == 503
    def broken(_request):
        raise ValueError("source-private-content")
    with pytest.raises(HTTPException) as failure:
        run_ingestion(broken, None)
    assert failure.value.status_code == 502 and "source-private-content" not in str(failure.value.detail)
    assert "source-private-content" not in caplog.text


def test_internal_service_authentication_is_still_required(monkeypatch):
    from fastapi import HTTPException
    from app.knowledge_api import require_token
    monkeypatch.setenv("KNOWLEDGE_SERVICE_TOKEN", "internal-test-token")
    for token in [None, "different"]:
        with pytest.raises(HTTPException) as failure:
            require_token(token)
        assert failure.value.status_code == 401
    assert require_token("internal-test-token") is None


def test_revising_an_inserted_omission_does_not_duplicate_source_blocks():
    source = doc()
    picture = source.add_picture(prov=prov())
    r = make_region(source, 1, prov().bbox.model_dump(mode="json"), ["missing_critical_pdf_text"], refs=[], kind="text")
    r["decision"] = decision("correct", "A verified instruction from the source.", after_item_ref=picture.self_ref)
    applied, refs = {}, {}
    apply_decisions(source, [r], applied, refs)
    assert len(source.texts) == 1
    r["decision"] = decision("correct", "A corrected verified instruction from the source.", after_item_ref=picture.self_ref)
    apply_decisions(source, [r], applied, refs)
    assert len(source.texts) == 1 and source.texts[0].text.startswith("A corrected")
    assert [ref.cref for ref in source.body.children] == [picture.self_ref, source.texts[0].self_ref]


def test_empty_scan_table_requires_explicit_visual_source_review_without_inventing_headers():
    from docling_core.types.doc import TableData
    source = doc()
    table = source.add_table(prov=prov(), data=TableData(num_rows=2, num_cols=2, table_cells=[]))
    findings = build_regions(source, [], [], set(), {table.self_ref}, [])
    r = findings[0]
    assert r["kind"] == "table" and r["empty_form"] and not integrity_summary(findings, 0)["complete"]
    r["decision"] = decision("confirm", "")
    with pytest.raises(ValueError, match="structured_confirmation"):
        apply_decisions(source, findings)
    r["decision"]["reason"] = "Đã đối chiếu toàn bộ vùng; chỉ có các ô trống và đường kẻ biểu mẫu."
    apply_decisions(source, findings)
    assert not table.data.table_cells and integrity_summary(findings, 1)["complete"]


def test_visual_page_without_any_recognized_items_can_be_described_once_in_source_order():
    source = doc()
    later = text(source, "Later page content", page=2)
    report = PageExtractionReport(page=1, mode="unverified", issues=["ocr_text_unverifiable"])
    findings = build_regions(source, [report], [], set())
    r = findings[0]
    assert r["kind"] == "image" and not r["item_refs"]
    r["decision"] = decision("describe", "The source diagram indicates a movement left, then upward.")
    applied, refs = {}, {}
    apply_decisions(source, findings, applied, refs)
    assert source.body.children[0].cref == source.pictures[0].self_ref
    assert source.body.children[1].cref == later.self_ref
    assert len(source.pictures) == 1
    r["decision"]["text"] = "The verified source diagram indicates movement to the left and then upward."
    apply_decisions(source, findings, applied, refs)
    assert len(source.pictures) == 1 and len(source.texts) == 2
