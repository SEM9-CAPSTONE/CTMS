import json
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app, get_trip_recommendation_service
from app.review_analysis_service import InvalidReviewOutput, ReviewProviderRefusal
from app.trip_recommendation_service import TripRecommendationRequest, TripRecommendationService


def candidate(code="c01", **extra):
    return {
        "code": code, "tripType": "overnight", "difficulty": "hard", "region": "ba_na_hoa_vang",
        "priceBand": "1500k_3000k", "durationNights": 1, "daysUntilStart": 12, "baseScore": 0.75,
        "allowedReasons": ["preferred_trip_type", "departing_soon"], **extra,
    }


def payload(**extra):
    return {
        "prompt_version": "trip-recommendation-v1", "model": "gemini-3.1-flash-lite", "signal": "preferences_and_history",
        "preferences": {"tripTypes": ["overnight"], "difficulties": [], "regions": [], "hasPriceRange": True},
        "history": {"bookingCount": 3, "tripType": {"overnight": 1}, "difficulty": {"hard": 0.667},
                    "region": {}, "priceBand": {"1500k_3000k": 1}},
        "candidates": [candidate("c01"), candidate("c02", allowedReasons=[], baseScore=0)],
        **extra,
    }


def provider(output, refusal=None, finish="stop"):
    client = Mock()
    client.chat.completions.create.return_value = SimpleNamespace(choices=[SimpleNamespace(
        finish_reason=finish, message=SimpleNamespace(content=json.dumps(output), refusal=refusal))])
    return client


def test_only_structured_candidates_reach_the_provider():
    client = provider({"ranking": [{"code": "c02", "reasons": []}, {"code": "c01", "reasons": ["preferred_trip_type"]}]})
    result = TripRecommendationService(client).rank(TripRecommendationRequest(**payload()))
    assert [item.code for item in result.ranking] == ["c02", "c01"]
    kwargs = client.chat.completions.create.call_args.kwargs
    sent = json.loads(kwargs["messages"][1]["content"])
    assert set(sent) == {"signal", "preferences", "history", "candidates"}
    assert set(sent["candidates"][0]) == set(candidate())
    assert "tools" not in kwargs
    schema = kwargs["response_format"]["json_schema"]
    assert schema["strict"] is True
    assert schema["schema"]["properties"]["ranking"]["items"]["properties"]["code"]["enum"] == ["c01", "c02"]


@pytest.mark.parametrize("extra", [
    {"userId": "11111111-1111-4111-8111-111111111111"},
    {"email": "camper@example.com"},
    {"healthProfile": {"allergies": ["peanut"]}},
    {"lastSosAt": "2026-11-01"},
    {"location": {"lat": 16.1, "lng": 108.2}},
    {"paymentStatus": "paid"},
])
def test_request_rejects_identity_health_sos_gps_and_payment_fields(extra):
    with pytest.raises(ValidationError):
        TripRecommendationRequest(**payload(**extra))


@pytest.mark.parametrize("bad", [
    {"title": "Săn mây Tà Xùa"},
    {"description": "Free text"},
    {"tripId": "22222222-2222-4222-8222-000000000001"},
    {"hostId": "x"},
    {"pricePerPerson": 2_000_000},
])
def test_candidates_reject_free_text_and_identifiers(bad):
    raw = payload()
    raw["candidates"][0] |= bad
    with pytest.raises(ValidationError):
        TripRecommendationRequest(**raw)


def test_request_limits_and_unique_codes():
    with pytest.raises(ValidationError):
        TripRecommendationRequest(**payload(candidates=[candidate(f"c{i:02d}") for i in range(31)]))
    with pytest.raises(ValidationError):
        TripRecommendationRequest(**payload(candidates=[candidate("c01"), candidate("c01")]))
    with pytest.raises(ValidationError):
        TripRecommendationRequest(**payload(signal="none"))
    with pytest.raises(ValidationError):
        TripRecommendationRequest(**payload(candidates=[candidate("trip-1")]))


@pytest.mark.parametrize("output", [
    {"ranking": [{"code": "c09", "reasons": []}]},
    {"ranking": [{"code": "c01", "reasons": []}, {"code": "c01", "reasons": []}]},
    {"ranking": [{"code": "c02", "reasons": ["preferred_trip_type"]}]},
    {"ranking": [{"code": "c01", "reasons": ["preferred_trip_type", "preferred_trip_type"]}]},
    {"ranking": [{"code": "c01", "reasons": ["great_views"]}]},
    {"ranking": [{"code": "c01", "reasons": [], "note": "Phong cảnh đẹp"}]},
    {"ranking": [{"code": "c01", "reasons": []}], "summary": "top pick"},
    {"ranking": []},
])
def test_unknown_repeated_or_unsupported_output_is_rejected(output):
    with pytest.raises(InvalidReviewOutput):
        TripRecommendationService(provider(output)).rank(TripRecommendationRequest(**payload()))


def test_truncated_output_and_refusal_are_explicit():
    with pytest.raises(InvalidReviewOutput):
        TripRecommendationService(provider({"ranking": [{"code": "c01", "reasons": []}]}, finish="length")).rank(
            TripRecommendationRequest(**payload()))
    with pytest.raises(ReviewProviderRefusal):
        TripRecommendationService(provider({}, refusal="no")).rank(TripRecommendationRequest(**payload()))


