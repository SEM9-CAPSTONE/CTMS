import {
	type CriterionRiskScoreDetail,
	RiskLevel,
	type WeatherCriteriaScoresDetail,
} from "../entities/weather-risk-assessment.entity";
import type { WeatherRiskRule } from "../entities/weather-risk-rule.entity";

export interface WeatherScoringInput {
	rainfallMm: number;
	windKph: number;
	temperatureC: number;
	visibilityM: number;
	thunderstorm: boolean;
}

export interface WeatherScoringResult {
	criteriaScores: WeatherCriteriaScoresDetail;
	compositeScore: number;
	riskLevel: RiskLevel;
}

/**
 * BR-041: deterministic multi-criteria score of one weather reading under one rule
 * version. Shared by the current-weather assessment (CTMS-016) and the Trip forecast.
 */
export function scoreWeatherReading(
	input: WeatherScoringInput,
	rule: WeatherRiskRule
): WeatherScoringResult {
	const criteriaScores: WeatherCriteriaScoresDetail = {
		rainfall: scoreThreshold(
			input.rainfallMm,
			rule.rainfallYellowThreshold,
			rule.rainfallRedThreshold,
			rule.rainfallWeight,
			"higher"
		),
		wind: scoreThreshold(
			input.windKph,
			rule.windYellowThreshold,
			rule.windRedThreshold,
			rule.windWeight,
			"higher"
		),
		temperature: scoreTemperature(input.temperatureC, rule),
		visibility: scoreThreshold(
			input.visibilityM,
			rule.visibilityYellowThreshold,
			rule.visibilityRedThreshold,
			rule.visibilityWeight,
			"lower"
		),
		thunderstorm: scoreThunderstorm(input.thunderstorm, rule),
	};

	const compositeScore =
		criteriaScores.rainfall.score * rule.rainfallWeight +
		criteriaScores.wind.score * rule.windWeight +
		criteriaScores.temperature.score * rule.temperatureWeight +
		criteriaScores.visibility.score * rule.visibilityWeight +
		criteriaScores.thunderstorm.score * rule.thunderstormWeight;

	return {
		criteriaScores,
		compositeScore: Number(compositeScore.toFixed(4)),
		riskLevel: classifyRisk(compositeScore, rule),
	};
}

export function scoreTemperature(value: number, rule: WeatherRiskRule): CriterionRiskScoreDetail {
	let level = RiskLevel.GREEN;
	let score = 0;
	if (value <= rule.tempLowRed || value >= rule.tempHighRed) {
		level = RiskLevel.RED;
		score = 2;
	} else if (value <= rule.tempLowYellow || value >= rule.tempHighYellow) {
		level = RiskLevel.YELLOW;
		score = 1;
	}
	return { value, level, weight: rule.temperatureWeight, score };
}

function scoreThreshold(
	value: number,
	yellow: number,
	red: number,
	weight: number,
	worseWhen: "higher" | "lower"
): CriterionRiskScoreDetail {
	const reaches = (threshold: number) =>
		worseWhen === "higher" ? value >= threshold : value <= threshold;
	let level = RiskLevel.GREEN;
	let score = 0;
	if (reaches(red)) {
		level = RiskLevel.RED;
		score = 2;
	} else if (reaches(yellow)) {
		level = RiskLevel.YELLOW;
		score = 1;
	}
	return { value, level, weight, score };
}

function scoreThunderstorm(value: boolean, rule: WeatherRiskRule): CriterionRiskScoreDetail {
	let level = RiskLevel.GREEN;
	let score = 0;
	if (value) {
		if (rule.thunderstormRed) {
			level = RiskLevel.RED;
			score = 2;
		} else if (rule.thunderstormYellow) {
			level = RiskLevel.YELLOW;
			score = 1;
		}
	}
	return { value, level, weight: rule.thunderstormWeight, score };
}

function classifyRisk(score: number, rule: WeatherRiskRule): RiskLevel {
	if (score < rule.greenMaxScore) return RiskLevel.GREEN;
	if (score < rule.yellowMaxScore) return RiskLevel.YELLOW;
	return RiskLevel.RED;
}
