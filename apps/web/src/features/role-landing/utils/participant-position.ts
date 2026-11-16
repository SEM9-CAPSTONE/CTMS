import type { GeoJsonLineString } from "../../trekking-routes/types";
import { routeBounds } from "../../trekking-routes/utils/checkpoint-map";
import type { MapParticipant } from "../types/active-trip-map";

export const freshnessLabels = {
	fresh: "Vị trí mới",
	stale: "Vị trí cũ",
	unavailable: "Chưa có vị trí",
};
export const formatTime = new Intl.DateTimeFormat("vi-VN", {
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	timeZone: "Asia/Ho_Chi_Minh",
});

export function participantLabel(participant: Pick<MapParticipant, "name" | "role">) {
	return (
		participant.name?.replace(/^(?:Camper|Porter)\s+/i, "").trim() ||
		(participant.role === "porter" ? "Người hỗ trợ chưa có tên" : "Thành viên chưa có tên")
	);
}

export function locationFreshness(
	lastSeenAt: string | null,
	hasLocation: boolean,
	maxAgeSeconds: number,
	now: number
): MapParticipant["freshness"] {
	if (!hasLocation || !lastSeenAt) return "unavailable";
	const age = (now - Date.parse(lastSeenAt)) / 1000;
	return age >= 0 && age <= maxAgeSeconds ? "fresh" : "stale";
}

export function relativePositionTime(value: string, now: number): string {
	const minutes = Math.max(0, Math.floor((now - Date.parse(value)) / 60_000));
	if (minutes < 1) return "vừa ghi nhận";
	if (minutes < 60) return `${minutes} phút trước`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} giờ trước`;
	return `${Math.floor(hours / 24)} ngày trước`;
}

/** Presentation only: this is the route viewport, not an authoritative route-deviation state. */
export function isOutsideRouteArea(
	location: MapParticipant["location"],
	geometry: GeoJsonLineString
): boolean {
	if (!location || geometry.coordinates.length === 0) return false;
	const bounds = routeBounds(geometry.coordinates);
	return (
		location.longitude < bounds.minLongitude ||
		location.longitude > bounds.maxLongitude ||
		location.latitude < bounds.minLatitude ||
		location.latitude > bounds.maxLatitude
	);
}

export function participantMapCode(role: MapParticipant["role"], index: number): string {
	return `${role === "porter" ? "P" : "C"}${index + 1}`;
}

export function participantRoleLabel(role: MapParticipant["role"]): string {
	return role === "porter" ? "Người hỗ trợ" : "Người tham gia";
}
