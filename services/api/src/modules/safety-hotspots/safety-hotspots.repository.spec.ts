import type { DataSource, EntityManager } from "typeorm";
import { type NewHotspot, SafetyHotspotsRepository } from "./safety-hotspots.repository";

const HOTSPOT: NewHotspot = {
	routeId: "route-id",
	routeVersion: "route-version",
	analysisVersion: "analysis-version",
	configVersion: "config-version",
	criteria: {},
	windowStart: new Date("2026-11-01T00:00:00Z"),
	windowEnd: new Date("2026-11-18T00:00:00Z"),
	centerLng: 108.2,
	centerLat: 16.1,
	radiusMeters: 50,
	anchorEventId: "event-id",
	routeFractionMin: 0.2,
	routeFractionMax: 0.3,
	eventCount: 5,
	distinctTripCount: 3,
	distinctMemberCount: 3,
	evidenceEventIds: ["event-id"],
	evidenceHash: "evidence-hash",
	firstEventAt: new Date("2026-11-01T00:00:00Z"),
	lastEventAt: new Date("2026-11-18T00:00:00Z"),
	previousHotspotId: null,
	detectionRunId: "run-id",
	detectedAt: new Date("2026-11-18T00:00:00Z"),
};

describe("SafetyHotspotsRepository", () => {
	it("inserts new candidates directly into the review queue", async () => {
		const manager = { query: jest.fn().mockResolvedValue([{ id: "hotspot-id" }]) };
		const repository = new SafetyHotspotsRepository({} as DataSource);

		await repository.insertHotspot(manager as unknown as EntityManager, HOTSPOT);

		expect(manager.query.mock.calls[0][0]).toContain("'UNDER_REVIEW'");
	});

	it("includes legacy DETECTED candidates in the Admin review queue", async () => {
		const dataSource = { query: jest.fn().mockResolvedValue([]) };
		const repository = new SafetyHotspotsRepository(dataSource as unknown as DataSource);

		await repository.list({ status: "UNDER_REVIEW", limit: 10 });

		expect(dataSource.query.mock.calls[0][0]).toContain(
			`hotspot."status" = $1 OR hotspot."status" = 'DETECTED'`
		);
		expect(dataSource.query.mock.calls[0][1]).toEqual(["UNDER_REVIEW", 10]);
	});
});
