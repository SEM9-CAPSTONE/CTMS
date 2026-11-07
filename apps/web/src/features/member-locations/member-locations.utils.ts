import type { LocationFreshness, MemberLocation } from "./types";

/**
 * Freshness at the viewer's current time, from the server's `lastSeenAt` and approved threshold, so
 * a position that was "fresh" when fetched never stays labelled fresh as time passes (CTMS-066 §8).
 */
export function currentFreshness(
	member: Pick<MemberLocation, "lastSeenAt">,
	maxAgeSeconds: number,
	now: Date
): LocationFreshness {
	if (!member.lastSeenAt) return "unavailable";
	const ageSeconds = (now.getTime() - Date.parse(member.lastSeenAt)) / 1000;
	// A future-dated capture is never described as fresh.
	return ageSeconds >= 0 && ageSeconds <= maxAgeSeconds ? "fresh" : "stale";
}

export function hasSafetyWarning(member: MemberLocation): boolean {
	const behind = member.safety.behindSchedule?.status;
	return (
		member.safety.route?.type === "OFF_ROUTE" ||
		member.safety.gps?.type === "GPS_DEGRADED" ||
		behind === "BEHIND" ||
		behind === "SEVERELY_BEHIND"
	);
}

const FRESHNESS_RANK: Record<LocationFreshness, number> = { stale: 1, unavailable: 2, fresh: 3 };

/** Members needing attention first: safety warnings, then stale, then no data, then fresh. */
export function sortMembers(
	members: MemberLocation[],
	maxAgeSeconds: number,
	now: Date
): MemberLocation[] {
	const rank = (member: MemberLocation) =>
		hasSafetyWarning(member) ? 0 : FRESHNESS_RANK[currentFreshness(member, maxAgeSeconds, now)];
	return [...members].sort(
		(a, b) => rank(a) - rank(b) || (a.name ?? "").localeCompare(b.name ?? "", "vi")
	);
}

export function formatClock(value: string | null): string {
	if (!value) return "—";
	return new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export function formatAgo(value: string, now: Date): string {
	const seconds = Math.max(0, Math.floor((now.getTime() - Date.parse(value)) / 1000));
	if (seconds < 60) return "vừa xong";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes} phút trước`;
	const hours = Math.floor(minutes / 60);
	return `${hours} giờ ${minutes % 60} phút trước`;
}

export function formatCoordinates(location: NonNullable<MemberLocation["location"]>): string {
	const lat = location.latitude.toFixed(5);
	const lng = location.longitude.toFixed(5);
	return `${lat}, ${lng} · ±${Math.round(location.accuracyMeters)} m`;
}
