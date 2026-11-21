"""Actual Docling OCR + HybridChunker + E5 integration, never a fake OCR service.

Set RUN_KNOWLEDGE_OCR_INTEGRATION=true after provisioning the documented runtime.
When opted in, missing runtime/models are errors, not skipped tests.
"""

import base64
import copy
import hashlib
import json
import os
import re
import socket
from pathlib import Path
from uuid import uuid4

import pytest
from pypdf import PdfReader

from app.knowledge_ingestion import KnowledgeIngestionService
from app.knowledge_models import IngestionConfiguration, IngestionRequest

ROOT = Path(__file__).parent / "fixtures" / "ocr"
GROUND_TRUTH = json.loads((ROOT / "ground_truth.json").read_text(encoding="utf-8"))
pytestmark = pytest.mark.skipif(os.environ.get("RUN_KNOWLEDGE_OCR_INTEGRATION") != "true",
                                reason="Requires provisioned real OCR and pinned Docling/E5 models")


@pytest.fixture(scope="module")
def service():
    return KnowledgeIngestionService()


@pytest.fixture(autouse=True)
def forbid_network(monkeypatch):
    # Real OCR tests use prefetched artifacts. Neither PDF content nor telemetry
    # may leave this process, even if a transitive library enables tracking.
    def deny(*args, **kwargs):
        raise AssertionError("OCR integration tests must run without network access")
    monkeypatch.setattr(socket.socket, "connect", deny)
    monkeypatch.setattr(socket, "create_connection", deny)


def request(name):
    pdf = (ROOT / name).read_bytes()
    locale = "en" if name in {"scan-en.pdf", "scan-table.pdf", "scan-warning.pdf", "mixed-page.pdf", "scan-unreadable.pdf"} else "vi"
    return IngestionRequest(document_version_id=uuid4(), source_version=1,
                            checksum=hashlib.sha256(pdf).hexdigest(), locale=locale,
                            title="Fictional handbook", configuration=IngestionConfiguration(),
                            pdf_base64=base64.b64encode(pdf).decode())


def verify_uncertain_vietnamese_source(service, payload, result, name, monkeypatch):
    """Exercise human review using literal fixture text, never OCR suggestions.

    Tesseract's crop confidence varies between Linux and Windows builds. A
    low-confidence source must remain blocked until the source-bound review is
    applied; an assertion demanding automatic PASSED would bypass that policy.
    """
    from docling_core.types.doc import BoundingBox

    truth = GROUND_TRUTH["sources"][name]
    assert payload.checksum == truth["sha256"]
    assert result.quality.status == "NEEDS_REVIEW"
    assert result.quality.issues == ["ocr_low_confidence"], result.quality.model_dump()
    assert not result.chunks and not result.quality.integrity["complete"]
    saved = copy.deepcopy(result.extraction_snapshot)
    pending = [r for r in saved["regions"] if r["assessment"] != "verified"]
    assert pending
    for region in pending:
        assert region["page"] == truth["vietnamese_page"]
        assert region["issues"] == ["ocr_low_confidence"]
        assert region["kind"] in {"text", "caption", "page"}
        assert 1 <= len(region["attempts"]) <= 2
        assert len({a["method"] for a in region["attempts"]}) == len(region["attempts"])
        box = BoundingBox.model_validate(region["bbox"])
        assert 0 <= box.l < box.r <= 595 and 0 <= box.t < box.b <= 842

    with monkeypatch.context() as review:
        def forbidden(*args, **kwargs):
            pytest.fail("Cached verification must not repeat PDF conversion or OCR")
        review.setattr(service._converter, "convert", forbidden)
        review.setattr("app.knowledge_ocr.recognize", forbidden)
        with monkeypatch.context() as unverified:
            unverified.setattr(service, "embed_passages", lambda *args, **kwargs:
                               pytest.fail("Unverified content must not generate embeddings"))
            payload.extraction_snapshot = copy.deepcopy(saved)
            blocked = service.generate(payload)
            assert blocked.quality.status == "NEEDS_REVIEW" and not blocked.chunks

        items = {item["self_ref"]: item for item in saved["document"]["texts"]}
        corrected = {}
        for region in pending:
            replacements = {}
            for ref in region["item_refs"]:
                if ref not in items:
                    continue
                item = items[ref]
                prov = [p for p in item["prov"] if p["page_no"] == truth["vietnamese_page"]]
                assert len(prov) == 1
                box = BoundingBox.model_validate(prov[0]["bbox"]).to_top_left_origin(842)
                # Independent source coordinates select literal lines. No fuzzy
                # match or correction inferred from a misspelled OCR word.
                lines = [line["text"] for line in GROUND_TRUTH["lines"] if box.t <= line["y"] <= box.b]
                assert lines, (ref, box)
                value = "\n".join(lines)
                if item["label"] == "list_item" and item.get("enumerated"):
                    value = re.sub(r"^\d+\.\s*", "", value)
                replacements[ref] = value
            assert replacements
            value = "\n".join(replacements.values())
            region["decision"] = dict(action="correct", text=value, block_texts=replacements,
                source_checked=True, context_checked=True, visual_checked=True)
            corrected.update(replacements)
        saved["revision"] += 1
        payload.extraction_snapshot = saved
        reviewed = service.prepare(payload)
        assert reviewed.quality.status == "PASSED", reviewed.quality.model_dump()
        assert reviewed.quality.integrity["complete"]
        assert reviewed.checksum == result.checksum == truth["sha256"]
        assert reviewed.document_version_id == result.document_version_id
        restored = {item["self_ref"]: item for item in reviewed.extraction_snapshot["document"]["texts"]}
        for ref, value in corrected.items():
            assert restored[ref]["text"] == value
            # Docling serializes paragraph line breaks as spaces. Preserve
            # every literal letter, accent, number and ordering in this check.
            assert any(" ".join(value.split()) in " ".join("\n".join([*c.headings, c.content]).split())
                       for c in reviewed.chunks)
        for ref, item in items.items():
            if ref not in corrected:
                assert restored[ref] == item
        assert service.prepare(payload) == reviewed
        assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == truth["sha256"]
        return reviewed


