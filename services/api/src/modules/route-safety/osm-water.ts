import { objectRecord } from "./nchmf-http";
import type { SafetyCandidate, SafetyGeometry } from "./route-safety.types";
import { isSafetyGeometry } from "./safety-input";

const WATER_LABELS: Readonly<Record<string, string>> = {
	spring: "Mạch nước tự nhiên",
	drinking_water: "Điểm cấp nước được gắn nhãn drinking_water",
	water_point: "Điểm lấy nước",
	water_well: "Giếng nước",
	stream: "Suối",
	river: "Sông",
};

export function osmWater(raw: unknown, fetchedAt: string): SafetyCandidate | null {
	const row = objectRecord(raw);
	const tags = objectRecord(row.tags);
	if (!Number.isSafeInteger(row.id) || !["node", "way"].includes(String(row.type))) return null;
	const kind = [tags.natural, tags.amenity, tags.man_made, tags.waterway].find(
		(value) => typeof value === "string" && WATER_LABELS[value]
	);
	if (typeof kind !== "string") return null;
	let geometry: unknown = { type: "Point", coordinates: [row.lon, row.lat] };
	if (row.type === "way") {
		if (!Array.isArray(row.geometry)) return null;
		const coordinates = row.geometry.map((point: unknown) => {
			const p = objectRecord(point);
			return [p.lon, p.lat];
		});
		geometry = { type: "LineString", coordinates };
	}
	if (!isSafetyGeometry(geometry)) return null;
	const name = typeof tags.name === "string" ? tags.name.slice(0, 300) : WATER_LABELS[kind];
	const drinking =
		tags.drinking_water === "no"
			? "Nguồn được gắn nhãn không uống được."
			: "Chưa xác minh hiện có nước hoặc chất lượng nước uống.";
	return {
		id: `live:OSM:${row.type}:${row.id}`,
		source: "OSM",
		sourceType: "RESOURCE",
		sourceReference: `https://www.openstreetmap.org/${row.type}/${row.id}`,
		hazardType: `water_${kind}`,
		severity: "UNKNOWN",
		geometry: geometry as SafetyGeometry,
		geometryRole: "mapped_water_resource",
		description: `${name} — ${WATER_LABELS[kind]}. ${drinking}`,
		observedAt: null,
		issuedAt: null,
		fetchedAt,
		validFrom: null,
		validUntil: null,
		updatedAt:
			typeof row.timestamp === "string" && Number.isFinite(Date.parse(row.timestamp))
				? new Date(row.timestamp).toISOString()
				: fetchedAt,
		lifecycleStatus: "UNKNOWN",
		verificationStatus: "UNVERIFIED",
		accuracyMeters: null,
		distanceMeters: 0,
		intersects: false,
		radiusMeters: null,
	};
}
