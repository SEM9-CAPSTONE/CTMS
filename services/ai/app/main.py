import os
from functools import lru_cache

from fastapi import Depends, FastAPI, HTTPException
from openai import OpenAI
from pydantic import BaseModel

from app.models import WeatherAdvisoryRequest, WeatherAdvisoryResponse
from app.weather_advisory_service import WeatherAdvisoryService

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
