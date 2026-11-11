import { objectRecord } from "./nchmf-http";
import { NCHMF, NCHMF_SEVERITY, nchmfDate } from "./nchmf-safety.policy";
import type { NchmfWarning } from "./nchmf-safety.types";
import { SEVERITY_ORDER } from "./route-safety.policy";
import type { SafetyCandidate, SafetyGeometry, SafetySeverity } from "./route-safety.types";

const severity = (value: unknown): SafetySeverity | null => {
	if (value == null || value === "") return null;
	const result = NCHMF_SEVERITY[String(value)];
	if (!result) throw new Error("Unknown NCHMF severity");
	return result;
};

export function parseNchmfWarnings(value: unknown, now: number): NchmfWarning[] {
	if (!Array.isArray(value) || value.length > NCHMF.maxWarningRows) {
		throw new Error("Invalid NCHMF warning list");
	}
	const warnings = new Map<number, NchmfWarning>();
	for (const raw of value) {
		const row = objectRecord(raw);
		if (!Number.isSafeInteger(row.commune_id) || Number(row.commune_id) <= 0) {
			throw new Error("Invalid NCHMF commune identity");
		}
		const dataTime = nchmfDate(row.thoigian);
		const issuedAt = nchmfDate(row.ngay_capnhat);
		if (row.sogiodubao !== NCHMF.forecastHours || Date.parse(issuedAt) > now) {
			throw new Error("Invalid NCHMF issue time or horizon");
		}
		const validUntil = new Date(
			Date.parse(dataTime) + NCHMF.forecastHours * NCHMF.hourMs
		).toISOString();
		// Refetching old data never grants it a new validity window.
		if (Date.parse(dataTime) > now || Date.parse(validUntil) <= now) {
			throw new Error("NCHMF snapshot is not current");
		}
		const warning: NchmfWarning = {
			communeId: Number(row.commune_id),
			name: [row.commune_name, row.district_name, row.provinceName]
				.filter((part): part is string => typeof part === "string")
				.join(", ")
				.slice(0, 500),
			dataTime,
			issuedAt,
			validUntil,
			landslide: severity(row.nguycosatlo),
			flashFlood: severity(row.nguycoluquet),
		};
		// The public feed repeats old commune IDs for their new administrative mappings.
		const previous = warnings.get(warning.communeId);
		if (previous && previous.dataTime !== warning.dataTime) {
			throw new Error("NCHMF returned mixed snapshots");
		}
		if (previous) {
			for (const key of ["landslide", "flashFlood"] as const) {
				if (
					SEVERITY_ORDER[previous[key] ?? "UNKNOWN"] > SEVERITY_ORDER[warning[key] ?? "UNKNOWN"]
				) {
					warning[key] = previous[key];
				}
			}
		}
		warnings.set(warning.communeId, warning);
	}
	return [...warnings.values()];
}

export function warningCandidates(
	warning: NchmfWarning,
	geometry: SafetyGeometry,
	fetchedAt: string,
	sourceReference: string
): SafetyCandidate[] {
	return (
		[
			["landslide", warning.landslide, "Sạt lở đất"],
			["flash_flood", warning.flashFlood, "Lũ quét"],
		] as const
	).flatMap(([hazardType, level, label]) =>
		level
			? [
					{
						id: `live:NCHMF:${warning.communeId}:${hazardType}`,
						sourceType: "OFFICIAL_CURRENT" as const,
						source: "NCHMF",
						sourceReference,
						hazardType,
						severity: level,
						geometry,
						geometryRole: "administrative_warning_area",
						description: `${label}: ${warning.name}. Phạm vi cảnh báo theo địa giới hành chính, không phải vị trí sự cố được xác nhận.`,
						observedAt: warning.dataTime,
						issuedAt: warning.issuedAt,
						fetchedAt,
						validFrom: warning.dataTime,
						validUntil: warning.validUntil,
						updatedAt: warning.issuedAt,
						lifecycleStatus: "ACTIVE" as const,
						verificationStatus: "SOURCE_PROVIDED" as const,
						accuracyMeters: null,
						distanceMeters: 0,
						intersects: false,
						radiusMeters: null,
					},
				]
			: []
	);
}
