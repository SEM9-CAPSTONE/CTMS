import { afterEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "../../../core/api";
import { porterProfileService } from "./porter-profile.service";

describe("porterProfileService", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("getProfile calls GET /porter/profile", async () => {
		const mockResponse = {
			porterId: "p-1",
			experienceYears: 3,
			certifications: ["WFA"],
			languages: ["Vietnamese"],
			availabilityStatus: "available",
			ratingAvg: 4.8,
			completedTrips: 12,
			version: 1,
			createdAt: "2026-01-01",
			updatedAt: "2026-01-02",
		};
		const getSpy = vi.spyOn(httpClient, "get").mockResolvedValue(mockResponse);

		const result = await porterProfileService.getProfile();
		expect(getSpy).toHaveBeenCalledWith("/porter/profile");
		expect(result).toEqual(mockResponse);
	});

	it("updateProfile calls PATCH /porter/profile with expected payload", async () => {
		const payload = {
			experienceYears: 4,
			certifications: ["WFA", "Rescue"],
			languages: ["Vietnamese", "English"],
			availabilityStatus: "available" as const,
			expectedVersion: 1,
		};
		const mockResponse = {
			...payload,
			porterId: "p-1",
			ratingAvg: 4.8,
			completedTrips: 12,
			version: 2,
			createdAt: "2026-01-01",
			updatedAt: "2026-01-03",
		};
		const patchSpy = vi.spyOn(httpClient, "patch").mockResolvedValue(mockResponse);

		const result = await porterProfileService.updateProfile(payload);
		expect(patchSpy).toHaveBeenCalledWith("/porter/profile", payload);
		expect(result.version).toBe(2);
	});

	it("getMyRouteQualifications calls GET /porter/route-qualifications", async () => {
		const mockList = [
			{
				qualificationId: "q-1",
				porterId: "p-1",
				routeId: "r-1",
				proficiency: "proficient" as const,
				timesLed: 4,
				verifiedBy: "h-1",
				verifiedAt: "2026-02-01",
				version: 1,
				createdAt: "2026-01-01",
				updatedAt: "2026-02-01",
			},
		];
		const getSpy = vi.spyOn(httpClient, "get").mockResolvedValue(mockList);

		const result = await porterProfileService.getMyRouteQualifications();
		expect(getSpy).toHaveBeenCalledWith("/porter/route-qualifications");
		expect(result).toHaveLength(1);
	});

	it("upsertRouteQualification calls PUT /porter/route-qualifications/:routeId", async () => {
		const payload = {
			proficiency: "expert" as const,
			timesLed: 10,
			expectedVersion: 1,
		};
		const mockResponse = {
			qualificationId: "q-1",
			porterId: "p-1",
			routeId: "r-1",
			proficiency: "expert",
			timesLed: 10,
			verifiedBy: null,
			verifiedAt: null,
			version: 2,
			createdAt: "2026-01-01",
			updatedAt: "2026-02-02",
		};
		const putSpy = vi.spyOn(httpClient, "put").mockResolvedValue(mockResponse);

		const result = await porterProfileService.upsertRouteQualification("r-1", payload);
		expect(putSpy).toHaveBeenCalledWith("/porter/route-qualifications/r-1", payload);
		expect(result.version).toBe(2);
	});

	it("getRoutePorterQualifications calls GET /trekking-routes/:routeId/porter-qualifications", async () => {
		const mockRows = [
			{
				qualificationId: "q-1",
				porterId: "p-1",
				porterDisplayName: "John Porter",
				routeId: "r-1",
				proficiency: "proficient" as const,
				timesLed: 5,
				verifiedBy: null,
				verifiedAt: null,
				version: 1,
				createdAt: "2026-01-01",
				updatedAt: "2026-01-01",
			},
		];
		const getSpy = vi.spyOn(httpClient, "get").mockResolvedValue(mockRows);

		const result = await porterProfileService.getRoutePorterQualifications("r-1");
		expect(getSpy).toHaveBeenCalledWith("/trekking-routes/r-1/porter-qualifications");
		expect(result).toEqual(mockRows);
	});

	it("verifyRouteQualification calls PATCH /porter/route-qualifications/:qualificationId/verify", async () => {
		const mockResponse = {
			qualificationId: "q-1",
			porterId: "p-1",
			routeId: "r-1",
			proficiency: "proficient",
			timesLed: 5,
			verifiedBy: "h-1",
			verifiedAt: "2026-02-01T10:00:00.000Z",
			version: 2,
			createdAt: "2026-01-01",
			updatedAt: "2026-02-01",
		};
		const patchSpy = vi.spyOn(httpClient, "patch").mockResolvedValue(mockResponse);

		const result = await porterProfileService.verifyRouteQualification("q-1", {
			expectedVersion: 1,
		});
		expect(patchSpy).toHaveBeenCalledWith("/porter/route-qualifications/q-1/verify", {
			expectedVersion: 1,
		});
		expect(result.verifiedBy).toBe("h-1");
	});
});
