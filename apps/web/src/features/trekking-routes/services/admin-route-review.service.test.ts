import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
	vi.restoreAllMocks();
	vi.resetModules();
});

describe("trekkingRoutesService Admin review contract", () => {
	it("uses the dedicated discovery and review endpoints", async () => {
		vi.resetModules();
		const get = vi.fn().mockResolvedValue([]);
		const patch = vi.fn().mockResolvedValue({ status: "active" });
		vi.doMock("../../../core/api", () => ({
			API_ENDPOINTS: {
				TREKKING: {
					PENDING_REVIEW: "/trekking-routes/pending-review",
					REVIEW: (id: string) => `/trekking-routes/${id}/review`,
				},
			},
			httpClient: { get, patch },
		}));
		const { trekkingRoutesService } = await import("./trekking-routes.service");

		await trekkingRoutesService.listPendingReview();
		await trekkingRoutesService.review("route-1", { action: "decline", reason: "Needs edits" });

		expect(get).toHaveBeenCalledWith("/trekking-routes/pending-review");
		expect(patch).toHaveBeenCalledWith("/trekking-routes/route-1/review", {
			action: "decline",
			reason: "Needs edits",
		});
	});
});
