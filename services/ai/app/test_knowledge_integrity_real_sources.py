"""Opt-in regressions for the actual original PDFs, without application DB writes.

Provide CTMS_TRIP_PDF and CTMS_DISASTER_PDF explicitly; originals are not copied
into fixtures or committed. Never simulate human approval of these real sources.
"""
import base64
import hashlib
import os
from pathlib import Path
from uuid import uuid4

import pytest

from app.knowledge_ingestion import KnowledgeIngestionService
from app.knowledge_models import IngestionConfiguration, IngestionRequest

pytestmark = pytest.mark.skipif(os.environ.get("RUN_KNOWLEDGE_SOURCE_REGRESSION") != "true",
    reason="Requires the explicitly selected original PDFs and provisioned local OCR models")


@pytest.fixture(scope="module")
def service():
    return KnowledgeIngestionService()


def prepare(service, variable, title, locale):
    path = Path(os.environ[variable])
    pdf = path.read_bytes()
    checksum = hashlib.sha256(pdf).hexdigest()
    result = service.prepare(IngestionRequest(document_version_id=uuid4(), source_version=1,
        checksum=checksum, locale=locale, title=title, configuration=IngestionConfiguration(),
        pdf_base64=base64.b64encode(pdf).decode()))
    assert hashlib.sha256(path.read_bytes()).hexdigest() == checksum
    assert result.extraction_snapshot["checksum"] == checksum
    return result


def test_original_trip_illustrations_do_not_silently_become_verified_knowledge(service):
    result = prepare(service, "CTMS_TRIP_PDF", "Trip planning guide", "en")
    assert result.quality.page_count == 12
    assert result.quality.status == "NEEDS_REVIEW" and not result.chunks
    assert result.extraction_snapshot["prepared"]
    images = [r for r in result.extraction_snapshot["regions"] if r["kind"] == "image"]
    assert images and all(not r["decision"] and r["critical"] for r in images)
    assert not result.quality.integrity["complete"]


def test_original_disaster_caption_and_labels_have_bounded_local_source_issues(service):
    result = prepare(service, "CTMS_DISASTER_PDF", "Phòng ngừa thảm họa", "vi")
    assert result.quality.page_count == 40
    assert result.quality.status == "NEEDS_REVIEW" and not result.chunks
    regions = result.extraction_snapshot["regions"]
    for page in [17, 31, 35, 36]:
        findings = [r for r in regions if r["page"] == page and "ocr_low_confidence" in r["issues"]]
        assert findings, (page, regions)
        assert all(r["bbox"]["r"] > r["bbox"]["l"] and r["bbox"]["b"] > r["bbox"]["t"] for r in findings)
        assert all(1 <= len(r["attempts"]) <= 2 for r in findings)
    italic = [r for r in regions if r["page"] == 17 and r["kind"] == "caption"]
    assert italic and any(r["assessment"] == "requires_manual_verification" for r in italic)
    labels = [r for r in regions if r["page"] in [31, 35, 36] and r["kind"] == "caption"]
    assert labels and all(not r["critical"] for r in labels)
    assert any(r["assessment"] == "verified" for r in labels)
    assert any(r["kind"] == "image" and r["page"] in [31, 35, 36] for r in regions)
    # A Docling document_index contains actual source cells, not empty text.
    assert "missing_numeric_pdf_text" not in result.quality.pages[2].issues
