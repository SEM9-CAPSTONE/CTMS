import type { EmergencyAlertType } from "./types";

/** Same limit as the API (`EMERGENCY_BROADCAST_CONTENT_MAX_LENGTH`). */
export const EMERGENCY_BROADCAST_CONTENT_MAX_LENGTH = 1000;

export const EMERGENCY_ALERT_TYPE_OPTIONS: { value: EmergencyAlertType; label: string }[] = [
	{ value: "severe_weather", label: "Thời tiết nguy hiểm" },
	{ value: "evacuation", label: "Sơ tán" },
	{ value: "route_hazard", label: "Nguy hiểm trên tuyến" },
	{ value: "medical", label: "Y tế" },
	{ value: "security", label: "An ninh" },
	{ value: "other", label: "Khác" },
];

export function emergencyAlertTypeLabel(type: string): string {
	return EMERGENCY_ALERT_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? "Khẩn cấp";
}

/** Only upcoming and running Trips accept a broadcast (spec §12). */
export function isBroadcastableTripStatus(status: string): boolean {
	return status === "published" || status === "ongoing";
}

/** "14:29 08/11" in the viewer's local time, same as the mobile panel. */
export function formatBroadcastTime(iso: string): string {
	const date = new Date(iso);
	const two = (value: number) => String(value).padStart(2, "0");
	return `${two(date.getHours())}:${two(date.getMinutes())} ${two(date.getDate())}/${two(date.getMonth() + 1)}`;
}
