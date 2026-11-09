/**
 * Weather decision near departure, docs/features/weather-trip-date-decision-policy.md §5.
 * Pure rules so the milestones can be unit-tested without a database.
 */

const HOUR_MS = 60 * 60 * 1000;

/** Host and Admin may only decide for weather in the last 3 days (policy §2 "Cao", §5.3). */
export const WEATHER_DECISION_WINDOW_MS = 72 * HOUR_MS;
/** T-48h: the Host is reminded to decide (policy §5.1). */
export const WEATHER_HOST_REMINDER_MS = 48 * HOUR_MS;
/** T-24h: the Host's deadline; a later Host decision is recorded as late (policy §5.2). */
export const WEATHER_HOST_DEADLINE_MS = 24 * HOUR_MS;
/** T-12h / T-6h: repeated, more urgent Admin reminders while nobody acted (policy §5.4). */
export const WEATHER_ADMIN_URGENT_MS = 12 * HOUR_MS;
export const WEATHER_ADMIN_CRITICAL_MS = 6 * HOUR_MS;

export type WeatherDecision = "keep" | "reschedule" | "cancel" | "pause" | "resume";
export type WeatherDeciderRole = "host" | "admin";
export type WeatherAlertMilestone =
	| "host_t48"
	| "admin_t24"
	| "admin_t12"
	| "admin_t6"
	| "admin_kept";
export type WeatherAlertUrgency = "normal" | "urgent" | "critical";

export const WEATHER_ALERT_URGENCY: Record<WeatherAlertMilestone, WeatherAlertUrgency> = {
	host_t48: "normal",
	admin_t24: "normal",
	admin_kept: "normal",
	admin_t12: "urgent",
	admin_t6: "critical",
};

export interface WeatherDecisionState {
	startsAt: Date;
	/** Latest Host decision for the current schedule, if any. */
	hostDecision: WeatherDecision | null;
	/** True once an Admin recorded any decision for the current schedule. */
	adminDecided: boolean;
}

export function msUntilStart(startsAt: Date, now: Date): number {
	return startsAt.getTime() - now.getTime();
}

/** Inside the last 3 days and not yet started. */
export function isWithinDecisionWindow(startsAt: Date, now: Date): boolean {
	const remaining = msUntilStart(startsAt, now);
	return remaining > 0 && remaining <= WEATHER_DECISION_WINDOW_MS;
}

/** A Host decision taken after T-24h is still accepted, but flagged for the penalty task. */
export function isLateHostDecision(startsAt: Date, now: Date): boolean {
	return msUntilStart(startsAt, now) <= WEATHER_HOST_DEADLINE_MS;
}

/**
 * Reminders that are due now for a Trip whose newest forecast is Red. Each milestone is stored
 * once per (Trip, schedule, recipient), so returning an already-sent one is harmless.
 *
 * - No Host decision and ≤ 48 h left: remind the Host.
 * - Host chose Keep: tell the Admins right away.
 * - No Host decision and ≤ 24 h left: escalate to the Admins, only the most urgent milestone
 *   reached (T-24h, then T-12h "urgent", then T-6h "critical").
 * - Nothing once an Admin acted, the Host cancelled/rescheduled, or the Trip started.
 */
export function dueWeatherAlerts(state: WeatherDecisionState, now: Date): WeatherAlertMilestone[] {
	const remaining = msUntilStart(state.startsAt, now);
	if (remaining <= 0 || state.adminDecided) return [];
	if (state.hostDecision === "cancel" || state.hostDecision === "reschedule") return [];
	if (state.hostDecision === "keep") return ["admin_kept"];
	const due: WeatherAlertMilestone[] = [];
	if (remaining <= WEATHER_HOST_REMINDER_MS) due.push("host_t48");
	if (remaining <= WEATHER_ADMIN_CRITICAL_MS) due.push("admin_t6");
	else if (remaining <= WEATHER_ADMIN_URGENT_MS) due.push("admin_t12");
	else if (remaining <= WEATHER_HOST_DEADLINE_MS) due.push("admin_t24");
	return due;
}

/** True while an Admin still has to act: Red at ≤ T-24h with no Host answer, or a Host Keep. */
export function needsAdminIntervention(state: WeatherDecisionState, now: Date): boolean {
	return dueWeatherAlerts(state, now).some((milestone) => milestone !== "host_t48");
}

const URGENCY_RANK: Record<WeatherAlertUrgency, number> = { normal: 0, urgent: 1, critical: 2 };

/** Urgency of an open intervention, from the time left (policy §5.4). */
export function interventionUrgency(startsAt: Date, now: Date): WeatherAlertUrgency {
	const remaining = msUntilStart(startsAt, now);
	if (remaining <= WEATHER_ADMIN_CRITICAL_MS) return "critical";
	if (remaining <= WEATHER_ADMIN_URGENT_MS) return "urgent";
	return "normal";
}

export function compareUrgency(a: WeatherAlertUrgency, b: WeatherAlertUrgency): number {
	return URGENCY_RANK[b] - URGENCY_RANK[a];
}

/** Ready-to-show Vietnamese text for each reminder. */
export function weatherAlertMessage(milestone: WeatherAlertMilestone, tripTitle: string): string {
	switch (milestone) {
		case "host_t48":
			return `Trip "${tripTitle}" đang có dự báo Đỏ. Vui lòng quyết định Giữ / Dời / Huỷ trước mốc 24 giờ trước giờ đi.`;
		case "admin_kept":
			return `Host giữ Trip "${tripTitle}" dù dự báo Đỏ. Admin xem lý do và phương án an toàn.`;
		case "admin_t24":
			return `Trip "${tripTitle}" dự báo Đỏ, Host chưa phản hồi. Cần Admin quyết định.`;
		case "admin_t12":
			return `Khẩn: Trip "${tripTitle}" vẫn dự báo Đỏ và chưa có quyết định. Cần Admin xử lý.`;
		case "admin_t6":
			return `Khẩn cấp: Trip "${tripTitle}" còn dưới 6 giờ, dự báo Đỏ và chưa có quyết định.`;
	}
}
