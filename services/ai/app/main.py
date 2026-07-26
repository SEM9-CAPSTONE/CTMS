from fastapi import FastAPI
from pydantic import BaseModel

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
