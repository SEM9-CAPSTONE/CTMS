from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from app.host_trip_planning_service import (
    HostPlanningCandidate,
    HostTripPlanningRequest,
    HostTripPlanningService,
)
from app.review_analysis_service import InvalidReviewOutput, ReviewProviderRefusal


class FakeCompletions:
    def __init__(self, content: str, finish_reason: str = "stop", refusal: str | None = None):
        self._content = content
        self._finish_reason = finish_reason
        self._refusal = refusal
        self.last_kwargs: dict | None = None

    def create(self, **kwargs):
        self.last_kwargs = kwargs
        msg = SimpleNamespace(content=self._content, refusal=self._refusal)
        choice = SimpleNamespace(message=msg, finish_reason=self._finish_reason)
        return SimpleNamespace(choices=[choice])


class FakeClient:
    def __init__(self, completions: FakeCompletions):
        self.chat = SimpleNamespace(completions=completions)


def sample_request() -> HostTripPlanningRequest:
    return HostTripPlanningRequest(
        model="gpt-4o-mini",
        candidates=[
            HostPlanningCandidate(
                candidateId="cand-1",
                tripType="day_trip",
                priceBand="500k_1m",
                capacityBand="small_1_6",
                fillBand="high",
                revenueRank=1,
                allowedMonths=["2026-12", "2027-01"],
                missingData=[],
            )
        ],
    )


def test_host_trip_planning_returns_validated_selections():
    completions = FakeCompletions(
        json.dumps(
            {
                "selections": [
                    {
                        "candidateId": "cand-1",
                        "monthHint": "2026-12",
                        "rationaleCodes": ["high_fill_history", "strong_route_rank"],
                    }
                ]
            }
        )
    )
    service = HostTripPlanningService(FakeClient(completions))
    result = service.generate(sample_request())

    assert len(result.selections) == 1
    assert result.selections[0].candidateId == "cand-1"
    assert result.selections[0].monthHint == "2026-12"
    assert completions.last_kwargs is not None
    sent_user_text = completions.last_kwargs["messages"][1]["content"]
    assert "host_id" not in sent_user_text


def test_host_trip_planning_rejects_unknown_candidate_or_disallowed_month():
    bad_candidate = FakeCompletions(
        json.dumps(
            {
                "selections": [
                    {
                        "candidateId": "cand-999",
                        "monthHint": "2026-12",
                        "rationaleCodes": ["high_fill_history"],
                    }
                ]
            }
        )
    )
    with pytest.raises(InvalidReviewOutput):
        HostTripPlanningService(FakeClient(bad_candidate)).generate(sample_request())

    bad_month = FakeCompletions(
        json.dumps(
            {
                "selections": [
                    {
                        "candidateId": "cand-1",
                        "monthHint": "2030-05",
                        "rationaleCodes": ["high_fill_history"],
                    }
                ]
            }
        )
    )
    with pytest.raises(InvalidReviewOutput):
        HostTripPlanningService(FakeClient(bad_month)).generate(sample_request())


def test_host_trip_planning_rejects_refusal_and_extra_fields():
    refused = FakeCompletions("", refusal="Cannot comply")
    with pytest.raises(ReviewProviderRefusal):
        HostTripPlanningService(FakeClient(refused)).generate(sample_request())

    extra_field = FakeCompletions(
        json.dumps(
            {
                "selections": [
                    {
                        "candidateId": "cand-1",
                        "monthHint": "2026-12",
                        "rationaleCodes": ["high_fill_history"],
                        "price": 999999,
                    }
                ]
            }
        )
    )
    with pytest.raises(InvalidReviewOutput):
        HostTripPlanningService(FakeClient(extra_field)).generate(sample_request())


def test_host_trip_planning_v2_returns_season_note_and_risks():
    completions = FakeCompletions(
        json.dumps(
            {
                "selections": [
                    {
                        "candidateId": "cand-1",
                        "monthHint": "2026-12",
                        "rationaleCodes": ["high_fill_history"],
                        "aiSeasonNote": "Tháng 12 thời tiết mát mẻ, ít nắng gắt.",
                        "aiRisks": [{"code": "rain_risk", "note": "Có thể có mưa phùn nhẹ cuối năm."}],
                        "confidence": "medium",
                    }
                ]
            }
        )
    )
    req = HostTripPlanningRequest(
        model="gemini-3.1-flash-lite",
        prompt_version="host-planning-v2",
        candidates=[
            HostPlanningCandidate(
                candidateId="cand-1",
                tripType="day_trip",
                areaName="Bán đảo Sơn Trà",
                priceBand="500k_1m",
                capacityBand="small_1_6",
                fillBand="high",
                revenueRank=1,
                allowedMonths=["2026-12", "2027-01"],
                missingData=[],
            )
        ],
    )
    res = HostTripPlanningService(FakeClient(completions)).generate(req)
    assert res.selections[0].aiSeasonNote == "Tháng 12 thời tiết mát mẻ, ít nắng gắt."
    assert res.selections[0].aiRisks is not None
    assert res.selections[0].aiRisks[0].code == "rain_risk"
    assert res.selections[0].confidence == "medium"
