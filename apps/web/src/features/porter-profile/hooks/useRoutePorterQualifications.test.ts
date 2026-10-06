import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { porterProfileService } from "../services/porter-profile.service";
import { useRoutePorterQualifications } from "./useRoutePorterQualifications";

describe("useRoutePorterQualifications", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("loads route qualifications successfully", async () => {
		const mockList = [
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
		vi.spyOn(porterProfileService, "getRoutePorterQualifications").mockResolvedValue(mockList);

		const { result } = renderHook(() => useRoutePorterQualifications("r-1"));

		expect(result.current.isLoading).toBe(true);

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.qualifications).toEqual(mockList);
	});

	it("verifies qualification sending expectedVersion and refetches list", async () => {
		const unverified = {
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
		};
		const verified = {
			...unverified,
			verifiedBy: "h-1",
			verifiedAt: "2026-03-01T10:00:00.000Z",
			version: 2,
		};
		const getSpy = vi
			.spyOn(porterProfileService, "getRoutePorterQualifications")
			.mockResolvedValueOnce([unverified])
			.mockResolvedValueOnce([verified]);
		const verifySpy = vi
			.spyOn(porterProfileService, "verifyRouteQualification")
			.mockResolvedValue(verified);

		const { result } = renderHook(() => useRoutePorterQualifications("r-1"));

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		let success: boolean | undefined;
		await act(async () => {
			success = await result.current.verifyQualification("q-1", 1);
		});

		expect(verifySpy).toHaveBeenCalledWith("q-1", { expectedVersion: 1 });
		expect(success).toBe(true);
		expect(getSpy).toHaveBeenCalledTimes(2);
		expect(result.current.qualifications[0].verifiedBy).toBe("h-1");
		expect(result.current.successMessage).toBeTruthy();
	});

	it("handles 403 unauthorized error with permission feedback", async () => {
		const unverified = {
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
		};
		vi.spyOn(porterProfileService, "getRoutePorterQualifications").mockResolvedValue([unverified]);
		const forbiddenError = new HttpError("Forbidden", 403, { message: "Unauthorized" });
		vi.spyOn(porterProfileService, "verifyRouteQualification").mockRejectedValue(forbiddenError);

		const { result } = renderHook(() => useRoutePorterQualifications("r-1"));

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		let success: boolean | undefined;
		await act(async () => {
			success = await result.current.verifyQualification("q-1", 1);
		});

		expect(success).toBe(false);
		expect(result.current.errorMessage).toContain("không có quyền");
	});

	it("handles 409 conflict during verification by refreshing list", async () => {
		const unverified = {
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
		};
		const getSpy = vi
			.spyOn(porterProfileService, "getRoutePorterQualifications")
			.mockResolvedValue([unverified]);
		const conflictError = new HttpError("Conflict", 409, { message: "Already verified" });
		vi.spyOn(porterProfileService, "verifyRouteQualification").mockRejectedValue(conflictError);

		const { result } = renderHook(() => useRoutePorterQualifications("r-1"));

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		let success: boolean | undefined;
		await act(async () => {
			success = await result.current.verifyQualification("q-1", 1);
		});

		expect(success).toBe(false);
		expect(result.current.conflictMessage).toBeTruthy();
		expect(getSpy).toHaveBeenCalledTimes(2);
	});
});
