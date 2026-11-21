import type { TripWeatherWorstReading } from "../trips/types";
import type { WeatherRiskLevel } from "../weather/utils/weather-risk";

/** A Trip whose threshold level and independent AI opinion disagree (Admin only). */
export interface WeatherAiMismatch {
	forecastId: string;
	tripId: string;
	tripTitle: string;
	tripStatus: string;
	tripStartsAt: string;
	hostId: string;
	hostName: string | null;
	/** Official level from the Admin thresholds. */
	riskLevel: WeatherRiskLevel;
	/** AI opinion on the same readings. */
	aiRiskLevel: WeatherRiskLevel;
	aiReason: string;
	aiConfidence: number;
	aiReviewedAt: string;
	/** 1 = one level apart, 2 = Green vs Red. */
	gap: number;
	worstReading: TripWeatherWorstReading | null;
	ruleVersion: number | null;
}

export interface WeatherAiAcknowledgeResult {
	forecastId: string;
	acknowledgedAt: string;
}
