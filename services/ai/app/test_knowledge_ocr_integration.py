"""Actual Docling OCR + HybridChunker + E5 integration, never a fake OCR service.

Set RUN_KNOWLEDGE_OCR_INTEGRATION=true after provisioning the documented runtime.
When opted in, missing runtime/models are errors, not skipped tests.
"""

import base64
import hashlib
import os
import socket
from pathlib import Path
from uuid import uuid4

import pytest
from pypdf import PdfReader

from app.knowledge_ingestion import KnowledgeIngestionService
from app.knowledge_models import IngestionConfiguration, IngestionRequest

ROOT = Path(__file__).parent / "fixtures" / "ocr"
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


@pytest.mark.parametrize("name,expected", [
    ("scan-vi.pdf", "tiếng Việt"), ("scan-en.pdf", "Equipment"),
    ("scan-multipage.pdf", "tiếng Việt"), ("scan-blank.pdf", "tiếng Việt"),
    ("scan-warning.pdf", "WARNING"),
    ("mixed.pdf", "tiếng Việt"), ("mixed-page.pdf", "Equipment"),
])
def test_real_ocr_preserves_source_text_locations_budget_and_determinism(service, name, expected):
    source = PdfReader(ROOT / name)
    if name.startswith("scan-"):
        assert all(not page.extract_text().strip() for page in source.pages)
        assert any(page.images for page in source.pages)
    payload = request(name)
    result = service.prepare(payload)
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
