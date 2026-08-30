import { afterEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "../../../core/api";
import { trekkingRoutesService } from "./trekking-routes.service";

describe("trekkingRoutesService", () => {
	afterEach(() => vi.restoreAllMocks());

	it("gets routes using the owned campsite filter", async () => {
		const get = vi.spyOn(httpClient, "get").mockResolvedValue([]);
		await trekkingRoutesService.listByCampsite("11111111-1111-4111-8111-111111111111");
		expect(get).toHaveBeenCalledWith("/trekking-routes", {
			campsiteId: "11111111-1111-4111-8111-111111111111",
		});
	});

	it("posts only the canonical create payload", async () => {
		const post = vi.spyOn(httpClient, "post").mockResolvedValue({ id: "route-id" });
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
		await trekkingRoutesService.create(payload);
		expect(post).toHaveBeenCalledWith("/trekking-routes", payload);
		expect(payload).not.toHaveProperty("status");
		expect(payload).not.toHaveProperty("lengthMeters");
		expect(payload).not.toHaveProperty("hostId");
	});

	it("gets and creates checkpoints through the nested route resource", async () => {
		const get = vi.spyOn(httpClient, "get").mockResolvedValue([]);
		const post = vi.spyOn(httpClient, "post").mockResolvedValue({ id: "checkpoint-id" });
		const payload = {
			name: "Ridge rest",
			location: { type: "Point" as const, coordinates: [108.46, 11.94] as [number, number] },
			radiusMeters: 30,
			type: "rest" as const,
			expectedArrivalOffset: 45,
			instructions: "Rest here",
			nearbyWaterOrShelter: true,
		};
		await trekkingRoutesService.listCheckpoints("route-id");
		await trekkingRoutesService.createCheckpoint("route-id", payload);
		expect(get).toHaveBeenCalledWith("/trekking-routes/route-id/checkpoints");
		expect(post).toHaveBeenCalledWith("/trekking-routes/route-id/checkpoints", payload);
		for (const field of [
			"id",
			"routeId",
			"hostId",
			"campsiteId",
			"routePosition",
			"sequence",
			"order",
			"index",
			"createdAt",
			"updatedAt",
			"audit",
			"auditData",
		]) {
			expect(payload).not.toHaveProperty(field);
		}
	});

	it("patches close and reopen using only the reason contract", async () => {
		const patch = vi.spyOn(httpClient, "patch").mockResolvedValue({ id: "route-id" });
		await trekkingRoutesService.close("route-id", { reason: "Unsafe" });
		await trekkingRoutesService.reopen("route-id", { reason: "Safe again" });
		expect(patch).toHaveBeenNthCalledWith(1, "/trekking-routes/route-id/close", {
			reason: "Unsafe",
		});
		expect(patch).toHaveBeenNthCalledWith(2, "/trekking-routes/route-id/reopen", {
			reason: "Safe again",
		});
	});

	it("submits a draft route without a request body or client-selected status", async () => {
		const patch = vi
			.spyOn(httpClient, "patch")
			.mockResolvedValue({ id: "route-id", status: "pending_approval" });
		await trekkingRoutesService.submitForApproval("route-id");
		expect(patch).toHaveBeenCalledWith("/trekking-routes/route-id/submit-for-approval");
	});
});
