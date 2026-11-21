/** Version of this evaluation procedure (metric definitions and gates), stored on every report. */
export const WEATHER_RISK_EVALUATION_CONFIG_VERSION = "v3-weather-risk-evaluation-1";

/**
 * BR-280 / BR-282 V3 release gates, as whole percentages so pass/fail is decided on integer
 * counts (a value exactly at the threshold passes, spec §10).
 */
export const WEATHER_RISK_RELEASE_GATES = {
	MIN_OVERALL_AGREEMENT_PERCENT: 90,
	MAX_MISSED_RED_PERCENT: 5,
	MAX_FALSE_RED_PERCENT: 10,
} as const;

export const WEATHER_RISK_EVALUATION_HISTORY_LIMIT = 20;
export const WEATHER_RISK_EVALUATION_MAX_HISTORY_LIMIT = 100;
