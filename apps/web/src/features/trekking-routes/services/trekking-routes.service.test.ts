import { beforeEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "../../../core/api";
import { trekkingRoutesService } from "./trekking-routes.service";

vi.mock("../../../core/api", () => ({
	API_ENDPOINTS: {
		TREKKING: {
			ROUTES: "/trekking-routes",
			CLOSE_ROUTE: (routeId: string) => `/trekking-routes/${routeId}/close`,
			REOPEN_ROUTE: (routeId: string) => `/trekking-routes/${routeId}/reopen`,
			CHECKPOINTS: (routeId: string) => `/trekking-routes/${routeId}/checkpoints`,
		},
	},
	httpClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

describe("trekkingRoutesService", () => {
	beforeEach(() => vi.clearAllMocks());
	it("gets routes using the owned campsite filter", async () => {
		vi.mocked(httpClient.get).mockResolvedValue([]);

		await trekkingRoutesService.listByCampsite("11111111-1111-4111-8111-111111111111");

		expect(httpClient.get).toHaveBeenCalledWith("/trekking-routes", {
			campsiteId: "11111111-1111-4111-8111-111111111111",
		});
	});

	it("posts only the canonical create payload", async () => {
		const payload = {
			campsiteId: "11111111-1111-4111-8111-111111111111",
			name: "Ridge",
			geometry: {
				type: "LineString" as const,
				coordinates: [
					[108.45, 11.94],
					[108.46, 11.95],
				] as [number, number][],
			},
			difficulty: "easy" as const,
			expectedDurationMinutes: 90,
		};
		vi.mocked(httpClient.post).mockResolvedValue({ id: "route-id" });
		await trekkingRoutesService.create(payload);
		expect(httpClient.post).toHaveBeenCalledWith("/trekking-routes", payload);
		expect(payload).not.toHaveProperty("status");
		expect(payload).not.toHaveProperty("lengthMeters");
		expect(payload).not.toHaveProperty("hostId");
	});

	it("gets and creates checkpoints through the nested route resource", async () => {
		const payload = {
			name: "Ridge rest",
			location: { type: "Point" as const, coordinates: [108.46, 11.94] as [number, number] },
			radiusMeters: 30,
			type: "rest" as const,
			expectedArrivalOffset: 45,
			instructions: "Rest here",
			nearbyWaterOrShelter: true,
		};
		vi.mocked(httpClient.get).mockResolvedValue([]);
		vi.mocked(httpClient.post).mockResolvedValue({ id: "checkpoint-id" });

		await trekkingRoutesService.listCheckpoints("route-id");
		await trekkingRoutesService.createCheckpoint("route-id", payload);

		expect(httpClient.get).toHaveBeenCalledWith("/trekking-routes/route-id/checkpoints");
		expect(httpClient.post).toHaveBeenCalledWith("/trekking-routes/route-id/checkpoints", payload);
		expect(payload).not.toHaveProperty("routeId");
		expect(payload).not.toHaveProperty("routePosition");
	});

	it("patches close and reopen using only the reason contract", async () => {
		vi.resetModules();
		vi.doUnmock("../../../core/api");
		const patch = vi.fn().mockResolvedValue({ id: "route-id" });
		vi.doMock("../../../core/api", () => ({
			API_ENDPOINTS: {
				TREKKING: {
					CLOSE_ROUTE: (routeId: string) => `/trekking-routes/${routeId}/close`,
					REOPEN_ROUTE: (routeId: string) => `/trekking-routes/${routeId}/reopen`,
				},
			},
			httpClient: { patch },
		}));

		try {
			const { trekkingRoutesService: lifecycleService } = await import("./trekking-routes.service");
			await lifecycleService.close("route-id", { reason: "Unsafe" });
			await lifecycleService.reopen("route-id", { reason: "Safe again" });

			expect(patch).toHaveBeenNthCalledWith(1, "/trekking-routes/route-id/close", {
				reason: "Unsafe",
			});
			expect(patch).toHaveBeenNthCalledWith(2, "/trekking-routes/route-id/reopen", {
				reason: "Safe again",
			});
		} finally {
			vi.doUnmock("../../../core/api");
			vi.resetModules();
		}
	});
});
