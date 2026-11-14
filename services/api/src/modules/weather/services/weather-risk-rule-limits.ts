/**
 * Sensible bounds for Admin-configured weather thresholds (hybrid risk, leader decision C). They
 * stop obviously wrong settings, such as "1 mm of rain is Red", that would wrongly block bookings
 * and penalise Hosts. Units follow the hourly forecast: mm/h, km/h, °C, metres.
 * Keep in sync with apps/web/src/features/admin-weather-rules/utils/rule-limits.ts.
 */
export interface NumericRuleLimit {
	min: number;
	max: number;
	unit: string;
}

export const WEATHER_RULE_LIMITS = {
	rainfallYellowThreshold: { min: 2, max: 50, unit: "mm/h" },
	rainfallRedThreshold: { min: 10, max: 100, unit: "mm/h" },
	windYellowThreshold: { min: 20, max: 70, unit: "km/h" },
	windRedThreshold: { min: 40, max: 120, unit: "km/h" },
	tempLowRed: { min: -20, max: 10, unit: "°C" },
	tempLowYellow: { min: -10, max: 20, unit: "°C" },
	tempHighYellow: { min: 25, max: 45, unit: "°C" },
	tempHighRed: { min: 30, max: 50, unit: "°C" },
	visibilityYellowThreshold: { min: 1000, max: 10000, unit: "m" },
	visibilityRedThreshold: { min: 100, max: 2000, unit: "m" },
	greenMaxScore: { min: 0.1, max: 1.5, unit: "" },
	yellowMaxScore: { min: 0.5, max: 2, unit: "" },
} as const satisfies Record<string, NumericRuleLimit>;

/** No single criterion may decide the whole score on its own. */
export const WEATHER_RULE_MAX_WEIGHT = 0.6;

export type LimitedRuleField = keyof typeof WEATHER_RULE_LIMITS;

/** Human-readable problems with the given values; empty when every value is within bounds. */
export function weatherRuleLimitViolations(
	values: Record<LimitedRuleField, number> & {
		rainfallWeight: number;
		windWeight: number;
		temperatureWeight: number;
		visibilityWeight: number;
		thunderstormWeight: number;
		thunderstormYellow: boolean;
		thunderstormRed: boolean;
	}
): string[] {
	const problems: string[] = [];
	for (const [field, limit] of Object.entries(WEATHER_RULE_LIMITS) as Array<
		[LimitedRuleField, NumericRuleLimit]
	>) {
		const value = values[field];
		if (value < limit.min || value > limit.max) {
			const unit = limit.unit ? ` ${limit.unit}` : "";
			problems.push(`${field} must be between ${limit.min} and ${limit.max}${unit}`);
		}
	}
	for (const field of [
		"rainfallWeight",
		"windWeight",
		"temperatureWeight",
		"visibilityWeight",
		"thunderstormWeight",
	] as const) {
		if (values[field] > WEATHER_RULE_MAX_WEIGHT) {
			problems.push(`${field} must not exceed ${WEATHER_RULE_MAX_WEIGHT}`);
		}
	}
	if (!values.thunderstormYellow && !values.thunderstormRed) {
		problems.push("Thunderstorms must raise at least a Yellow level");
	}
	return problems;
}
