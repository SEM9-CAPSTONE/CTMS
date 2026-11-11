import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { ConfigService } from "@nestjs/config";
import type { GeoLineString } from "../trekking-routes/entities/trekking-route.entity";
import { isCanonicalLineStringCoordinates } from "../trekking-routes/validators/line-string.validator";
import { objectRecord, providerUrl, readProviderJson } from "./nchmf-http";
import { ROUTE_CONTEXT, routeEnvelope } from "./route-context.policy";
import type { TerrainPosition, WalkingLeg } from "./terrain.types";
import {
	WALKING_MAP,
	type WalkingWay,
	classifyWalkingWay,
	matchWalkingLegs,
} from "./walking-terrain.policy";

@Injectable()
export class WalkingTerrainService {
	constructor(private readonly config: ConfigService) {}
	async collect(
		geometry: GeoLineString,
		samples: { coordinates: TerrainPosition; distanceMeters: number }[],
		signal: AbortSignal
	): Promise<WalkingLeg[]> {
		const unknown = matchWalkingLegs(samples, []);
		if (this.config.get<string>("ROUTE_TERRAIN_ROAD_ENABLED") === "false") return unknown;
		const [west, south, east, north] = routeEnvelope(geometry, WALKING_MAP.matchMeters);
		if (
			east - west > WALKING_MAP.maxEnvelopeDegrees ||
			north - south > WALKING_MAP.maxEnvelopeDegrees
		)
			return unknown;
		try {
			const url = providerUrl(
				this.config.get<string>("ROUTE_SAFETY_OVERPASS_URL") ?? ROUTE_CONTEXT.overpassUrl
			);
			url.searchParams.set(
				"data",
				`[out:json][timeout:4];way["highway"~"^(footway|pedestrian|path|track|bridleway)$"](${south},${west},${north},${east});out tags geom ${WALKING_MAP.maxWays + 1};`
			);
			const response = objectRecord(
				await readProviderJson(url, {
					signal: AbortSignal.any([signal, AbortSignal.timeout(WALKING_MAP.timeoutMs)]),
					headers: {
						Accept: "application/json",
						"User-Agent": "CTMS/0.1 (walking route duration)",
					},
				})
			);
			if (
				response.remark ||
				!Array.isArray(response.elements) ||
				response.elements.length > WALKING_MAP.maxWays
			)
				return unknown;
			const ways: WalkingWay[] = [];
			let totalNodes = 0;
			for (const raw of response.elements) {
				if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
				const way = raw as Record<string, unknown>;
				if (
					way.type !== "way" ||
					!Array.isArray(way.geometry) ||
					way.geometry.length > WALKING_MAP.maxNodesPerWay ||
					!way.tags ||
					typeof way.tags !== "object" ||
					Array.isArray(way.tags)
				)
					continue;
				totalNodes += way.geometry.length;
				if (totalNodes > WALKING_MAP.maxTotalNodes) return unknown;
				const coordinates: unknown = way.geometry.map((rawPoint: unknown) => {
					if (!rawPoint || typeof rawPoint !== "object") return null;
					const point = rawPoint as Record<string, unknown>;
					return [point.lon, point.lat];
				});
				if (isCanonicalLineStringCoordinates(coordinates))
					ways.push({
						coordinates,
						terrain: classifyWalkingWay(way.tags as Record<string, unknown>),
					});
			}
			return matchWalkingLegs(samples, ways);
		} catch {
			return unknown;
		}
	}
}
