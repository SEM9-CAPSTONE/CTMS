/**
 * Sensible bounds for weather thresholds (hybrid risk). Mirrors the API's
 * services/api/src/modules/weather/services/weather-risk-rule-limits.ts, which enforces them.
 */
export const WEATHER_RULE_LIMITS = {
	rainfallYellowThreshold: { min: 2, max: 50, label: "Lượng mưa Mức Vàng", unit: "mm/h" },
	rainfallRedThreshold: { min: 10, max: 100, label: "Lượng mưa Mức Đỏ", unit: "mm/h" },
	windYellowThreshold: { min: 20, max: 70, label: "Tốc độ gió Mức Vàng", unit: "km/h" },
	windRedThreshold: { min: 40, max: 120, label: "Tốc độ gió Mức Đỏ", unit: "km/h" },
	tempLowRed: { min: -20, max: 10, label: "Nhiệt độ thấp Mức Đỏ", unit: "°C" },
	tempLowYellow: { min: -10, max: 20, label: "Nhiệt độ thấp Mức Vàng", unit: "°C" },
	tempHighYellow: { min: 25, max: 45, label: "Nhiệt độ cao Mức Vàng", unit: "°C" },
	tempHighRed: { min: 30, max: 50, label: "Nhiệt độ cao Mức Đỏ", unit: "°C" },
	visibilityYellowThreshold: { min: 1000, max: 10000, label: "Tầm nhìn Mức Vàng", unit: "m" },
	visibilityRedThreshold: { min: 100, max: 2000, label: "Tầm nhìn Mức Đỏ", unit: "m" },
	greenMaxScore: { min: 0.1, max: 1.5, label: "Điểm trần Mức Xanh", unit: "" },
	yellowMaxScore: { min: 0.5, max: 2, label: "Điểm trần Mức Vàng", unit: "" },
} as const;

export const WEATHER_RULE_MAX_WEIGHT = 0.6;

export const WEATHER_RULE_WEIGHT_LABELS = {
	rainfallWeight: "mưa",
	windWeight: "gió",
	temperatureWeight: "nhiệt độ",
	visibilityWeight: "tầm nhìn",
	thunderstormWeight: "dông sét",
} as const;
