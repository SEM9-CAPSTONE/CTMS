import hmac
import os
from functools import lru_cache

from fastapi import Depends, FastAPI, HTTPException, Header
from openai import OpenAI, APIStatusError, APITimeoutError, APIConnectionError
from pydantic import BaseModel

from app.models import WeatherAdvisoryRequest, WeatherAdvisoryResponse
from app.weather_advisory_service import WeatherAdvisoryService
from app.review_analysis_service import (
    ReviewAnalysisRequest, ReviewAnalysisResponse, ReviewAnalysisService,
    InvalidReviewOutput, ReviewProviderRefusal,
)
from app.demand_insight_service import DemandRequest, DemandResponse, DemandInsightService

app = FastAPI(
	title="CTMS AI Service",
	description="AI Survival Assistant, RAG, and weather safety advisory service.",
	version="0.1.0",
)


class WeatherRiskRequest(BaseModel):
	rain_mm: float
	wind_kph: float
	temperature_c: float
	visibility_km: float


@app.get("/health")
def health() -> dict[str, str]:
	return {"service": "ctms-ai", "status": "ok"}


@app.post("/weather-risk")
def score_weather_risk(payload: WeatherRiskRequest) -> dict[str, str | int]:
	score = 0
	score += 2 if payload.rain_mm >= 20 else 1 if payload.rain_mm >= 8 else 0
	score += 2 if payload.wind_kph >= 45 else 1 if payload.wind_kph >= 25 else 0
	score += 1 if payload.temperature_c <= 5 or payload.temperature_c >= 35 else 0
	score += 2 if payload.visibility_km < 1 else 1 if payload.visibility_km < 3 else 0

	if score >= 5:
		level = "red"
		advisory = "High risk conditions detected. Consider closing the trail and broadcasting an emergency warning."
	elif score >= 3:
		level = "yellow"
		advisory = "Moderate risk conditions detected. Advise trekkers to proceed carefully and monitor updates."
	else:
		level = "green"
		advisory = "Conditions are acceptable. Continue standard monitoring."

	return {
		"score": score,
		"level": level,
		"advisory": advisory,
	}


@lru_cache
def _build_advisory_service() -> WeatherAdvisoryService:
	"""Built lazily on first real request, not at import time -- a missing
	OPENAI_API_KEY must only break an actual /weather-advisory request, not
	crash app startup and take down /health and /weather-risk with it (same
	reasoning as services/api's EmailOtpProvider building its transporter
	lazily). `lru_cache` makes this a singleton without a mutable module-level
	global.
	"""
	api_key = os.environ.get("OPENAI_API_KEY")
	if not api_key:
		raise HTTPException(
			status_code=503,
			detail="Weather advisory service is not configured (missing OPENAI_API_KEY).",
		)
	return WeatherAdvisoryService(OpenAI(api_key=api_key))


def get_advisory_service() -> WeatherAdvisoryService:
	return _build_advisory_service()


@app.post("/weather-advisory", response_model=WeatherAdvisoryResponse)
def generate_weather_advisory(
	payload: WeatherAdvisoryRequest,
	service: WeatherAdvisoryService = Depends(get_advisory_service),
) -> WeatherAdvisoryResponse:
	try:
		return service.generate(payload)
	except Exception as error:  # noqa: BLE001 -- BR-229: record the failure as a real
		# error, never assume success or fabricate an advisory when the LLM
		# call itself fails or returns something unparseable.
		raise HTTPException(
			status_code=502,
			detail=f"Weather advisory generation failed: {error}",
		) from error


# Review analysis is an internal authenticated operation; it does not share the
# legacy weather endpoint's unauthenticated provider boundary.


def require_review_token(x_ctms_ai_token: str | None = Header(default=None)) -> None:
    expected = os.environ.get("AI_REVIEW_SERVICE_TOKEN")
    if not expected:
        raise HTTPException(status_code=503, detail={"code": "provider_not_configured"})
    if not x_ctms_ai_token or not hmac.compare_digest(expected, x_ctms_ai_token):
        raise HTTPException(status_code=401, detail={"code": "unauthorized"})


