import { createHash } from "node:crypto";
import { Injectable, UnprocessableEntityException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { ConfigService } from "@nestjs/config";
import type { GeoLineString } from "../trekking-routes/entities/trekking-route.entity";
import { isCanonicalLineStringCoordinates } from "../trekking-routes/validators/line-string.validator";
import { ROUTE_DURATION, estimateRouteDuration } from "./route-duration.policy";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { TerrainCacheService } from "./terrain-cache.service";
import { TERRAIN, sampleTerrain, summarizeTerrain } from "./terrain.policy";
import type { TerrainResult, TerrainSample } from "./terrain.types";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { WalkingTerrainService } from "./walking-terrain.service";

@Injectable()
export class TerrainService {
	private readonly inFlight = new Map<string, Promise<TerrainResult>>();
	constructor(
		private readonly config: ConfigService,
		private readonly cache: TerrainCacheService,
		private readonly walkingTerrain: WalkingTerrainService
	) {}

	async analyze(hostId: string, geometry: GeoLineString): Promise<TerrainResult> {
		const sampled = this.sampleRoute(geometry);
		const key = `terrain:${ROUTE_DURATION.modelVersion}:${hostId}:${createHash("sha256").update(JSON.stringify(geometry.coordinates)).digest("hex")}`;
		const existing = this.inFlight.get(key);
		if (existing) return existing;
		const promise = this.collect(key, sampled, geometry);
		this.inFlight.set(key, promise);
		try {
			return await promise;
		} finally {
			this.inFlight.delete(key);
		}
	}

	async validateMinimumDuration(
		hostId: string,
		geometry: GeoLineString,
		minutes: number
	): Promise<void> {
		const sampled = this.sampleRoute(geometry);
		const basic = estimateRouteDuration(
			[{ distanceMeters: sampled.distanceMeters, terrain: "UNKNOWN" }],
			null,
			null
		);
		if (!Number.isSafeInteger(minutes) || minutes < basic.minimumMinutes)
			this.durationError(basic.minimumMinutes);
		const result = await this.analyze(hostId, geometry);
		if (minutes < result.minimumMinutes) this.durationError(result.minimumMinutes);
	}

	private durationError(minimumMinutes: number): never {
		throw new UnprocessableEntityException({
			statusCode: 422,
			code: ROUTE_DURATION.errorCode,
			minimumMinutes,
			message: [
				{
					field: "expectedDurationMinutes",
					errors: [`Moving duration must be at least ${minimumMinutes} minutes`],
				},
			],
		});
	}

	private sampleRoute(geometry: GeoLineString): ReturnType<typeof sampleTerrain> {
		if (
			geometry?.type !== "LineString" ||
			!isCanonicalLineStringCoordinates(geometry.coordinates) ||
			geometry.coordinates.length > TERRAIN.maxVertices
		) {
			throw new UnprocessableEntityException("Invalid route geometry");
		}
		const sampled = sampleTerrain(geometry.coordinates);
		if (!(sampled.distanceMeters > 0))
			throw new UnprocessableEntityException("Route must have a non-zero length");
		return sampled;
	}

	private async collect(
		key: string,
		sampled: ReturnType<typeof sampleTerrain>,
		geometry: GeoLineString
	): Promise<TerrainResult> {
		const cached = await this.cache.get(key);
		if (cached) return cached;
		const fallback: TerrainResult = {
			status: "NOT_CONFIGURED",
			source: "MapTiler",
			distanceMeters: sampled.distanceMeters,
			sampleSpacingMeters: sampled.sampleSpacingMeters,
			ascentMeters: null,
			descentMeters: null,
			maxSlopePercent: null,
			...estimateRouteDuration(
				[{ distanceMeters: sampled.distanceMeters, terrain: "UNKNOWN" }],
				null,
				null
			),
			legs: [{ distanceMeters: sampled.distanceMeters, terrain: "UNKNOWN" }],
			profile: [],
		};
		const apiKey = this.config.get<string>("MAPTILER_API_KEY");
		if (!apiKey) return fallback;
		try {
			if (
				sampled.samples.some(
					(s) => Math.abs(s.coordinates[1]) > 85 || Math.abs(s.coordinates[0]) >= 180
				)
			)
				throw new Error("Outside elevation coverage");
			const signal = AbortSignal.timeout(TERRAIN.timeoutMs);
			const profile: TerrainSample[] = [];
			for (let offset = 0; offset < sampled.samples.length; offset += TERRAIN.batchSize) {
				const batch = sampled.samples.slice(offset, offset + TERRAIN.batchSize);
				const locations = batch.map((s) => s.coordinates.join(",")).join(";");
				const url = new URL(`https://api.maptiler.com/elevation/${locations}.json`);
				url.searchParams.set("key", apiKey);
				const response = await fetch(url, { signal, redirect: "error" });
				if (!response.ok) throw new Error("Elevation unavailable");
				const rows: unknown = await response.json();
				if (!Array.isArray(rows) || rows.length !== batch.length)
					throw new Error("Incomplete elevation response");
				for (let i = 0; i < rows.length; i++) {
					const row: unknown = rows[i];
					if (
						!Array.isArray(row) ||
						row.length !== 3 ||
						!row.every((n: unknown) => typeof n === "number" && Number.isFinite(n)) ||
						Math.abs(row[0] - batch[i].coordinates[0]) > 0.00001 ||
						Math.abs(row[1] - batch[i].coordinates[1]) > 0.00001 ||
						row[2] < -12000 ||
						row[2] > 10000
					)
						throw new Error("Invalid elevation response");
					profile.push({ ...batch[i], elevationMeters: row[2], slopePercent: 0 });
				}
			}
			const legs = await this.walkingTerrain.collect(geometry, sampled.samples, signal);
			const result = summarizeTerrain(
				profile,
				sampled.distanceMeters,
				sampled.sampleSpacingMeters,
				legs
			);
			await this.cache.set(key, result);
			return result;
		} catch {
			return { ...fallback, status: "UNAVAILABLE" };
		}
	}
}
