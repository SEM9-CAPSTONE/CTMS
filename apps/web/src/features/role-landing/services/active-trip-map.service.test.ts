import { beforeEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "../../../core/api";
import { activeTripMapService } from "./active-trip-map.service";

vi.mock("../../../core/api", () => ({
	API_ENDPOINTS: {
		HOST_MONITORING: {
			ACTIVE_TRIPS: "/active-trips",
			ALERTS: (id: string) => `/active-trips/${id}/alerts`,
		},
	},
	httpClient: { get: vi.fn() },
}));
const maps = { items: [], total: 0, freshnessMaxAgeSeconds: 120 };
const alerts = { tripId: "trip", alerts: [], freshnessMaxAgeSeconds: 120 };
describe("coordinated Host monitoring reads", () => {
	beforeEach(() => vi.clearAllMocks());
	it("publishes the pair only after both requests complete", async () => {
		let resolveAlerts: (value: typeof alerts) => void = () => {};
		vi.mocked(httpClient.get)
			.mockResolvedValueOnce(maps)
			.mockReturnValueOnce(
				new Promise((resolve) => {
					resolveAlerts = resolve;
				})
			);
		const signal = new AbortController().signal;
		let published = false;
		const request = activeTripMapService.monitoring("trip", signal).then((value) => {
			published = true;
			return value;
		});
		await Promise.resolve();
		expect(published).toBe(false);
		resolveAlerts(alerts);
		expect(await request).toMatchObject({ items: [], alerts, alertError: undefined });
		expect(httpClient.get).toHaveBeenNthCalledWith(2, "/active-trips/trip/alerts", undefined, {
			signal,
		});
	});
	it("retains available positions while exposing an alert failure", async () => {
		const error = new Error("Network unavailable");
		vi.mocked(httpClient.get).mockResolvedValueOnce(maps).mockRejectedValueOnce(error);
		const result = await activeTripMapService.monitoring("trip", new AbortController().signal);
		expect(result.items).toEqual([]);
		expect(result.alertError).toBe(error);
		expect(result.alerts).toBeUndefined();
	});
	it("does not publish alerts without an authorized map", async () => {
		const error = new Error("Map unavailable");
		vi.mocked(httpClient.get).mockRejectedValueOnce(error).mockResolvedValueOnce(alerts);
		await expect(
			activeTripMapService.monitoring("trip", new AbortController().signal)
		).rejects.toBe(error);
	});
});
