import { beforeEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "../../../core/api";
import { trekkingRoutesService } from "./trekking-routes.service";

vi.mock("../../../core/api", () => ({
	API_ENDPOINTS: { TREKKING: { ROUTES: "/trekking-routes" } },
	httpClient: { get: vi.fn(), post: vi.fn() },
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
});
