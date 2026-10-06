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
