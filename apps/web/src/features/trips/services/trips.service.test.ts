import { afterEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "../../../core/api";
import { tripsService } from "./trips.service";

afterEach(() => vi.restoreAllMocks());

describe("tripsService assigned trips", () => {
	it("uses the Porter assigned Trips endpoint", async () => {
		const get = vi.spyOn(httpClient, "get").mockResolvedValue([]);
		await tripsService.getAssignedTrips();
		expect(get).toHaveBeenCalledWith("/trips/assigned");
	});
});

describe("tripsService Admin reviews", () => {
	it("maps the review outcome and pagination query", async () => {
		const get = vi.spyOn(httpClient, "get").mockResolvedValue({ items: [], pagination: {} });
		await tripsService.listAdminReviews({ reviewOutcome: "auto_rejected", page: 2, limit: 20 });
		expect(get).toHaveBeenCalledWith("/trips/admin-reviews", {
			reviewOutcome: "auto_rejected",
			page: 2,
			limit: 20,
		});
	});
});
