import { afterEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "../../../core/api";
import { tripsService } from "./trips.service";

afterEach(() => vi.restoreAllMocks());

describe("tripsService.getAvailablePorters", () => {
	it("uses the selected Trip and serializes all backend-supported filters", async () => {
		const get = vi.spyOn(httpClient, "get").mockResolvedValue({
			items: [],
			pagination: { page: 2, limit: 20, total: 0, totalPages: 0 },
		});

		await tripsService.getAvailablePorters("trip-201", {
			role: "lead",
			minExperienceYears: 4,
			page: 2,
			limit: 20,
		});

		expect(get).toHaveBeenCalledWith("/trips/trip-201/available-porters", {
			role: "lead",
			minExperienceYears: 4,
			page: 2,
			limit: 20,
		});
	});

	it("omits the optional experience filter when it is not selected", async () => {
		const get = vi.spyOn(httpClient, "get").mockResolvedValue({
			items: [],
			pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
		});

		await tripsService.getAvailablePorters("trip-201", {
			role: "support",
			page: 1,
			limit: 20,
		});

		expect(get).toHaveBeenCalledWith("/trips/trip-201/available-porters", {
			role: "support",
			minExperienceYears: undefined,
			page: 1,
			limit: 20,
		});
	});
});

describe("tripsService.createPorterRequest", () => {
	it("posts only the supported Porter Request fields to the Trip-scoped endpoint", async () => {
		const post = vi.spyOn(httpClient, "post").mockResolvedValue({
			id: "request-1",
			status: "pending",
		});

		await tripsService.createPorterRequest("trip-201", {
			porterId: "porter-1",
			requestedRole: "support",
			note: "Can you support the river crossing?",
		});

		expect(post).toHaveBeenCalledWith("/trips/trip-201/porter-requests", {
			porterId: "porter-1",
			requestedRole: "support",
			note: "Can you support the river crossing?",
		});
	});
});
