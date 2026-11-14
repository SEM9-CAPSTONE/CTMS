import type { ConfigService } from "@nestjs/config";
import { type ClusterableEvent, clusterEvents, meetsCriteria } from "./hotspot-clustering";
import { SafetyHotspotSkipReason, SafetyHotspotStatus } from "./safety-hotspots.enums";
import type { SafetyHotspotsService } from "./safety-hotspots.service";
import { decideAgainstExisting, evidenceHash } from "./safety-hotspots.service";
import { SafetyHotspotsWorker } from "./safety-hotspots.worker";

const T0 = Date.parse("2026-11-01T00:00:00.000Z");

function event(id: string, trip: string, user: string, minutes = 0): ClusterableEvent {
	return { id, tripId: trip, userId: user, startedAt: new Date(T0 + minutes * 60_000) };
}

/** Everybody in `group` is within the radius of everybody else in it. */
function neighborsOf(...groups: string[][]): Map<string, Set<string>> {
	const map = new Map<string, Set<string>>();
	for (const group of groups) {
		for (const id of group) map.set(id, new Set([...(map.get(id) ?? []), ...group]));
	}
	return map;
}

const five = [
	event("e1", "t1", "u1", 1),
	event("e2", "t2", "u2", 2),
	event("e3", "t3", "u3", 3),
	event("e4", "t1", "u1", 4),
	event("e5", "t2", "u2", 5),
];

describe("hotspot criteria (BR-417, BR-418)", () => {
	it("needs 5 events, 3 distinct Trips and 3 distinct Members", () => {
		expect(meetsCriteria(five)).toBe(true);
		expect(meetsCriteria(five.slice(0, 4))).toBe(false);
	});

	it("does not count repeated Trips or Members as distinct", () => {
		const twoTrips = five.map((e) => ({ ...e, tripId: e.tripId === "t3" ? "t1" : e.tripId }));
		expect(meetsCriteria(twoTrips)).toBe(false);
		const twoMembers = five.map((e) => ({ ...e, userId: e.userId === "u3" ? "u2" : e.userId }));
		expect(meetsCriteria(twoMembers)).toBe(false);
	});
});

describe("clusterEvents", () => {
	it("creates one cluster of events within the radius of the anchor", () => {
		const [cluster, ...rest] = clusterEvents(five, neighborsOf(["e1", "e2", "e3", "e4", "e5"]));
		expect(rest).toEqual([]);
		expect(cluster).toEqual({
			anchorId: "e1",
			eventIds: ["e1", "e2", "e3", "e4", "e5"],
			eventCount: 5,
			distinctTrips: 3,
			distinctMembers: 3,
		});
	});

	it("does not chain: an event near a member but outside the anchor's radius stays out", () => {
		// e1..e5 are all near each other; e6 is near e5 only; e7 is near e6 only.
		const e6 = event("e6", "t4", "u4", 6);
		const e7 = event("e7", "t5", "u5", 7);
		const neighbors = neighborsOf(["e1", "e2", "e3", "e4", "e5"], ["e5", "e6"], ["e6", "e7"]);
		const [cluster, ...rest] = clusterEvents([...five, e6, e7], neighbors);
		// e5 has the largest neighbourhood, so it anchors: e6 is within its radius, e7 is not.
		expect(cluster.anchorId).toBe("e5");
		expect(cluster.eventIds).toEqual(["e1", "e2", "e3", "e4", "e5", "e6"]);
		expect(rest).toEqual([]);
	});

	it("does not fabricate a hotspot from insufficient evidence", () => {
		expect(clusterEvents(five.slice(0, 4), neighborsOf(["e1", "e2", "e3", "e4"]))).toEqual([]);
		// Five events but spread out: nobody has four neighbours.
		expect(clusterEvents(five, neighborsOf(["e1", "e2"], ["e3", "e4"], ["e5"]))).toEqual([]);
	});

	it("finds two separate places and never puts an event in both", () => {
		const second = ["f1", "f2", "f3", "f4", "f5"].map((id, i) =>
			event(id, `s${i % 3}`, `v${i % 3}`, 10 + i)
		);
		const clusters = clusterEvents(
			[...five, ...second],
			neighborsOf(["e1", "e2", "e3", "e4", "e5"], ["f1", "f2", "f3", "f4", "f5"])
		);
		expect(clusters.map((c) => c.eventIds)).toEqual([
			["e1", "e2", "e3", "e4", "e5"],
			["f1", "f2", "f3", "f4", "f5"],
		]);
	});

	it("prefers the largest neighbourhood, then the earliest anchor", () => {
		const extra = event("e6", "t3", "u3", 0);
		const neighbors = neighborsOf(["e1", "e2", "e3", "e4", "e5", "e6"]);
		expect(clusterEvents([...five, extra], neighbors)[0].anchorId).toBe("e6");
	});
});

describe("re-detection policy (BR-421, BR-422)", () => {
	const at = (minutes: number) => new Date(T0 + minutes * 60_000);

	it("creates when nothing covers the place", () => {
		expect(decideAgainstExisting([], at(5))).toEqual({ create: true, previousHotspotId: null });
	});

	it.each([
		SafetyHotspotStatus.DETECTED,
		SafetyHotspotStatus.UNDER_REVIEW,
		SafetyHotspotStatus.CONFIRMED,
	])("skips when a %s candidate already covers the place", (status) => {
		expect(decideAgainstExisting([{ id: "h1", status, statusChangedAt: at(0) }], at(5))).toEqual({
			create: false,
			reason: SafetyHotspotSkipReason.ALREADY_COVERED,
		});
	});

	it("after a dismissal, needs evidence that started later and links back to it", () => {
		const dismissed = { id: "h1", status: SafetyHotspotStatus.DISMISSED, statusChangedAt: at(10) };
		expect(decideAgainstExisting([dismissed], at(9))).toEqual({
			create: false,
			reason: SafetyHotspotSkipReason.DISMISSED_WITHOUT_NEW_EVIDENCE,
		});
		expect(decideAgainstExisting([dismissed], at(11))).toEqual({
			create: true,
			previousHotspotId: "h1",
		});
	});
});

describe("evidenceHash", () => {
	it("is order-independent and changes with the evidence", () => {
		expect(evidenceHash(["b", "a"])).toBe(evidenceHash(["a", "b"]));
		expect(evidenceHash(["a", "b"])).not.toBe(evidenceHash(["a", "c"]));
		expect(evidenceHash(["a"])).toMatch(/^[0-9a-f]{64}$/);
	});
});

describe("SafetyHotspotsWorker", () => {
	it("stays idle unless enabled, runs one pass per tick and survives failures", async () => {
		const service = { detect: jest.fn().mockResolvedValue({ candidatesCreated: 0 }) };
		const config = (enabled?: string) =>
			({
				get: (key: string) => (key.endsWith("ENABLED") ? enabled : undefined),
			}) as unknown as ConfigService;
		const idle = new SafetyHotspotsWorker(config(), service as unknown as SafetyHotspotsService);
		idle.onApplicationBootstrap();
		expect(service.detect).not.toHaveBeenCalled();

		const worker = new SafetyHotspotsWorker(config(), service as unknown as SafetyHotspotsService);
		await worker.startTick();
		expect(service.detect).toHaveBeenCalledWith(null);
		service.detect.mockRejectedValueOnce(new Error("db down"));
		await expect(worker.startTick()).resolves.toBeUndefined();
	});
});
