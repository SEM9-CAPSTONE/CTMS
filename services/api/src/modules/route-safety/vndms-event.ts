import { objectRecord } from "./nchmf-http";
import { vndmsTime } from "./route-context.policy";
import type { SafetyCandidate } from "./route-safety.types";
import { isSafetyGeometry } from "./safety-input";

export function vndmsEvent(
	raw: unknown,
	fetchedAt: string,
	reference: string
): SafetyCandidate | null {
	const row = objectRecord(raw);
	const geometry = { type: "Point", coordinates: [row.lon, row.lat] };
	const observedAt = vndmsTime(row.time_start);
	const updatedAt = vndmsTime(row.time_update) ?? observedAt;
	if (
		!Number.isSafeInteger(row.id) ||
		!isSafetyGeometry(geometry) ||
		typeof row.name_vn !== "string" ||
		!row.name_vn.trim() ||
		typeof row.da_ketthuc !== "boolean" ||
		!observedAt ||
		!updatedAt ||
		Date.parse(observedAt) > Date.parse(fetchedAt) ||
		Date.parse(updatedAt) > Date.parse(fetchedAt)
	)
		return null;
	const title = row.name_vn.slice(0, 500);
	const places = typeof row.kv_anhhuong === "string" ? row.kv_anhhuong.slice(0, 1000) : "";
	const risk =
		typeof row.disaster_level === "string" && /^[1-5]$/.test(row.disaster_level)
			? row.disaster_level
			: null;
	return {
		id: `live:VNDMS:${row.id}`,
		source: "VNDMS",
		sourceReference: reference,
		sourceType: row.da_ketthuc ? "BASE_HISTORICAL" : "OFFICIAL_CURRENT",
		hazardType: /sạt lở/i.test(title) ? "landslide" : "disaster_event",
		// The provider's disaster risk scale is retained in the description, not converted to an invented severity.
		severity: "UNKNOWN",
		geometry,
		geometryRole: "representative_event_location",
		description: `${title}${places ? ` — ${places}` : ""}${risk ? `. Cấp rủi ro do nguồn cung cấp: ${risk}` : ""}. Vị trí đại diện do VNDMS cung cấp, không phải đường bao vùng ảnh hưởng.`,
		observedAt,
		issuedAt: updatedAt,
		fetchedAt,
		validFrom: null,
		validUntil: null,
		updatedAt,
		lifecycleStatus: row.da_ketthuc ? "RESOLVED" : "ACTIVE",
		verificationStatus: "SOURCE_PROVIDED",
		accuracyMeters: null,
		distanceMeters: 0,
		intersects: false,
		radiusMeters: null,
	};
}
