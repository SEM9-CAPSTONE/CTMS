import type { StatusBadgeTone } from "../../../shared/components";

export type WeatherRiskLevel = "green" | "yellow" | "red";

export interface WeatherCriterionScore {
	value: number | boolean;
	level: WeatherRiskLevel;
	weight: number;
	score: number;
}

export interface WeatherCriteriaScores {
	rainfall: WeatherCriterionScore;
	wind: WeatherCriterionScore;
	temperature: WeatherCriterionScore;
	visibility: WeatherCriterionScore;
	thunderstorm: WeatherCriterionScore;
}

export interface WeatherCriterionView {
	key: keyof WeatherCriteriaScores;
	label: string;
	value: string;
	level: WeatherRiskLevel;
	score: number;
	weight: number;
	/** Optional extra line, e.g. the forecast hour the worst value occurs. */
	hint?: string;
}

export const WEATHER_RISK_LABELS: Record<WeatherRiskLevel, string> = {
	green: "An toàn (Xanh)",
	yellow: "Cảnh báo (Vàng)",
	red: "Nguy hiểm (Đỏ)",
};

export const WEATHER_RISK_TONES: Record<WeatherRiskLevel, StatusBadgeTone> = {
	green: "success",
	yellow: "warning",
	red: "danger",
};

const CRITERIA_LABELS: Record<keyof WeatherCriteriaScores, string> = {
	rainfall: "Lượng mưa",
	wind: "Sức gió",
	temperature: "Nhiệt độ",
	visibility: "Tầm nhìn",
	thunderstorm: "Dông sét",
};

function formatCriterionValue(key: keyof WeatherCriteriaScores, value: number | boolean): string {
	if (typeof value === "boolean") return value ? "Có" : "Không";
	switch (key) {
		case "rainfall":
			return `${value} mm`;
		case "wind":
			return `${value} km/h`;
		case "temperature":
			return `${value}°C`;
		case "visibility":
			return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${value} m`;
		default:
			return String(value);
	}
}

/** Turns stored criteria scores into display rows, in a fixed order. */
export function toCriterionViews(
	criteria: WeatherCriteriaScores,
	hints: Partial<Record<keyof WeatherCriteriaScores, string>> = {}
): WeatherCriterionView[] {
	return (Object.keys(CRITERIA_LABELS) as Array<keyof WeatherCriteriaScores>).map((key) => ({
		key,
		label: CRITERIA_LABELS[key],
		value: formatCriterionValue(key, criteria[key].value),
		level: criteria[key].level,
		score: criteria[key].score,
		weight: criteria[key].weight,
		hint: hints[key],
	}));
}

export function formatWeatherDateTime(value: string | null | undefined): string {
	return value ? new Date(value).toLocaleString("vi-VN") : "";
}
