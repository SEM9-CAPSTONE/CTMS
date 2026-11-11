import {
	ForbiddenException,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { NchmfSafetyService } from "./nchmf-safety.service";
import type { OsmWaterService } from "./osm-water.service";
import { safetyLifecycle } from "./route-safety.policy";
import type { RouteSafetyRepository } from "./route-safety.repository";
import { RouteSafetyService } from "./route-safety.service";
import type { SafetyCandidate } from "./route-safety.types";
import { parseSafetyInput } from "./safety-input";
import type { VndmsSafetyService } from "./vndms-safety.service";

const NOW = new Date("2026-10-29T12:00:00Z");
const geometry = {
	type: "LineString" as const,
	coordinates: [
		[108, 12],
		[108.1, 12.1],
	] as Array<[number, number]>,
};
const candidate = (overrides: Partial<SafetyCandidate> = {}): SafetyCandidate => ({
	id: "external:1",
	sourceType: "OFFICIAL_CURRENT",
	source: "NCHMF",
	sourceReference: "reference",
	hazardType: "landslide",
	severity: "HIGH",
	geometry: { type: "Point", coordinates: [108, 12] },
	geometryRole: "administrative_warning_area",
	description: "Warning",
	observedAt: "2026-10-29T11:00:00Z",
	issuedAt: null,
	fetchedAt: "2026-10-29T12:00:00Z",
	validFrom: null,
	validUntil: null,
	updatedAt: "2026-10-29T11:00:00Z",
	lifecycleStatus: "ACTIVE",
	verificationStatus: "SOURCE_PROVIDED",
	accuracyMeters: null,
	distanceMeters: 20,
	intersects: false,
	radiusMeters: null,
	...overrides,
});

describe("Route Safety freshness and lifecycle BR-473", () => {
	it("uses provider validity, including expiry exactly at the deadline", () => {
		expect(safetyLifecycle(candidate({ validUntil: NOW.toISOString() }), NOW, 360)).toBe("EXPIRED");
		expect(safetyLifecycle(candidate({ validUntil: "2026-10-29T13:00:00Z" }), NOW, 360)).toBe(
			"ACTIVE"
		);
	});
	it("does not renew history or stale observations using fetch time", () => {
		expect(
			safetyLifecycle(
				candidate({ sourceType: "BASE_HISTORICAL", observedAt: "2020-01-01T00:00:00Z" }),
				NOW,
				360
			)
		).toBe("HISTORICAL");
		expect(safetyLifecycle(candidate({ observedAt: "2020-01-01T00:00:00Z" }), NOW, 360)).toBe(
			"STALE"
		);
		expect(safetyLifecycle(candidate({ observedAt: null }), NOW, 360)).toBe("UNKNOWN");
	});
	it("preserves resolved incidents and future validity", () => {
		expect(safetyLifecycle(candidate({ lifecycleStatus: "RESOLVED" }), NOW, 360)).toBe("RESOLVED");
		expect(safetyLifecycle(candidate({ validFrom: "2026-10-29T13:00:00Z" }), NOW, 360)).toBe(
			"SCHEDULED"
		);
		expect(
			safetyLifecycle(candidate({ sourceType: "HOST_DEFINED", observedAt: null }), NOW, 360)
		).toBe("ACTIVE");
	});
});

describe("RouteSafetyService", () => {
	const repository = { findOwner: jest.fn(), candidates: jest.fn() };
	const liveSafety = { collect: jest.fn() };
	const events = { collect: jest.fn() };
	const water = { collect: jest.fn() };
	const service = new RouteSafetyService(
		repository as unknown as RouteSafetyRepository,
		new ConfigService(),
		liveSafety as unknown as NchmfSafetyService,
		events as unknown as VndmsSafetyService,
		water as unknown as OsmWaterService
	);
	beforeEach(() => {
		jest.useFakeTimers().setSystemTime(NOW);
		jest.clearAllMocks();
		events.collect.mockResolvedValue({
			source: { source: "VNDMS", status: "EMPTY" },
			candidates: [],
		});
		water.collect.mockResolvedValue({ source: { source: "OSM", status: "EMPTY" }, candidates: [] });
		repository.candidates.mockResolvedValue([]);
		liveSafety.collect.mockResolvedValue({
			source: {
				source: "NCHMF",
				status: "LIVE",
				checkedAt: NOW.toISOString(),
				dataTime: NOW.toISOString(),
				validUntil: null,
			},
			candidates: [],
		});
	});
	afterEach(() => jest.useRealTimers());
	it("excludes stored water surfaces while retaining springs, streams and hazard polygons", async () => {
		const polygon = {
			type: "Polygon" as const,
			coordinates: [
				[
					[108, 12],
					[108.01, 12],
					[108.01, 12.01],
					[108, 12],
				],
			] as [number, number][][],
		};
		repository.candidates.mockResolvedValue([
			candidate({ id: "spring", sourceType: "RESOURCE", hazardType: "water_spring" }),
			candidate({ id: "stream", sourceType: "RESOURCE", hazardType: "water_stream", geometry }),
			candidate({
				id: "lake",
				sourceType: "RESOURCE",
				hazardType: "water_water",
				geometry: polygon,
			}),
			candidate({ id: "danger", geometry: polygon }),
		]);
		const result = await service.analyze("host", { geometry });
		expect(result.features.features.map((feature) => feature.id)).toEqual([
			"spring",
			"stream",
			"danger",
		]);
	});
	it("returns a selected provider without waiting for or contacting the other providers", async () => {
		const result = await service.analyze("host", { geometry, source: "NCHMF" });
		expect(result.sources.map((s) => s.source)).toEqual(["NCHMF"]);
		expect(events.collect).not.toHaveBeenCalled();
		expect(water.collect).not.toHaveBeenCalled();
	});
	it("rejects another Host and a missing saved route before spatial reads", async () => {
		repository.findOwner.mockResolvedValue("other");
		await expect(service.analyze("host", { routeId: "route", geometry })).rejects.toBeInstanceOf(
			ForbiddenException
		);
		repository.findOwner.mockResolvedValue(null);
		await expect(service.analyze("host", { routeId: "route", geometry })).rejects.toBeInstanceOf(
			NotFoundException
		);
		expect(repository.candidates).not.toHaveBeenCalled();
		expect(liveSafety.collect).not.toHaveBeenCalled();
		expect(events.collect).not.toHaveBeenCalled();
		expect(water.collect).not.toHaveBeenCalled();
	});
	it("rejects zero length or invalid coordinates", async () => {
		await expect(
			service.analyze("host", {
				geometry: {
					type: "LineString",
					coordinates: [
						[108, 12],
						[108, 12],
					],
				},
			})
		).rejects.toBeInstanceOf(UnprocessableEntityException);
		await expect(
			service.analyze("host", {
				geometry: {
					type: "LineString",
					coordinates: [
						[181, 12],
						[108, 12],
					],
				},
			})
		).rejects.toBeInstanceOf(UnprocessableEntityException);
	});
	it("reports UNKNOWN rather than safe when no evidence exists", async () => {
		const result = await service.analyze("host", { geometry });
		expect(result.riskLevel).toBe("UNKNOWN");
		expect(result.features.features).toEqual([]);
		expect(result.coverage).toBe("PARTIAL");
	});
	it("fetches live warnings before spatial analysis and excludes stored current warnings", async () => {
		const live = candidate({ id: "live:NCHMF:1:landslide" });
		liveSafety.collect.mockResolvedValueOnce({
			source: { source: "NCHMF", status: "LIVE" },
			candidates: [live],
		});
		const result = await service.analyze("host", { geometry });
		expect(repository.candidates).toHaveBeenCalledWith(
			"host",
			undefined,
			geometry,
			300,
			[live],
			true
		);
		expect(liveSafety.collect.mock.invocationCallOrder[0]).toBeLessThan(
			repository.candidates.mock.invocationCallOrder[0]
		);
		expect(result.liveSource?.status).toBe("LIVE");
	});
	it("returns an explicit source failure without substituting imported current warnings", async () => {
		liveSafety.collect.mockResolvedValueOnce({
			source: { source: "NCHMF", status: "UNAVAILABLE" },
			candidates: [],
		});
		const result = await service.analyze("host", { geometry });
		expect(result.liveSource?.status).toBe("UNAVAILABLE");
		expect(result.riskLevel).toBe("UNKNOWN");
		expect(repository.candidates).toHaveBeenCalledWith("host", undefined, geometry, 300, [], true);
	});
	it("merges live hazard points and water independently of NCHMF availability", async () => {
		const point = candidate({ id: "live:VNDMS:4963", source: "VNDMS" });
		const resource = candidate({ id: "live:OSM:node:1", sourceType: "RESOURCE", source: "OSM" });
		events.collect.mockResolvedValueOnce({
			source: { source: "VNDMS", status: "LIVE" },
			candidates: [point],
		});
		water.collect.mockResolvedValueOnce({
			source: { source: "OSM", status: "LIVE" },
			candidates: [resource],
		});
		liveSafety.collect.mockResolvedValueOnce({
			source: { source: "NCHMF", status: "UNAVAILABLE" },
			candidates: [],
		});
		const result = await service.analyze("host", { geometry });
		expect(repository.candidates).toHaveBeenCalledWith(
			"host",
			undefined,
			geometry,
			300,
			[point, resource],
			true
		);
		expect(water.collect).toHaveBeenCalledWith(geometry, 300);
		expect(result.sources.map((s) => s.status)).toEqual(["UNAVAILABLE", "LIVE", "LIVE"]);
	});
	it("merges sources, excludes expired/historical/resource risk, and retains provenance", async () => {
		repository.findOwner.mockResolvedValue("host");
		repository.candidates.mockResolvedValue([
			candidate(),
			candidate({ id: "expired", severity: "VERY_HIGH", validUntil: NOW.toISOString() }),
			candidate({ id: "history", sourceType: "BASE_HISTORICAL", severity: "VERY_HIGH" }),
			candidate({ id: "water", sourceType: "RESOURCE", severity: "VERY_HIGH" }),
			candidate({ id: "host", sourceType: "HOST_DEFINED", severity: "MEDIUM" }),
			candidate({ id: "incident", sourceType: "FIELD_OBSERVATION", severity: "LOW" }),
		]);
		const result = await service.analyze("host", { routeId: "route", geometry });
		expect(result.riskLevel).toBe("HIGH");
		expect(result.summary).toEqual({
			activeWarnings: 1,
			nearbyIncidents: 1,
			hostDefinedDangerZones: 1,
			historicalFeatures: 1,
		});
		expect(result.features.features[0].properties.sourceReference).toBe("reference");
	});
});

describe("canonical safety import validation BR-478", () => {
	const record = {
		externalId: "1",
		sourceType: "OFFICIAL_CURRENT",
		sourceReference: "https://example.org",
		hazardType: "landslide",
		severity: "HIGH",
		geometry: { type: "Point", coordinates: [108, 12] },
		geometryRole: "source_marker",
		description: "Warning",
		observedAt: NOW.toISOString(),
		lifecycleStatus: "ACTIVE",
		verificationStatus: "SOURCE_PROVIDED",
	};
	it("accepts canonical WGS84 points and rejects invalid CRS coordinates", () => {
		expect(parseSafetyInput({ ...record })).not.toBeNull();
		expect(
			parseSafetyInput({
				...record,
				geometry: { ...record.geometry, crs: { type: "name", properties: { name: "EPSG:3857" } } },
			})
		).toBeNull();
		expect(
			parseSafetyInput({ ...record, geometry: { type: "Point", coordinates: [500, 12] } })
		).toBeNull();
	});
	it("rejects ambiguous timestamps and inverted validity", () => {
		expect(parseSafetyInput({ ...record, observedAt: "2026-10-29T12:00:00" })).toBeNull();
		expect(
			parseSafetyInput({
				...record,
				validFrom: "2026-10-30T00:00:00Z",
				validUntil: NOW.toISOString(),
			})
		).toBeNull();
	});
});
