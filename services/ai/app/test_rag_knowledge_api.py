"""CTMS-068 private HTTP and pinned-query-encoder regression tests."""

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.knowledge_api import app, get_service
from app.knowledge_ingestion import KnowledgeIngestionService
from app.knowledge_models import EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, EMBEDDING_REVISION

client = TestClient(app)
HEADERS = {"X-CTMS-Knowledge-Token": "rag-test-token"}
VECTOR = [1.0] + [0.0] * (EMBEDDING_DIMENSIONS - 1)


@pytest.fixture
def model(monkeypatch):
    monkeypatch.setenv("KNOWLEDGE_SERVICE_TOKEN", "rag-test-token")
    service = KnowledgeIngestionService()
    model = MagicMock()
    model.tokenizer.encode.side_effect = lambda text, **_: list(range(len(text)))
    model.encode.return_value.tolist.return_value = [VECTOR]
    service._model = model
    app.dependency_overrides[get_service] = lambda: service
    yield service, model
    app.dependency_overrides.pop(get_service, None)


@pytest.mark.parametrize("path,payload", [
    ("/query-embedding", {"question": "private"}),
    ("/context-token-counts", {"blocks": ['{"content":"private"}']}),
])
def test_requires_internal_token(model, path, payload, monkeypatch):
    assert client.post(path, json=payload).status_code == 401
    assert client.post(path, json=payload, headers={"X-CTMS-Knowledge-Token": "wrong"}).status_code == 401
    monkeypatch.delenv("KNOWLEDGE_SERVICE_TOKEN")
    assert client.post(path, json=payload, headers=HEADERS).status_code == 503
    model[1].encode.assert_not_called()


def test_uses_pinned_query_format_and_normalization(model):
    response = client.post("/query-embedding", json={"question": "  Nội dung thử nghiệm?  "}, headers=HEADERS)
    assert response.status_code == 200
    assert response.json() == {
        "model": EMBEDDING_MODEL,
        "revision": EMBEDDING_REVISION,
        "dimensions": EMBEDDING_DIMENSIONS,
        "embedding": VECTOR,
    }
    model[1].encode.assert_called_once_with(
        ["query: Nội dung thử nghiệm?"], normalize_embeddings=True, show_progress_bar=False
    )


def test_accepts_query_at_the_exact_embedding_token_limit(model):
    question = "x" * 473
    response = client.post("/query-embedding", json={"question": question}, headers=HEADERS)
    assert response.status_code == 200
    model[1].tokenizer.encode.assert_called_once_with(
        "query: " + question, add_special_tokens=True, truncation=False
    )


def test_counts_complete_json_prefixes_including_framing(model):
    blocks = ['{"chunkId":"1","content":"cảnh báo"}', '{"chunkId":"2","content":"điều kiện"}']
    response = client.post("/context-token-counts", json={"blocks": blocks}, headers=HEADERS)
    assert response.status_code == 200
    assert response.json()["counts"] == [len(f"[{blocks[0]}]"), len("[" + ",".join(blocks) + "]")]
    assert response.json()["tokenizer"] == "e5-sentencepiece"
    model[1].tokenizer.encode.assert_called_with(
        "[" + ",".join(blocks) + "]", add_special_tokens=False, truncation=False
    )


@pytest.mark.parametrize("payload", [
    {"question": " "}, {"question": "x" * 474}, {"question": "private" * 300},
    {"question": "secret", "documents": ["forged"]},
])
def test_rejects_invalid_question_without_echoing_it(model, payload):
    response = client.post("/query-embedding", json=payload, headers=HEADERS)
    assert response.status_code == 422
    assert response.json() == {"detail": {"code": "invalid_query"}}
    model[1].encode.assert_not_called()


def test_rejects_large_request_before_model_use(model):
    response = client.post("/query-embedding", json={"question": "x" * 20_000}, headers=HEADERS)
    assert response.status_code == 413
    model[1].encode.assert_not_called()


def test_rejects_bad_vector_and_busy_model_with_sanitized_errors(model):
    service, encoder = model
    encoder.encode.return_value.tolist.return_value = [[float("nan")] * EMBEDDING_DIMENSIONS]
    response = client.post("/query-embedding", json={"question": "secret"}, headers=HEADERS)
    assert response.status_code == 502
    assert response.json() == {"detail": {"code": "query_embedding_failed"}}
    with service._lock:
        response = client.post("/query-embedding", json={"question": "secret"}, headers=HEADERS)
    assert response.status_code == 503
    assert response.json() == {"detail": {"code": "knowledge_model_busy"}}
