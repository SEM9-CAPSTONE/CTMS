"""CTMS-29-T01. FastAPI TestClient against the real app, with only the
`WeatherAdvisoryService` dependency swapped out (FastAPI's own
`dependency_overrides`) -- the HTTP layer, request validation, and error
mapping are all real.
"""

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app, get_advisory_service
from app.models import WeatherAdvisoryResponse

client = TestClient(app)


def _valid_payload() -> dict:
	criterion = {"value": 12.5, "level": "yellow", "weight": 0.3, "score": 1}
	green = {"value": 20.0, "level": "green", "weight": 0.2, "score": 0}
	return {
		"risk_level": "yellow",
		"composite_score": 0.9,
		"rainfall": criterion,
		"wind": green,
		"temperature": green,
		"visibility": green,
		"thunderstorm": {"value": False, "level": "green", "weight": 0.15, "score": 0},
	}


@pytest.fixture(autouse=True)
def _clear_overrides():
	yield
	app.dependency_overrides.clear()


def test_health_is_unaffected_by_this_story():
	response = client.get("/health")
	assert response.status_code == 200
	assert response.json() == {"service": "ctms-ai", "status": "ok"}


def test_happy_path_returns_the_advice_and_actions():
	fake_service = MagicMock()
	fake_service.generate.return_value = WeatherAdvisoryResponse(
		advice="Điều kiện ở mức cảnh báo.",
		actions=["Mang áo mưa", "Theo dõi cập nhật thời tiết"],
	)
	app.dependency_overrides[get_advisory_service] = lambda: fake_service

	response = client.post("/weather-advisory", json=_valid_payload())

	assert response.status_code == 200
	body = response.json()
	assert body == {
		"advice": "Điều kiện ở mức cảnh báo.",
		"actions": ["Mang áo mưa", "Theo dõi cập nhật thời tiết"],
	}
	# Never a risk_level/composite_score field -- BR-076.
	assert "risk_level" not in body
	assert "composite_score" not in body


def test_invalid_payload_missing_a_required_criterion_returns_422_and_calls_nothing():
	fake_service = MagicMock()
	app.dependency_overrides[get_advisory_service] = lambda: fake_service

	payload = _valid_payload()
	del payload["thunderstorm"]
	response = client.post("/weather-advisory", json=payload)

	assert response.status_code == 422
	fake_service.generate.assert_not_called()


def test_invalid_risk_level_enum_value_returns_422():
	fake_service = MagicMock()
	app.dependency_overrides[get_advisory_service] = lambda: fake_service

	payload = _valid_payload()
	payload["risk_level"] = "purple"
	response = client.post("/weather-advisory", json=payload)

	assert response.status_code == 422
	fake_service.generate.assert_not_called()


def test_a_failure_from_the_service_maps_to_502_not_a_silent_success():
	fake_service = MagicMock()
	fake_service.generate.side_effect = ValueError("Empty response from the LLM provider")
	app.dependency_overrides[get_advisory_service] = lambda: fake_service

	response = client.post("/weather-advisory", json=_valid_payload())

	assert response.status_code == 502
	assert "Empty response" in response.json()["detail"]


def test_missing_api_key_configuration_returns_503():
	def _raise_unconfigured():
		from fastapi import HTTPException

		raise HTTPException(status_code=503, detail="Weather advisory service is not configured (missing OPENAI_API_KEY).")

	app.dependency_overrides[get_advisory_service] = _raise_unconfigured

	response = client.post("/weather-advisory", json=_valid_payload())

	assert response.status_code == 503