def test_internal_route_requires_token_and_hides_provider_errors(monkeypatch):
    monkeypatch.setenv("TRIP_RECOMMENDATION_MODEL", "gemini-3.1-flash-lite")
    monkeypatch.setenv("AI_REVIEW_SERVICE_TOKEN", "test-only-token")
    fake = Mock()
    fake.rank.side_effect = RuntimeError("private provider details")
    app.dependency_overrides[get_trip_recommendation_service] = lambda: fake
    try:
        with TestClient(app) as client:
            assert client.post("/trip-recommendations", json=payload()).status_code == 401
            result = client.post("/trip-recommendations", json=payload(), headers={"X-CTMS-AI-Token": "test-only-token"})
            assert result.status_code == 502
            assert "private provider" not in result.text
            fake.rank.side_effect = InvalidReviewOutput()
            result = client.post("/trip-recommendations", json=payload(), headers={"X-CTMS-AI-Token": "test-only-token"})
            assert result.status_code == 422
            assert result.json()["detail"] == {"code": "invalid_output"}
    finally:
        app.dependency_overrides.pop(get_trip_recommendation_service, None)


def test_recommendations_use_google_independently_of_reviews(monkeypatch):
    monkeypatch.setenv("REVIEW_ANALYSIS_PROVIDER", "openai")
    monkeypatch.setenv("TRIP_RECOMMENDATION_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    get_trip_recommendation_service.cache_clear()
    try:
        with patch("app.main.OpenAI") as factory:
            get_trip_recommendation_service()
            factory.assert_called_once_with(api_key="fake-key", timeout=4.0, max_retries=0,
                base_url="https://generativelanguage.googleapis.com/v1beta/openai/")
    finally:
        get_trip_recommendation_service.cache_clear()


@pytest.mark.parametrize("key,provider_name", [(None, "gemini"), ("fake-key", "openai")])
def test_missing_key_or_wrong_provider_never_uses_openai(monkeypatch, key, provider_name):
    from fastapi import HTTPException
    monkeypatch.setenv("TRIP_RECOMMENDATION_PROVIDER", provider_name)
    monkeypatch.setenv("OPENAI_API_KEY", "unused-key")
    if key:
        monkeypatch.setenv("GEMINI_API_KEY", key)
    else:
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    get_trip_recommendation_service.cache_clear()
    with patch("app.main.OpenAI") as factory, pytest.raises(HTTPException) as caught:
        get_trip_recommendation_service()
    assert caught.value.status_code == 503
    factory.assert_not_called()


@pytest.mark.parametrize("header,delay", [(None, 60), ("invalid", 60), ("120", 120)])
def test_quota_cooldown_skips_provider_until_retry_after(header, delay):
    import httpx
    from openai import APIStatusError
    from fastapi import HTTPException
    client = Mock()
    response = httpx.Response(429, request=httpx.Request("POST", "https://example.invalid"),
                              headers={"Retry-After": header} if header else {})
    client.chat.completions.create.side_effect = APIStatusError("quota", response=response, body={})
    service = TripRecommendationService(client)
    with patch("app.trip_recommendation_service.time.monotonic", return_value=100):
        for _ in range(2):
            with pytest.raises(HTTPException) as caught:
                service.rank(TripRecommendationRequest(**payload()))
            assert caught.value.status_code == 429
            assert caught.value.headers["Retry-After"] == str(delay)
        assert client.chat.completions.create.call_count == 1
    client.chat.completions.create.return_value = provider({"ranking": [{"code": "c01", "reasons": []}]}).chat.completions.create.return_value
    client.chat.completions.create.side_effect = None
    with patch("app.trip_recommendation_service.time.monotonic", return_value=101 + delay):
        assert service.rank(TripRecommendationRequest(**payload())).ranking[0].code == "c01"


def test_retry_after_http_date():
    from datetime import datetime, timezone
    from app.trip_recommendation_service import retry_delay
    with patch("app.trip_recommendation_service.datetime") as clock:
        clock.now.return_value = datetime(2026, 11, 14, 0, 0, tzinfo=timezone.utc)
        assert retry_delay("Sat, 14 Nov 2026 00:02:00 GMT") == 120


def test_route_preserves_cooldown_and_rejects_unconfigured_models(monkeypatch):
    from fastapi import HTTPException
    monkeypatch.setenv("AI_REVIEW_SERVICE_TOKEN", "test-only-token")
    monkeypatch.setenv("TRIP_RECOMMENDATION_MODEL", "gemini-3.1-flash-lite")
    fake = Mock()
    fake.rank.side_effect = HTTPException(status_code=429, detail={"code": "provider_rate_limited"},
                                         headers={"Retry-After": "60"})
    app.dependency_overrides[get_trip_recommendation_service] = lambda: fake
    try:
        with TestClient(app) as client:
            headers = {"X-CTMS-AI-Token": "test-only-token"}
            result = client.post("/trip-recommendations", json=payload(), headers=headers)
            assert result.status_code == 429
            assert result.headers["retry-after"] == "60"
            fake.rank.reset_mock()
            result = client.post("/trip-recommendations", json=payload(model="other-model"), headers=headers)
            assert result.status_code == 422
            fake.rank.assert_not_called()
    finally:
        app.dependency_overrides.pop(get_trip_recommendation_service, None)
