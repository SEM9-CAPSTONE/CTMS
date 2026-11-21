import base64
import hashlib
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.knowledge_api import app, get_service
from app.knowledge_ingestion import InvalidEmbedding, InvalidPdf, KnowledgeIngestionService
from app.knowledge_models import IngestionConfiguration, IngestionRequest, PIPELINE_VERSION
from app.knowledge_ocr import OcrRuntimeError

client = TestClient(app)


def payload():
    pdf = b"%PDF-1.4\nFictional invalid test PDF"
    return dict(document_version_id=str(uuid4()), source_version=1, checksum=hashlib.sha256(pdf).hexdigest(),
                locale="vi-VN", title="Nguồn thử nghiệm", configuration=IngestionConfiguration().model_dump(),
                pdf_base64=base64.b64encode(pdf).decode())


@pytest.fixture(autouse=True)
def setup(monkeypatch):
    monkeypatch.setenv("KNOWLEDGE_SERVICE_TOKEN", "test-token")
    yield
    app.dependency_overrides.clear()


def test_authentication_and_configuration_required(monkeypatch):
    assert client.post("/knowledge-chunks", json=payload()).status_code == 401
    assert client.post("/knowledge-chunks", headers={"X-CTMS-Knowledge-Token": "wrong"}, json=payload()).status_code == 401
    monkeypatch.delenv("KNOWLEDGE_SERVICE_TOKEN")
    assert client.post("/knowledge-chunks", json=payload()).status_code == 503
    assert client.get("/readiness").status_code == 503


def test_readiness_checks_authentication_without_loading_the_model():
    assert client.get("/readiness").status_code == 401
    response = client.get("/readiness", headers={"X-CTMS-Knowledge-Token": "test-token"})
    assert response.status_code == 204
    assert response.headers["X-CTMS-Pipeline-Version"] == PIPELINE_VERSION
    assert not response.content


def test_read_error_returns_a_stable_issue():
    response = client.post("/knowledge-chunks", headers={"X-CTMS-Knowledge-Token": "test-token"}, json=payload())
    assert response.status_code == 422
    assert response.json()["detail"] == {"code": "invalid_pdf", "issue": "pdf_text_read_failed"}


def test_rejects_configuration_drift_before_processing():
    body = payload()
    body["configuration"]["embedding_revision"] = "main"
    assert client.post("/knowledge-chunks", headers={"X-CTMS-Knowledge-Token": "test-token"}, json=body).status_code == 422


@pytest.mark.parametrize("pipeline", ["ctms-hybrid-v1", "ctms-hybrid-ocr-v2"])
def test_legacy_pipeline_is_not_silently_processed_with_changed_extraction_rules(pipeline):
    body = payload()
    body["configuration"]["pipeline_version"] = pipeline
    assert client.post("/knowledge-chunks/prepare", headers={"X-CTMS-Knowledge-Token": "test-token"}, json=body).status_code == 422


def test_needs_review_preserves_exact_version_without_partial_vectors():
    body = payload()
    service = MagicMock()
    service.generate.return_value = {key: value for key, value in body.items() if key not in {"title", "pdf_base64"}}
    service.generate.return_value.update(quality={"status": "NEEDS_REVIEW", "issues": ["missing_critical_pdf_text"], "page_count": 1}, chunks=[])
    app.dependency_overrides[get_service] = lambda: service
    response = client.post("/knowledge-chunks", headers={"X-CTMS-Knowledge-Token": "test-token"}, json=body)
    assert response.status_code == 200
    assert response.json()["document_version_id"] == body["document_version_id"]
    assert response.json()["chunks"] == []
    assert response.json()["quality"]["status"] == "NEEDS_REVIEW"


@pytest.mark.parametrize("error,status,code", [(InvalidPdf("secret"), 422, "invalid_pdf"),
                                              (OcrRuntimeError("secret"), 503, "ocr_runtime_unavailable"),
                                              (InvalidEmbedding("secret"), 502, "invalid_embedding"),
                                              (RuntimeError("secret PDF content"), 502, "ingestion_failed")])
def test_failures_are_explicit_and_do_not_leak_source_content(error, status, code):
    service = MagicMock()
    service.generate.side_effect = error
    app.dependency_overrides[get_service] = lambda: service
    response = client.post("/knowledge-chunks", headers={"X-CTMS-Knowledge-Token": "test-token"}, json=payload())
    assert response.status_code == status
    assert response.json()["detail"] == {"code": code}


def test_internal_error_logs_identify_the_code_location_without_source_content(caplog):
    def failed_conversion(*args, **kwargs):
        raise IndexError("secret PDF text and token")
    service = MagicMock()
    service.prepare.side_effect = failed_conversion
    app.dependency_overrides[get_service] = lambda: service
    with caplog.at_level("ERROR", logger="app.knowledge_api"):
        response = client.post("/knowledge-chunks/prepare",
                               headers={"X-CTMS-Knowledge-Token": "test-token"}, json=payload())
    assert response.status_code == 502
    assert "error_type=IndexError" in caplog.text and "failed_conversion" in caplog.text
    assert "secret PDF text and token" not in caplog.text
    assert response.json()["detail"] == {"code": "ingestion_failed"}


def test_checksum_or_invalid_pdf_rejected_before_loading_models():
    service = KnowledgeIngestionService()
    service._load = MagicMock()
    body = payload()
    body["checksum"] = "0"*64
    with pytest.raises(InvalidPdf):
        service.generate(IngestionRequest(**body))
    body = payload()
    with pytest.raises(InvalidPdf):
        service.generate(IngestionRequest(**body))
    service._load.assert_not_called()


def test_private_split_ingestion_routes_keep_extraction_and_encoding_separate():
    body = payload()
    headers = {"X-CTMS-Knowledge-Token": "test-token"}
    service = MagicMock()
    service.prepare.return_value = {key: value for key, value in body.items() if key not in {"title", "pdf_base64"}}
    service.prepare.return_value.update(quality={"status": "NEEDS_REVIEW", "issues": ["missing_critical_pdf_text"], "page_count": 1}, chunks=[])
    service.embed_passages.return_value = [[1.0] + [0.0] * 383]
    app.dependency_overrides[get_service] = lambda: service

    assert client.post("/knowledge-chunks/prepare", json=body).status_code == 401
    prepared = client.post("/knowledge-chunks/prepare", headers=headers, json=body)
    assert prepared.status_code == 200
    assert prepared.json()["quality"]["status"] == "NEEDS_REVIEW"
    service.generate.assert_not_called()
    service.embed_passages.assert_not_called()

    passages = {"configuration": body["configuration"], "passages": ["passage: a"]}
    assert client.post("/passage-embeddings", json=passages).status_code == 401
    assert client.post("/passage-embeddings", headers=headers, json={**passages, "passages": ["query: a"]}).status_code == 422
    embedded = client.post("/passage-embeddings", headers=headers, json=passages)
    assert embedded.status_code == 200
    service.embed_passages.assert_called_once_with(["passage: a"], 384)
