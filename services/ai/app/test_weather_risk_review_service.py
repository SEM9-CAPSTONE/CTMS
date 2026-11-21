"""Hybrid weather risk review: only the OpenAI network edge is faked."""

import json
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app, get_weather_risk_review_service
from app.weather_risk_review_service import (
    SYSTEM_PROMPT,
    InvalidWeatherReviewOutput,
    WeatherRiskReviewRequest,
    WeatherRiskReviewResponse,
    WeatherRiskReviewService,
)

http = TestClient(app)


def _request(**overrides) -> WeatherRiskReviewRequest:
    data = dict(
        rainfall_mm=62.0,
        wind_kph=18.0,
        temperature_c=24.0,
        visibility_m=8000.0,
        thunderstorm=True,
        hours_covered=30,
    )
    data.update(overrides)
    return WeatherRiskReviewRequest(**data)


def _client(content: str | None, model: str = "gpt-4o-mini-2024") -> MagicMock:
    client = MagicMock()
    completion = MagicMock()
    completion.model = model
    completion.choices = [MagicMock(message=MagicMock(content=content))]
    client.chat.completions.create.return_value = completion
    return client


def test_sends_only_raw_readings_never_thresholds_or_rule_level():
    client = _client(json.dumps({"level": "red", "reason": "Dông sét và mưa rất lớn.", "confidence": 0.9}))
    WeatherRiskReviewService(client, model="gpt-4o-mini").review(_request())

    call = client.chat.completions.create.call_args.kwargs
    assert call["messages"][0] == {"role": "system", "content": SYSTEM_PROMPT}
    assert call["response_format"] == {"type": "json_object"}
    assert call["temperature"] == 0
    sent = json.loads(call["messages"][1]["content"])
    assert set(sent) == {"rainfall_mm", "wind_kph", "temperature_c", "visibility_m", "thunderstorm", "hours_covered"}


def test_returns_level_reason_confidence_and_actual_model():
    client = _client(json.dumps({"level": "red", "reason": "  Dông sét nguy hiểm.  ", "confidence": 0.85}))
    result = WeatherRiskReviewService(client, model="gpt-4o-mini").review(_request())

    assert result.level == "red"
    assert result.reason == "Dông sét nguy hiểm."
    assert result.confidence == 0.85
    assert result.model == "gpt-4o-mini-2024"
    assert result.prompt_version == "v1"


@pytest.mark.parametrize(
    "content",
    [
        None,
        "not json",
        json.dumps({"level": "purple", "reason": "x", "confidence": 0.5}),
        json.dumps({"level": "red", "reason": "", "confidence": 0.5}),
        json.dumps({"level": "red", "reason": "x", "confidence": 1.5}),
    ],
)
def test_rejects_missing_or_invalid_output(content):
    with pytest.raises(InvalidWeatherReviewOutput):
        WeatherRiskReviewService(_client(content), model="m").review(_request())


def test_request_rejects_unknown_fields_such_as_rule_level():
    with pytest.raises(ValueError):
        WeatherRiskReviewRequest(
            rainfall_mm=1, wind_kph=1, temperature_c=20, visibility_m=10000,
            thunderstorm=False, hours_covered=5, risk_level="red",
        )


@pytest.fixture
def _token(monkeypatch):
    monkeypatch.setenv("AI_REVIEW_SERVICE_TOKEN", "secret")
    yield
    app.dependency_overrides.clear()


def _payload() -> dict:
    return _request().model_dump()


def test_endpoint_requires_the_service_token(_token):
    response = http.post("/weather-risk-review", json=_payload())
    assert response.status_code == 401


def test_endpoint_returns_the_review(_token):
    service = MagicMock()
    service.review.return_value = WeatherRiskReviewResponse(
        level="yellow", reason="Mưa vừa.", confidence=0.6, model="m", prompt_version="v1"
    )
    app.dependency_overrides[get_weather_risk_review_service] = lambda: service

    response = http.post("/weather-risk-review", json=_payload(), headers={"X-CTMS-AI-Token": "secret"})

    assert response.status_code == 200
    assert response.json()["level"] == "yellow"


def test_endpoint_maps_invalid_output_to_422(_token):
    service = MagicMock()
    service.review.side_effect = InvalidWeatherReviewOutput("invalid")
    app.dependency_overrides[get_weather_risk_review_service] = lambda: service

    response = http.post("/weather-risk-review", json=_payload(), headers={"X-CTMS-AI-Token": "secret"})

    assert response.status_code == 422
    assert response.json()["detail"] == {"code": "invalid_output"}
