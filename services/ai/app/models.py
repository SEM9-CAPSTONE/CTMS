"""CTMS-29-T01. Pydantic schemas for the weather risk advisory endpoint.

The response schema deliberately has no risk-level or score field at all --
this is the structural half of BR-076 ("the LLM must not change the risk
score by itself"): there is no channel in the contract for a modified score
to travel back through, regardless of what the model itself says. The
request schema mirrors CTMS-26's real `WeatherRiskAssessment.criteriaScores`
shape exactly (see services/api's weather-risk-assessment.entity.ts) --
this service never invents its own weather/risk data model.
"""

from typing import Literal

from pydantic import BaseModel, Field

RiskLevel = Literal["green", "yellow", "red"]


class CriterionInput(BaseModel):
    value: float | bool
    level: RiskLevel
    weight: float = Field(ge=0)
    score: int = Field(ge=0, le=2)


class WeatherAdvisoryRequest(BaseModel):
    risk_level: RiskLevel
    composite_score: float
    rainfall: CriterionInput
    wind: CriterionInput
    temperature: CriterionInput
    visibility: CriterionInput
    thunderstorm: CriterionInput


class WeatherAdvisoryResponse(BaseModel):
    advice: str
    actions: list[str]
