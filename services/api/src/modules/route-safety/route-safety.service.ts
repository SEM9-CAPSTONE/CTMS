import { createHash } from "node:crypto";
import {
	ForbiddenException,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { ConfigService } from "@nestjs/config";
import { isCanonicalLineStringCoordinates } from "../trekking-routes/validators/line-string.validator";
import type { AnalyzeRouteDto } from "./dto/analyze-route.dto";
import type { VerifiedZonesQueryDto } from "./dto/verified-zones-query.dto";
import { SAFETY_PROVIDERS } from "./live-safety.types";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { NchmfSafetyService } from "./nchmf-safety.service";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { OsmWaterService } from "./osm-water.service";
import {
	SAFETY_DEFAULT_CURRENT_AGE_MINUTES,
	SAFETY_DEFAULT_INCIDENT_AGE_MINUTES,
	SAFETY_DEFAULT_PROXIMITY_METERS,
	SAFETY_FEATURE_LIMIT,
	SAFETY_ROUTE_VERTEX_LIMIT,
	SEVERITY_ORDER,
	configuredNumber,
	safetyLifecycle,
} from "./route-safety.policy";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { RouteSafetyRepository } from "./route-safety.repository";
import type {
	RouteSafetyResult,
	SafetyCandidate,
	SafetyFeature,
	SafetySeverity,
	VerifiedZoneCollection,
} from "./route-safety.types";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { VndmsSafetyService } from "./vndms-safety.service";

@Injectable()
export class RouteSafetyService {
	constructor(
		private readonly repository: RouteSafetyRepository,
		private readonly config: ConfigService,
		private readonly liveSafety: NchmfSafetyService,
		private readonly events: VndmsSafetyService,
		private readonly water: OsmWaterService
	) {}

	async analyze(hostId: string, dto: AnalyzeRouteDto): Promise<RouteSafetyResult> {
		if (dto.routeId) {
			const owner = await this.repository.findOwner(dto.routeId);
			if (!owner) throw new NotFoundException("Trekking route not found");
			if (owner !== hostId)
				throw new ForbiddenException("Only the owning Host can analyze this route");
		}
		if (
			dto.geometry?.type !== "LineString" ||
			!isCanonicalLineStringCoordinates(dto.geometry.coordinates) ||
			dto.geometry.coordinates.length > SAFETY_ROUTE_VERTEX_LIMIT ||
			new Set(dto.geometry.coordinates.map((position) => position.join(","))).size < 2
		) {
			throw new UnprocessableEntityException(
				"A non-zero LineString with at most 10000 WGS84 positions is required"
			);
		}
		const proximity = configuredNumber(
			this.config.get<string>("ROUTE_SAFETY_PROXIMITY_METERS"),
			SAFETY_DEFAULT_PROXIMITY_METERS,
			1,
			5000
		);
		const snapshots = await Promise.all(
			SAFETY_PROVIDERS.filter((source) => !dto.source || source === dto.source).map((source) => {
				switch (source) {
					case "NCHMF":
						return this.liveSafety.collect(dto.geometry);
					case "VNDMS":
						return this.events.collect();
					case "OSM":
						return this.water.collect(dto.geometry, proximity);
				}
			})
		);
		const now = new Date();
		const spatialCandidates = await this.repository.candidates(
			hostId,
			dto.routeId,
			dto.geometry,
			proximity,
			snapshots.flatMap((snapshot) => snapshot.candidates),
			true
		);
		const candidates = spatialCandidates.filter(
			(candidate) =>
				candidate.sourceType !== "RESOURCE" ||
				(!["Polygon", "MultiPolygon"].includes(candidate.geometry.type) &&
					!["water_water", "water_surface", "water_lake", "water_reservoir"].includes(
						candidate.hazardType
					))
		);
		const features = candidates
			.slice(0, SAFETY_FEATURE_LIMIT)
			.map((candidate) => this.toFeature(candidate, now));
		const active = features.filter(
			(feature) =>
				feature.properties.lifecycleStatus === "ACTIVE" &&
				feature.properties.sourceType !== "RESOURCE"
		);
		const riskLevel = active.reduce<SafetySeverity>(
			(level, feature) =>
				SEVERITY_ORDER[feature.properties.severity] > SEVERITY_ORDER[level]
					? feature.properties.severity
					: level,
			"UNKNOWN"
		);
		const version = createHash("sha256")
			.update(JSON.stringify(features))
			.digest("hex")
			.slice(0, 24);
		return {
			liveSource: snapshots.find((snapshot) => snapshot.source.source === "NCHMF")?.source,
			sources: snapshots.map((snapshot) => snapshot.source),
			riskLevel,
			summary: {
				activeWarnings: active.filter(
					(feature) => feature.properties.sourceType === "OFFICIAL_CURRENT"
				).length,
				nearbyIncidents: active.filter(
					(feature) => feature.properties.sourceType === "FIELD_OBSERVATION"
				).length,
				hostDefinedDangerZones: active.filter(
					(feature) => feature.properties.sourceType === "HOST_DEFINED"
				).length,
				historicalFeatures: features.filter(
					(feature) => feature.properties.lifecycleStatus === "HISTORICAL"
				).length,
			},
			features: { type: "FeatureCollection", features },
			analyzedAt: now.toISOString(),
			dataVersion: version,
			truncated: candidates.length > SAFETY_FEATURE_LIMIT,
			coverage: "PARTIAL",
			proximityMeters: proximity,
		};
	}

	async verifiedZones(bounds: VerifiedZonesQueryDto): Promise<VerifiedZoneCollection> {
		if (bounds.west >= bounds.east || bounds.south >= bounds.north) {
			throw new UnprocessableEntityException({ code: "INVALID_MAP_BOUNDS" });
		}
		const candidates = await this.repository.verifiedZones(bounds);
		const now = new Date();
		return {
			type: "FeatureCollection",
			features: candidates
				.slice(0, SAFETY_FEATURE_LIMIT)
				.map((candidate) => this.toFeature(candidate, now)),
			generatedAt: now.toISOString(),
			truncated: candidates.length > SAFETY_FEATURE_LIMIT,
		};
	}

	private toFeature(candidate: SafetyCandidate, now: Date): SafetyFeature {
		const { id, geometry, ...properties } = candidate;
		for (const key of [
			"observedAt",
			"issuedAt",
			"fetchedAt",
			"validFrom",
			"validUntil",
			"updatedAt",
		] as const) {
			const value = properties[key];
			if (value) properties[key] = new Date(value).toISOString();
		}
		const fieldObservation = candidate.sourceType === "FIELD_OBSERVATION";
		const fallback = fieldObservation
			? SAFETY_DEFAULT_INCIDENT_AGE_MINUTES
			: SAFETY_DEFAULT_CURRENT_AGE_MINUTES;
		const setting = fieldObservation
			? "ROUTE_SAFETY_INCIDENT_AGE_MINUTES"
			: "ROUTE_SAFETY_CURRENT_AGE_MINUTES";
		properties.lifecycleStatus = safetyLifecycle(
			{ ...candidate, ...properties },
			now,
			configuredNumber(this.config.get<string>(setting), fallback, 1, 525600)
		);
		return { type: "Feature", id, geometry, properties };
	}
}
