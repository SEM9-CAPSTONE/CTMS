import type { WeatherRiskLevel } from "../weather/utils/weather-risk";

/** CTMS-98 weather decision near departure (policy §5). */
export type WeatherDecision = "keep" | "reschedule" | "cancel" | "pause" | "resume";
export type HostWeatherDecision = "keep" | "reschedule" | "cancel";
export type WeatherAlertMilestone =
	| "host_t48"
	| "admin_t24"
	| "admin_t12"
	| "admin_t6"
	| "admin_kept";
export type WeatherAlertUrgency = "normal" | "urgent" | "critical";

export interface TripWeatherDecision {
	id: string;
	tripId: string;
	forecastId: string | null;
	riskLevel: WeatherRiskLevel | null;
	decidedBy: string | null;
	deciderName: string | null;
	deciderRole: "host" | "admin";
	decision: WeatherDecision;
	reason: string;
	safetyPlan: string | null;
	late: boolean;
	tripStartsAt: string;
	createdAt: string;
}

export interface TripWeatherDecisionLog {
	tripId: string;
	tripStatus: string;
	startsAt: string;
	weatherPausedAt: string | null;
	weatherPauseReason: string | null;
	latestRiskLevel: WeatherRiskLevel | null;
	withinDecisionWindow: boolean;
	decisions: TripWeatherDecision[];
}

export interface WeatherIntervention {
	tripId: string;
	tripTitle: string;
	hostId: string;
	startsAt: string;
	forecastId: string;
	reason: "no_response" | "host_kept";
	urgency: WeatherAlertUrgency;
	hostDecisionReason: string | null;
	hostSafetyPlan: string | null;
	weatherPausedAt: string | null;
}

export interface WeatherDecisionAlert {
	id: string;
	tripId: string;
	milestone: WeatherAlertMilestone;
	urgency: WeatherAlertUrgency;
	tripTitle: string;
	tripStartsAt: string;
	message: string;
	readAt: string | null;
	createdAt: string;
}

export interface WeatherDecisionAlertList {
	items: WeatherDecisionAlert[];
	unreadCount: number;
}

export interface WeatherDecisionInput {
	decision: WeatherDecision;
	reason: string;
	safetyPlan?: string;
	startsAt?: string;
	endsAt?: string;
}

export interface WeatherRescheduleResponseResult {
	bookingId: string;
	status: "confirmed" | "cancelled";
	refundsCreated: number;
}
