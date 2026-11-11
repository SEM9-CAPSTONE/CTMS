"""CTMS-29-T01. Only the real OpenAI network boundary is faked (the
`client.chat.completions.create` call itself) -- the same "fake the edge,
keep the real code under test" convention this codebase already applies to
services/api's OpenMeteoWeatherProvider tests. Everything else (prompt
construction, response parsing, the BR-076 structural guarantee) runs for
real.
"""

import json
from unittest.mock import MagicMock

import pytest

from app.models import CriterionInput, WeatherAdvisoryRequest
from app.weather_advisory_service import SYSTEM_PROMPT, WeatherAdvisoryService


def _criterion(value=0.0, level="green", weight=0.2, score=0) -> CriterionInput:
	return CriterionInput(value=value, level=level, weight=weight, score=score)


def _request(**overrides) -> WeatherAdvisoryRequest:
	defaults = dict(
		risk_level="yellow",
		composite_score=0.9,
		rainfall=_criterion(value=12.5, level="yellow", score=1),
		wind=_criterion(value=35.0, level="green", score=0),
		temperature=_criterion(value=33.0, level="green", score=0),
		visibility=_criterion(value=4500, level="yellow", score=1),
		thunderstorm=_criterion(value=False, level="green", score=0),
	)
	defaults.update(overrides)
	return WeatherAdvisoryRequest(**defaults)


def _fake_completion(content: str):
	completion = MagicMock()
	completion.choices = [MagicMock(message=MagicMock(content=content))]
	return completion


def test_sends_the_system_prompt_and_the_full_request_payload_as_the_user_message():
	client = MagicMock()
	client.chat.completions.create.return_value = _fake_completion(
		json.dumps({"advice": "An toàn.", "actions": ["Theo dõi cập nhật."]})
	)
	service = WeatherAdvisoryService(client)

	service.generate(_request())

	call = client.chat.completions.create.call_args
	messages = call.kwargs["messages"]
	assert messages[0] == {"role": "system", "content": SYSTEM_PROMPT}
	sent_payload = json.loads(messages[1]["content"])
	assert sent_payload["risk_level"] == "yellow"
	assert sent_payload["rainfall"]["value"] == 12.5


def test_requests_json_response_format_and_a_low_temperature():
	client = MagicMock()
	client.chat.completions.create.return_value = _fake_completion(
		json.dumps({"advice": "x", "actions": ["y"]})
	)
	WeatherAdvisoryService(client).generate(_request())

	call = client.chat.completions.create.call_args
	assert call.kwargs["response_format"] == {"type": "json_object"}
	assert call.kwargs["temperature"] <= 0.5


def test_parses_a_real_shaped_success_response():
	client = MagicMock()
	client.chat.completions.create.return_value = _fake_completion(
		json.dumps(
			{
				"advice": "Lượng mưa và tầm nhìn ở mức cảnh báo.",
				"actions": ["Mang áo mưa", "Kiểm tra đèn pin dự phòng"],
			}
		)
	)

	result = WeatherAdvisoryService(client).generate(_request())

	assert result.advice == "Lượng mưa và tầm nhìn ở mức cảnh báo."
	assert result.actions == ["Mang áo mưa", "Kiểm tra đèn pin dự phòng"]


def test_br076_a_smuggled_risk_level_in_the_llm_json_is_silently_dropped():
	"""Structural enforcement of BR-076: even if the model ignores the
	prompt and includes its own risk_level/composite_score in the JSON,
	WeatherAdvisoryResponse has no field to receive it."""
	client = MagicMock()
	client.chat.completions.create.return_value = _fake_completion(
		json.dumps(
			{
				"advice": "ok",
				"actions": ["a"],
				"risk_level": "red",
				"composite_score": 9.9,
			}
		)
	)

	result = WeatherAdvisoryService(client).generate(_request())

	assert not hasattr(result, "risk_level")
	assert not hasattr(result, "composite_score")


def test_raises_when_the_llm_returns_an_empty_message():
	client = MagicMock()
	client.chat.completions.create.return_value = _fake_completion(None)

	with pytest.raises(ValueError, match="Empty response"):
		WeatherAdvisoryService(client).generate(_request())


def test_raises_when_the_llm_returns_unparseable_json():
	client = MagicMock()
	client.chat.completions.create.return_value = _fake_completion("not json at all")

	with pytest.raises(json.JSONDecodeError):
		WeatherAdvisoryService(client).generate(_request())


def test_raises_when_the_llm_json_is_missing_a_required_field():
	client = MagicMock()
	client.chat.completions.create.return_value = _fake_completion(json.dumps({"advice": "only this"}))

	with pytest.raises(KeyError):
		WeatherAdvisoryService(client).generate(_request())


def test_propagates_a_real_network_failure_from_the_openai_client():
	client = MagicMock()
	client.chat.completions.create.side_effect = ConnectionError("network down")

	with pytest.raises(ConnectionError):
		WeatherAdvisoryService(client).generate(_request())
