import { describe, expect, it } from "vitest";
import { DeviceSyncState, type LocalGpsLogRecord } from "../types";
import { createMemoryGpsQueueStore } from "./gps-queue.store";

describe("GpsQueueStore (CTMS-067)", () => {
	const sampleLog: LocalGpsLogRecord = {
		id: "log-1",
		tripId: "trip-a",
		userId: "user-1",
		eventTime: "2026-10-23T10:00:00.000Z",
		latitude: 16.05,
		longitude: 108.2,
		accuracyMeters: 5,
		configVersion: "v3",
		syncState: DeviceSyncState.PENDING,
		savedAt: "2026-10-23T10:00:01.000Z",
	};

	it("stores and lists records by trip and user in chronological order", async () => {
		const store = createMemoryGpsQueueStore();
		await store.put(sampleLog);
		await store.put({
			...sampleLog,
			id: "log-2",
			eventTime: "2026-10-23T10:00:30.000Z",
		});

		const items = await store.list("trip-a", "user-1");
		expect(items).toHaveLength(2);
		expect(items[0].id).toBe("log-1");
		expect(items[1].id).toBe("log-2");
	});

	it("removes records once acknowledged by the server", async () => {
		const store = createMemoryGpsQueueStore([sampleLog]);
		await store.remove("log-1");

		const items = await store.list("trip-a", "user-1");
		expect(items).toHaveLength(0);
	});

	it("clears all records for a specific trip", async () => {
		const store = createMemoryGpsQueueStore([
			sampleLog,
			{ ...sampleLog, id: "log-other", tripId: "trip-other" },
		]);

		await store.clearForTrip("trip-a");

		expect(await store.list("trip-a", "user-1")).toHaveLength(0);
		expect(await store.list("trip-other", "user-1")).toHaveLength(1);
	});
});
