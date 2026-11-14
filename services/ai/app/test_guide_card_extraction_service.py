"""Guide card extraction: only the OpenAI network edge is faked."""

import base64
import json
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.guide_card_extraction_service import (
    MAX_IMAGE_BYTES,
    SYSTEM_PROMPT,
    GuideCardExtractionRequest,
    GuideCardExtractionService,
    InvalidGuideCardOutput,
)
from app.main import app, get_guide_card_extraction_service

http = TestClient(app)
PNG = base64.b64encode(b"\x89PNG\r\n\x1a\nfake-card").decode()


def _client(content: str | None, model: str = "gemini-test") -> MagicMock:
    client = MagicMock()
    completion = MagicMock()
    completion.model = model
    completion.choices = [MagicMock(message=MagicMock(content=content))]
    client.chat.completions.create.return_value = completion
    return client


def _reading(**overrides) -> str:
    data = {
        "is_guide_card": True,
        "full_name": "NGUYỄN VĂN MẪU",
        "card_number": "000 000 000",
        "card_type": "noi_dia",
        "expires_on": "2030-01-01",
        "confidence": 0.9,
    }
    data.update(overrides)
    return json.dumps(data, ensure_ascii=False)


def test_extract_sends_the_image_and_normalizes_the_reading():
    client = _client(_reading())
    result = GuideCardExtractionService(client, model="m").extract(
        GuideCardExtractionRequest(image_base64=PNG, mime_type="image/png")
    )
    assert result.card_number == "000000000"
    assert result.card_type == "noi_dia"
    assert result.expires_on == "2030-01-01"
    assert result.model == "gemini-test"
    call = client.chat.completions.create.call_args.kwargs
    assert call["temperature"] == 0
    assert call["messages"][0]["content"] == SYSTEM_PROMPT
    image = call["messages"][1]["content"][1]["image_url"]["url"]
    assert image.startswith("data:image/png;base64,")


def test_reading_can_say_it_is_not_a_card():
    result = GuideCardExtractionService(_client(_reading(is_guide_card=False, full_name=None, card_number=None, card_type="unknown", expires_on=None, confidence=0.2))).extract(
        GuideCardExtractionRequest(image_base64=PNG, mime_type="image/png")
    )
    assert result.is_guide_card is False
    assert result.card_number is None


@pytest.mark.parametrize("content", [None, "not json", _reading(expires_on="01/01/2030"), _reading(card_type="other"), _reading(confidence=2)])
def test_invalid_model_output_is_rejected(content):
    with pytest.raises(InvalidGuideCardOutput):
        GuideCardExtractionService(_client(content)).extract(GuideCardExtractionRequest(image_base64=PNG, mime_type="image/png"))


@pytest.mark.parametrize(
    "payload",
    [
        {"image_base64": PNG, "mime_type": "application/pdf"},
        {"image_base64": "%%%not-base64%%%", "mime_type": "image/png"},
        {"image_base64": base64.b64encode(b"x" * (MAX_IMAGE_BYTES + 1)).decode(), "mime_type": "image/png"},
        {"image_base64": PNG, "mime_type": "image/png", "extra": 1},
    ],
)
def test_request_validation(payload):
    with pytest.raises(ValueError):
        GuideCardExtractionRequest(**payload)


def test_endpoint_requires_the_token_and_maps_bad_output(monkeypatch):
    monkeypatch.setenv("AI_REVIEW_SERVICE_TOKEN", "secret")
    body = {"image_base64": PNG, "mime_type": "image/png"}
    assert http.post("/guide-card-extraction", json=body).status_code == 401

    app.dependency_overrides[get_guide_card_extraction_service] = lambda: GuideCardExtractionService(_client(_reading()))
    try:
        ok = http.post("/guide-card-extraction", json=body, headers={"X-CTMS-AI-Token": "secret"})
        assert ok.status_code == 200
        assert ok.json()["card_number"] == "000000000"

        app.dependency_overrides[get_guide_card_extraction_service] = lambda: GuideCardExtractionService(_client("oops"))
        bad = http.post("/guide-card-extraction", json=body, headers={"X-CTMS-AI-Token": "secret"})
        assert bad.status_code == 422
        assert bad.json()["detail"]["code"] == "invalid_output"
    finally:
        app.dependency_overrides.clear()