@pytest.mark.parametrize("name,expected", [
    ("scan-vi.pdf", "tiếng Việt"), ("scan-en.pdf", "Equipment"),
    ("scan-multipage.pdf", "tiếng Việt"), ("scan-blank.pdf", "tiếng Việt"),
    ("scan-warning.pdf", "WARNING"),
    ("mixed.pdf", "tiếng Việt"), ("mixed-page.pdf", "Equipment"),
])
def test_real_ocr_preserves_source_text_locations_budget_and_determinism(service, name, expected, monkeypatch):
    source = PdfReader(ROOT / name)
    if name.startswith("scan-"):
        assert all(not page.extract_text().strip() for page in source.pages)
        assert any(page.images for page in source.pages)
    payload = request(name)
    result = service.prepare(payload)
    # Only the known Vietnamese source with an isolated confidence finding may
    # enter review. Unexpected omissions, numbers, visuals or tables still fail.
    if result.quality.status == "NEEDS_REVIEW" and name in GROUND_TRUTH["sources"]:
        assert service.prepare(payload) == result
        result = verify_uncertain_vietnamese_source(service, payload, result, name, monkeypatch)
    assert result.quality.status == "PASSED", result.quality.model_dump()
    assert expected in "\n".join(c.embedding_text for c in result.chunks)
    assert all(0 < c.token_count <= 480 and c.locations for c in result.chunks)
    assert {loc.page for c in result.chunks for loc in c.locations} == (
        {1, 3} if name == "scan-blank.pdf" else set(range(1, len(source.pages) + 1)))
    for chunk in result.chunks:
        for loc in chunk.locations:
            assert loc.item_ref.startswith("#/")
            assert loc.bbox.r > loc.bbox.l >= 0 and loc.bbox.t != loc.bbox.b
    again = service.prepare(payload)
    assert result == again
    if name == "scan-blank.pdf":
        assert result.quality.pages[1].mode == "blank"
    if name == "scan-table.pdf":
        assert all(value in " ".join(c.content for c in result.chunks) for value in ["Sample", "Value", "ml", "250", "500"])
    if name == "scan-en.pdf":
        assert any(c.headings for c in result.chunks)
        embedded = service.generate(payload)
        assert embedded.quality.status == "PASSED"
        assert all(len(c.embedding) == 384 for c in embedded.chunks)


