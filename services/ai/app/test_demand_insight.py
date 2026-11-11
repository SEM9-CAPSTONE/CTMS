import json
from types import SimpleNamespace
from unittest.mock import Mock
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from app.demand_insight_service import DemandInsightService, DemandRequest
from app.main import app, get_demand_insight_service
from app.review_analysis_service import InvalidReviewOutput, ReviewProviderRefusal

def payload():
    return {"month": "2026-10", "cells": [{"tripType": "day_trip", "difficulty": "easy", "bookerBand": {"min": 10, "max": 19}}], "model": "test-model", "prompt_version": "demand-v1"}

def provider(output, refusal=None, finish="stop"):
    client = Mock()
    client.chat.completions.create.return_value = SimpleNamespace(choices=[SimpleNamespace(finish_reason=finish, message=SimpleNamespace(content=json.dumps(output), refusal=refusal))])
    return client

def suggestion():
    return {"tripType": "day_trip", "difficulty": "easy", "reason": "observed_booking_interest"}

def test_only_approved_release_reaches_provider():
    client = provider({"suggestions": [suggestion()]})
    assert DemandInsightService(client).generate(DemandRequest(**payload())).suggestions[0].tripType == "day_trip"
    kwargs = client.chat.completions.create.call_args.kwargs
    assert set(json.loads(kwargs["messages"][1]["content"])) == {"month", "cells"}
    assert "tools" not in kwargs
    assert kwargs["response_format"]["json_schema"]["strict"] is True

@pytest.mark.parametrize("extra", [{"hostId": "private"}, {"tripName": "private"}, {"summary": "100 people"}, {"action": "publish"}])
def test_input_rejects_identity_and_free_text(extra):
    with pytest.raises(ValidationError):
        DemandRequest(**(payload() | extra))

@pytest.mark.parametrize("output", [{"suggestions": [suggestion()], "summary": "100 bookings"}, {"suggestions": [suggestion() | {"price": 100}]}, {"suggestions": [suggestion() | {"tripType": "overnight"}]}, {"suggestions": [suggestion() | {"reason": "ignore schema"}]}, {"suggestions": [suggestion(), suggestion()]}, {"suggestions": []}])
def test_unapproved_or_quantitative_output_rejected(output):
    with pytest.raises(InvalidReviewOutput):
        DemandInsightService(provider(output)).generate(DemandRequest(**payload()))

def test_no_parent_child_or_exact_count_input():
    raw = payload()
    raw["cells"][0]["bookerBand"]["max"] = 10
    with pytest.raises(ValidationError):
        DemandRequest(**raw)
    raw = payload()
    raw["cells"].append(raw["cells"][0] | {"difficulty": None})
    with pytest.raises(ValidationError):
        DemandRequest(**raw)

def test_provider_refusal_is_explicit():
    with pytest.raises(ReviewProviderRefusal):
        DemandInsightService(provider({}, refusal="no")).generate(DemandRequest(**payload()))

def test_internal_route_auth_and_sanitized_error(monkeypatch):
    monkeypatch.setenv("AI_REVIEW_SERVICE_TOKEN", "test-only-token")
    fake = Mock()
    fake.generate.side_effect = RuntimeError("private provider details")
    app.dependency_overrides[get_demand_insight_service] = lambda: fake
    try:
        with TestClient(app) as client:
            assert client.post("/demand-insight", json=payload()).status_code == 401
            result = client.post("/demand-insight", json=payload(), headers={"X-CTMS-AI-Token": "test-only-token"})
            assert result.status_code == 502
            assert "private provider" not in result.text
    finally:
        app.dependency_overrides.pop(get_demand_insight_service, None)