def build_analysis_client() -> OpenAI:
    provider = os.environ.get("REVIEW_ANALYSIS_PROVIDER", "openai")
    if provider not in ("openai", "gemini"):
        raise HTTPException(status_code=503, detail={"code": "provider_not_configured"})
    key = os.environ.get("GEMINI_API_KEY" if provider == "gemini" else "OPENAI_API_KEY")
    if not key:
        raise HTTPException(status_code=503, detail={"code": "provider_not_configured"})
    options = {"base_url": "https://generativelanguage.googleapis.com/v1beta/openai/"} if provider == "gemini" else {}
    return OpenAI(api_key=key, timeout=12.0, max_retries=0, **options)


@lru_cache
def get_review_analysis_service() -> ReviewAnalysisService:
    return ReviewAnalysisService(build_analysis_client())


@lru_cache
def get_demand_insight_service() -> DemandInsightService:
    return DemandInsightService(build_analysis_client().with_options(timeout=40.0))


@app.post("/demand-insight", response_model=DemandResponse, dependencies=[Depends(require_review_token)])
def demand_insight(payload: DemandRequest, service: DemandInsightService = Depends(get_demand_insight_service)) -> DemandResponse:
    try:
        return service.generate(payload)
    except ReviewProviderRefusal:
        raise HTTPException(status_code=422, detail={"code": "provider_refusal"}) from None
    except InvalidReviewOutput:
        raise HTTPException(status_code=422, detail={"code": "invalid_output"}) from None
    except (APITimeoutError, APIConnectionError):
        raise HTTPException(status_code=504, detail={"code": "provider_transport"}) from None
    except APIStatusError as error:
        terminal = {"credit_balance_exhausted", "insufficient_quota", "organization_spend_limit_exceeded", "project_spend_limit_exceeded", "organization_usage_limit_exceeded"}
        code = error.code if isinstance(error.code, str) and error.code in terminal else "insufficient_quota" if error.type == "insufficient_quota" else "provider_failure"
        raise HTTPException(status_code=error.status_code if 400 <= error.status_code < 500 else 502, detail={"code": code}) from None
    except Exception:
        raise HTTPException(status_code=502, detail={"code": "provider_failure"}) from None


@app.post("/review-analysis", response_model=ReviewAnalysisResponse, dependencies=[Depends(require_review_token)])
def analyze_review(payload: ReviewAnalysisRequest, service: ReviewAnalysisService = Depends(get_review_analysis_service)) -> ReviewAnalysisResponse:
    try:
        return service.generate(payload)
    except ReviewProviderRefusal:
        raise HTTPException(status_code=422, detail={"code": "provider_refusal"}) from None
    except InvalidReviewOutput:
        raise HTTPException(status_code=422, detail={"code": "invalid_output"}) from None
    except (APITimeoutError, APIConnectionError):
        raise HTTPException(status_code=504, detail={"code": "provider_transport"}) from None
    except APIStatusError as error:
        status = error.status_code
        billing_codes = {"credit_balance_exhausted", "insufficient_quota", "organization_spend_limit_exceeded", "project_spend_limit_exceeded", "organization_usage_limit_exceeded"}
        code = error.code if isinstance(error.code, str) and error.code in billing_codes else None
        if code is None and error.type == "insufficient_quota":
            code = "insufficient_quota"
        if code:
            raise HTTPException(status_code=429, detail={"code": code}) from None
        raise HTTPException(status_code=status if status == 429 or 400 <= status < 500 else 502, detail={"code": "provider_failure"}) from None
    except Exception:
        # Never expose provider bodies, prompts or review contents to logs/HTTP errors.
        raise HTTPException(status_code=502, detail={"code": "provider_failure"}) from None
