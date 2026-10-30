import { Injectable, Logger } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { ConfigService } from "@nestjs/config";
import type { GeoLineString } from "../trekking-routes/entities/trekking-route.entity";
import type { LiveSafetySnapshot } from "./live-safety.types";
import { objectRecord } from "./nchmf-http";
import { osmWater } from "./osm-water";
import { waterData } from "./osm-water-query";
import { ROUTE_CONTEXT, routeEnvelope, sourceStatus } from "./route-context.policy";
import { configuredNumber } from "./route-safety.policy";

@Injectable()
export class OsmWaterService {
	private readonly logger = new Logger(OsmWaterService.name);
	constructor(private readonly config: ConfigService) {}

	async collect(geometry: GeoLineString, proximity: number): Promise<LiveSafetySnapshot> {
		const source = sourceStatus("OSM");
		if (this.config.get<string>("ROUTE_SAFETY_WATER_ENABLED") === "false") {
			return { source: { ...source, status: "DISABLED" }, candidates: [] };
		}
		const [west, south, east, north] = routeEnvelope(geometry, proximity);
		if (
			east - west > ROUTE_CONTEXT.maxWaterEnvelopeDegrees ||
			north - south > ROUTE_CONTEXT.maxWaterEnvelopeDegrees
		) {
			return { source: { ...source, status: "PARTIAL" }, candidates: [] };
		}
		try {
			const signal = AbortSignal.timeout(
				configuredNumber(
					this.config.get<string>("ROUTE_SAFETY_CONTEXT_TIMEOUT_MS"),
					ROUTE_CONTEXT.timeoutMs,
					1000,
					30000
				)
			);
			const response = await waterData(this.config, [west, south, east, north], signal);
			if (!Array.isArray(response.elements)) throw new Error("Invalid Overpass response");
			let partial =
				Boolean(response.remark) || response.elements.length > ROUTE_CONTEXT.maxWaterRecords;
			const candidates = [];
			for (const element of response.elements.slice(0, ROUTE_CONTEXT.maxWaterRecords)) {
				try {
					const resource = osmWater(element, source.checkedAt);
					if (resource) candidates.push(resource);
					else partial = true;
				} catch {
					partial = true;
				}
			}
			const metadata = response.osm3s ? objectRecord(response.osm3s) : {};
			const timestamp = metadata.timestamp_osm_base;
			return {
				source: {
					...source,
					status: partial ? "PARTIAL" : candidates.length ? "LIVE" : "EMPTY",
					dataTime:
						typeof timestamp === "string" && Number.isFinite(Date.parse(timestamp))
							? new Date(timestamp).toISOString()
							: null,
				},
				candidates,
			};
		} catch {
			this.logger.warn("OSM water collection failed; water data unavailable");
			return { source, candidates: [] };
		}
	}
}
