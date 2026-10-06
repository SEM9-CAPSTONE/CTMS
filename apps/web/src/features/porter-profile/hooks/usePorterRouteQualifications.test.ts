import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { porterProfileService } from "../services/porter-profile.service";
import { usePorterRouteQualifications } from "./usePorterRouteQualifications";

describe("usePorterRouteQualifications", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("loads empty qualifications list cleanly", async () => {
		vi.spyOn(porterProfileService, "getMyRouteQualifications").mockResolvedValue([]);

		const { result } = renderHook(() => usePorterRouteQualifications());

		expect(result.current.isLoading).toBe(true);

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.qualifications).toEqual([]);
		expect(result.current.errorMessage).toBeNull();
	});

	it("creates new route qualification and reloads list", async () => {
		const created = {
			qualificationId: "q-1",
			porterId: "p-1",
			routeId: "r-1",
			proficiency: "learning" as const,
			timesLed: 0,
			verifiedBy: null,
			verifiedAt: null,
			version: 1,
			createdAt: "2026-03-01",
			updatedAt: "2026-03-01",
		};
		const getSpy = vi
			.spyOn(porterProfileService, "getMyRouteQualifications")
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([created]);
		const upsertSpy = vi
			.spyOn(porterProfileService, "upsertRouteQualification")
			.mockResolvedValue(created);

		const { result } = renderHook(() => usePorterRouteQualifications());

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		let mutationResult: unknown;
		await act(async () => {
			mutationResult = await result.current.upsertQualification("r-1", {
				proficiency: "learning",
				timesLed: 0,
			});
		});

		expect(upsertSpy).toHaveBeenCalledWith("r-1", {
			proficiency: "learning",
			timesLed: 0,
		});
		expect(mutationResult).toEqual(created);
		expect(getSpy).toHaveBeenCalledTimes(2);
		expect(result.current.qualifications).toHaveLength(1);
		expect(result.current.successMessage).toBeTruthy();
	});

	it("updates existing qualification passing expectedVersion", async () => {
		const existing = {
			qualificationId: "q-1",
			porterId: "p-1",
			routeId: "r-1",
			proficiency: "proficient" as const,
			timesLed: 2,
			verifiedBy: "h-1",
			verifiedAt: "2026-01-01",
			version: 1,
			createdAt: "2026-01-01",
			updatedAt: "2026-01-01",
		};
		const updated = {
			...existing,
			proficiency: "expert" as const,
			timesLed: 8,
			verifiedBy: null,
			verifiedAt: null,
			version: 2,
		};
		vi.spyOn(porterProfileService, "getMyRouteQualifications")
			.mockResolvedValueOnce([existing])
			.mockResolvedValueOnce([updated]);
		const upsertSpy = vi
			.spyOn(porterProfileService, "upsertRouteQualification")
			.mockResolvedValue(updated);

		const { result } = renderHook(() => usePorterRouteQualifications());

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		await act(async () => {
			await result.current.upsertQualification("r-1", {
				proficiency: "expert",
				timesLed: 8,
				expectedVersion: 1,
			});
		});

		expect(upsertSpy).toHaveBeenCalledWith("r-1", {
			proficiency: "expert",
			timesLed: 8,
			expectedVersion: 1,
		});
		expect(result.current.qualifications[0].version).toBe(2);
		expect(result.current.qualifications[0].verifiedBy).toBeNull();
	});

	it("handles 409 stale conflict by refetching authoritative list", async () => {
		const existing = {
			qualificationId: "q-1",
			porterId: "p-1",
			routeId: "r-1",
			proficiency: "proficient" as const,
			timesLed: 2,
			verifiedBy: null,
			verifiedAt: null,
			version: 1,
			createdAt: "2026-01-01",
			updatedAt: "2026-01-01",
		};
		const conflictError = new HttpError("Conflict", 409, { message: "Version conflict" });
		const getSpy = vi
			.spyOn(porterProfileService, "getMyRouteQualifications")
			.mockResolvedValue([existing]);
		vi.spyOn(porterProfileService, "upsertRouteQualification").mockRejectedValue(conflictError);

		const { result } = renderHook(() => usePorterRouteQualifications());

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		await act(async () => {
			await result.current.upsertQualification("r-1", {
				proficiency: "expert",
				timesLed: 5,
				expectedVersion: 1,
			});
		});

		expect(result.current.conflictMessage).toBeTruthy();
		expect(getSpy).toHaveBeenCalledTimes(2);
	});
});
