from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.survival_answers import GenerationInput, Selection, provider_config, require_token


def test_selection_requires_distinct_ids_and_consistent_status():
    chunk_id = uuid4()
    assert Selection(status="ANSWERED", chunkIds=[chunk_id]).chunkIds == [chunk_id]
    for status, ids in [("ANSWERED", []), ("ANSWERED", [chunk_id, chunk_id]), ("REFUSED", [chunk_id])]:
        with pytest.raises(ValidationError):
            Selection(status=status, chunkIds=ids)


def test_input_preserves_vietnamese_evidence_and_rejects_duplicate_chunks():
    chunk = {"chunkId": uuid4(), "headings": ["Bản đồ"], "content": "Đọc chú giải trước."}
    request = {"question": "Cách đọc bản đồ?", "locale": "vi", "evidence": [chunk]}
    assert GenerationInput.model_validate(request).evidence[0].content == chunk["content"]
    with pytest.raises(ValidationError):
        GenerationInput.model_validate(request | {"evidence": [chunk, chunk]})


def test_internal_token_uses_only_survival_configuration(monkeypatch):
    monkeypatch.setenv("AI_REVIEW_SERVICE_TOKEN", "review-token")
    monkeypatch.delenv("AI_SURVIVAL_SERVICE_TOKEN", raising=False)
    with pytest.raises(HTTPException) as missing:
        require_token("review-token")
    assert missing.value.status_code == 503
    monkeypatch.setenv("AI_SURVIVAL_SERVICE_TOKEN", "survival-token")
    with pytest.raises(HTTPException) as unauthorized:
        require_token("review-token")
    assert unauthorized.value.status_code == 401
    assert require_token("survival-token") is None


@pytest.mark.parametrize(("provider", "key_name"), [
    ("openai", "OPENAI_API_KEY"),
    ("gemini", "GEMINI_API_KEY"),
])
def test_provider_uses_explicit_model_and_correct_key(monkeypatch, provider, key_name):
    monkeypatch.setenv("AI_SURVIVAL_PROVIDER", provider)
    monkeypatch.setenv("AI_SURVIVAL_MODEL", "selected-model")
    monkeypatch.setenv("AI_SURVIVAL_LLM_TIMEOUT_MS", "3000")
    monkeypatch.setenv(key_name, "expected-key")
    assert provider_config() == (provider, "selected-model", "expected-key", 3)
    monkeypatch.setenv("AI_SURVIVAL_LLM_TIMEOUT_MS", "99999")
    with pytest.raises(HTTPException) as unavailable:
        provider_config()
    assert unavailable.value.detail == {"code": "AI_UNAVAILABLE"}
