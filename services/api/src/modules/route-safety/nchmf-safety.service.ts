import { Injectable, Logger } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { ConfigService } from "@nestjs/config";
import type { GeoLineString } from "../trekking-routes/entities/trekking-route.entity";
import { objectRecord, providerUrl, readProviderJson } from "./nchmf-http";
import { NCHMF, nchmfHour } from "./nchmf-safety.policy";
import type { LiveSafetySnapshot, NchmfWarning } from "./nchmf-safety.types";
import { parseNchmfWarnings, warningCandidates } from "./nchmf-warning";
import { routeEnvelope } from "./route-context.policy";
import { configuredNumber } from "./route-safety.policy";
import { isSafetyGeometry } from "./safety-input";

@Injectable()
export class NchmfSafetyService {
	private readonly logger = new Logger(NchmfSafetyService.name);
	private warningsInFlight?: Promise<NchmfWarning[]>;

	constructor(private readonly config: ConfigService) {}

	async collect(geometry: GeoLineString): Promise<LiveSafetySnapshot> {
		const source: LiveSafetySnapshot["source"] = {
			source: "NCHMF",
			status: "UNAVAILABLE",
			checkedAt: new Date().toISOString(),
			dataTime: null,
			validUntil: null,
		};
		if (this.config.get<string>("ROUTE_SAFETY_LIVE_ENABLED") === "false") {
			return { source: { ...source, status: "DISABLED" }, candidates: [] };
		}
		try {
			const signal = AbortSignal.timeout(
				configuredNumber(
					this.config.get<string>("ROUTE_SAFETY_LIVE_TIMEOUT_MS"),
					NCHMF.timeoutMs,
					1000,
					30000
				)
			);
			const warnings = await this.currentWarnings(signal);
			if (!warnings.length) return { source: { ...source, status: "EMPTY" }, candidates: [] };
			const url = providerUrl(
				this.config.get<string>("ROUTE_SAFETY_NCHMF_BOUNDARIES_URL") ?? NCHMF.boundariesUrl
			);
			const proximity = configuredNumber(
				this.config.get<string>("ROUTE_SAFETY_PROXIMITY_METERS"),
				300,
				1,
				5000
			);
			const bbox = routeEnvelope(geometry, proximity);
			for (const [key, value] of Object.entries({
				service: "WFS",
				version: "2.0.0",
				request: "GetFeature",
				typeNames: NCHMF.boundaryLayer,
				outputFormat: "application/json",
				srsName: "CRS:84",
				bbox: `${bbox.join(",")},CRS:84`,
				count: String(NCHMF.maxBoundaries),
			}))
				url.searchParams.set(key, value);
			const collection = objectRecord(await readProviderJson(url, { signal }));
			if (
				collection.type !== "FeatureCollection" ||
				!Array.isArray(collection.features) ||
				collection.features.length > NCHMF.maxBoundaries ||
				typeof collection.numberMatched !== "number" ||
				collection.numberMatched < collection.features.length ||
				collection.numberReturned !== collection.features.length
			) {
				throw new Error("Invalid NCHMF boundaries");
			}
			const byCommune = new Map(warnings.map((warning) => [warning.communeId, warning]));
			const fetchedAt = new Date().toISOString();
			const reference = providerUrl(
				this.config.get<string>("ROUTE_SAFETY_NCHMF_BASE_URL") ?? NCHMF.baseUrl
			).origin;
			const candidates = collection.features.flatMap((raw: unknown) => {
				const feature = objectRecord(raw);
				const properties = objectRecord(feature.properties);
				if (
					!Number.isSafeInteger(properties.gid) ||
					!isSafetyGeometry(feature.geometry) ||
					!["Polygon", "MultiPolygon"].includes(feature.geometry.type)
				) {
					throw new Error("Invalid NCHMF administrative geometry");
				}
				const warning = byCommune.get(Number(properties.gid));
				return warning ? warningCandidates(warning, feature.geometry, fetchedAt, reference) : [];
			});
			return {
				source: {
					...source,
					status: collection.numberMatched > collection.features.length ? "PARTIAL" : "LIVE",
					dataTime: warnings[0].dataTime,
					validUntil: warnings[0].validUntil,
				},
				candidates,
			};
		} catch {
			// No stale warning cache is substituted for a failed live request.
			this.logger.warn("NCHMF live collection failed; current external warnings are unavailable");
			return { source, candidates: [] };
		}
	}

	private async currentWarnings(signal: AbortSignal): Promise<NchmfWarning[]> {
		// Share only an active network request. The next analysis fetches upstream again.
		if (this.warningsInFlight) return this.warningsInFlight;
		const promise = this.fetchWarnings(signal);
		this.warningsInFlight = promise;
		try {
			return await promise;
		} finally {
			if (this.warningsInFlight === promise) this.warningsInFlight = undefined;
		}
	}

	private async fetchWarnings(signal: AbortSignal): Promise<NchmfWarning[]> {
		const now = Date.now();
		const baseUrl = providerUrl(
			this.config.get<string>("ROUTE_SAFETY_NCHMF_BASE_URL") ?? NCHMF.baseUrl
		);
		const url = new URL(NCHMF.warningsPath, baseUrl);
		for (let offset = 0; offset <= NCHMF.lookbackHours; offset++) {
			const body = new URLSearchParams({
				sogiodubao: String(NCHMF.forecastHours),
				date: nchmfHour(now - offset * NCHMF.hourMs),
			});
			const rows = parseNchmfWarnings(
				await readProviderJson(url, { method: "POST", body, signal }),
				now
			);
			if (rows.length) {
				if (rows.some((row) => row.dataTime !== rows[0].dataTime))
					throw new Error("Mixed NCHMF snapshot");
				return rows;
			}
		}
		return [];
	}
}