@pytest.mark.parametrize("name", GROUND_TRUTH["sources"])
def test_low_confidence_real_scan_stays_blocked_until_literal_source_review(service, monkeypatch, name):
    """Fault injection exercises review even on builds that read this scan well."""
    from dataclasses import replace
    from app.knowledge_ocr import recognize

    primary_calls = 0
    def uncertain(*args, **kwargs):
        nonlocal primary_calls
        actual = recognize(*args, **kwargs)
        if kwargs.get("psm") != 13:
            primary_calls += 1
        # Leave the title alone and exercise the following Vietnamese body
        # region, including its correction and unchanged neighbouring blocks.
        if actual and primary_calls == 2:
            return [replace(actual[0], confidence=min(actual[0].confidence, .715)), *actual[1:]]
        return actual

    with monkeypatch.context() as evidence:
        # The real engine still reads the unchanged PDF. Inject unreliable
        # confidence, rather than mocking validation or accepting bad content.
        evidence.setattr("app.knowledge_ocr.recognize", uncertain)
        payload = request(name)
        result = service.prepare(payload)
    page = GROUND_TRUTH["sources"][name]["vietnamese_page"]
    assert result.quality.pages[page - 1].minimum_confidence <= .715
    reviewed = verify_uncertain_vietnamese_source(service, payload, result, name, monkeypatch)
    assert reviewed.chunks


def test_unreadable_real_scan_never_generates_embeddings(service, monkeypatch):
    def forbidden(*args, **kwargs):
        pytest.fail("Unverified OCR must not reach embedding")
    monkeypatch.setattr(service, "embed_passages", forbidden)
    result = service.generate(request("scan-unreadable.pdf"))
    assert result.quality.status == "NEEDS_REVIEW" and result.quality.issues
    assert not result.chunks


def test_real_raster_table_requires_verified_row_column_relationships(service, monkeypatch):
    payload = request("scan-table.pdf")
    result = service.prepare(payload)
    assert result.quality.status == "NEEDS_REVIEW" and not result.chunks
    saved = result.extraction_snapshot
    tables = [r for r in saved["regions"] if r["kind"] == "table"]
    assert len(tables) == 1, saved["regions"]
    assert not tables[0]["excludable"]
    # Literal ground truth from fixtures/ocr/generate.py; no inferred values.
    tables[0]["decision"] = dict(action="correct", text="| Sample | Value ml |\n| --- | --- |\n| Alpha | 250 |\n| Beta | 500 |",
        source_checked=True, context_checked=True, visual_checked=True)
    saved["revision"] = 1
    payload.extraction_snapshot = saved
    monkeypatch.setattr(service._converter, "convert", lambda *args, **kwargs: pytest.fail("Review must use the cached extraction"))
    reviewed = service.prepare(payload)
    assert reviewed.quality.status == "PASSED", reviewed.quality.model_dump()
    assert reviewed.quality.integrity["complete"]
    content = "\n".join(c.content for c in reviewed.chunks)
    assert "Alpha" in content and "250" in content and "Beta" in content and "500" in content


def test_visual_only_instruction_requires_a_sourced_human_description(service, monkeypatch):
    payload = request("visual-only.pdf")
    result = service.prepare(payload)
    assert result.quality.status == "NEEDS_REVIEW" and not result.chunks
    saved = result.extraction_snapshot
    assert saved["regions"] and all(r["kind"] == "image" for r in saved["regions"]), saved["regions"]
    # Literal ground truth: the fixture path travels left then upward. The
    # system does not derive this interpretation from confidence or an LLM.
    for region in saved["regions"]:
        region["decision"] = dict(action="describe", text="Sơ đồ chỉ hướng di chuyển sang trái, sau đó đi lên.",
            source_checked=True, context_checked=True, visual_checked=True)
    saved["revision"] = 1
    payload.extraction_snapshot = saved
    monkeypatch.setattr(service._converter, "convert", lambda *args, **kwargs: pytest.fail("Verification must resume the saved source"))
    reviewed = service.prepare(payload)
    assert reviewed.quality.status == "PASSED", reviewed.quality.model_dump()
    assert reviewed.quality.pages[0].mode == "manual"
    assert "sang trái" in "\n".join(c.content for c in reviewed.chunks)
