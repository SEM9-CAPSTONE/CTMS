import { describe, expect, it } from "vitest";
import type { LocalCheckpointArrivalRecord } from "../types";
import { createMemoryCheckpointArrivalQueueStore } from "./checkpoint-arrival-queue.store";

describe("CheckpointArrivalQueueStore (CTMS-056 / BR-234)", () => {
	const sampleRecord: LocalCheckpointArrivalRecord = {
		id: "sync-1",
		tripId: "trip-alpha",
		checkpointId: "cp-1",
		checkpointName: "Trạm 1",
		porterId: "porter-1",
		arrivedAt: "2026-10-24T10:00:00.000Z",
		location: { type: "Point", coordinates: [108.2, 16.0] },
		syncStatus: "pending",
		createdAt: "2026-10-24T10:00:00.000Z",
	};

	it("stores and lists arrival records by trip and porter in chronological order", async () => {
		const store = createMemoryCheckpointArrivalQueueStore();
		await store.put(sampleRecord);
		await store.put({
			...sampleRecord,
			id: "sync-2",
			checkpointId: "cp-2",
			checkpointName: "Trạm 2",
			arrivedAt: "2026-10-24T11:00:00.000Z",
		});

		const items = await store.list("trip-alpha", "porter-1");
		expect(items).toHaveLength(2);
		expect(items[0].id).toBe("sync-1");
		expect(items[1].id).toBe("sync-2");
	});

	it("removes a record by id after synchronization", async () => {
		const store = createMemoryCheckpointArrivalQueueStore([sampleRecord]);
		await store.remove("sync-1");

		const items = await store.list("trip-alpha", "porter-1");
		expect(items).toHaveLength(0);
	});

	it("clears all records for a specific trip", async () => {
		const store = createMemoryCheckpointArrivalQueueStore([
			sampleRecord,
			{ ...sampleRecord, id: "sync-other", tripId: "trip-other" },
		]);

		await store.clearForTrip("trip-alpha");

		expect(await store.list("trip-alpha", "porter-1")).toHaveLength(0);
		expect(await store.list("trip-other", "porter-1")).toHaveLength(1);
	});
});
