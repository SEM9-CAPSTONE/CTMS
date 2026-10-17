import { describe, expect, it, vi } from "vitest";
import type { TripIncidentsApi } from "../services/trip-incidents.service";
import { createMemoryIncidentQueueStore } from "../storage/incident-queue.store";
import { IncidentSyncState, type TripIncident } from "../types";
import { registerVisibleIncidentTrip, syncBackgroundIncidents } from "./incident-background-sync";
import { createIncidentRecord } from "./incident-record";

function record(tripId: string, porterId: string) {
	return createIncidentRecord(
		{
			category: "injury",
			severity: "low",
			description: "Injury",
			occurredAt: new Date().toISOString(),
			location: null,
			photo: null,
		},
		tripId,
		porterId,
		false,
		new Date()
	);
}

describe("background incident synchronization", () => {
	it("synchronizes queued Trips after navigation and isolates the active account", async () => {
		const first = record("trip-a", "porter-a");
		const second = record("trip-b", "porter-b");
		const store = createMemoryIncidentQueueStore([first, second]);
		const api: TripIncidentsApi = {
			list: vi.fn(),
			uploadMedia: vi.fn(),
			report: vi.fn(async () => ({
				outcome: "created" as const,
				incident: {
					...first.payload,
					tripId: first.tripId,
					reporterId: first.porterId,
					reporterName: null,
					status: "open",
					locationStatus: "unavailable",
					media: null,
					receivedAt: new Date().toISOString(),
				} satisfies TripIncident,
			})),
		};
		const changed = vi.fn();
		await syncBackgroundIncidents("porter-a", store, api, () => true, changed);
		expect((await store.list("trip-a", "porter-a"))[0].syncState).toBe(IncidentSyncState.SYNCED);
		expect((await store.list("trip-b", "porter-b"))[0].syncState).toBe(IncidentSyncState.PENDING);
		expect(api.report).toHaveBeenCalledTimes(1);
		expect(changed).toHaveBeenCalledWith("trip-a");
	});
	it("leaves a visible Trip to its panel and stops when the account changes", async () => {
		const store = createMemoryIncidentQueueStore([record("trip-a", "porter-a")]);
		const api: TripIncidentsApi = { list: vi.fn(), uploadMedia: vi.fn(), report: vi.fn() };
		const release = registerVisibleIncidentTrip("porter-a", "trip-a");
		try {
			await syncBackgroundIncidents("porter-a", store, api, () => true, vi.fn());
		} finally {
			release();
		}
		expect(api.report).not.toHaveBeenCalled();
		await syncBackgroundIncidents("porter-a", store, api, () => false, vi.fn());
		expect(api.report).not.toHaveBeenCalled();
	});
});
