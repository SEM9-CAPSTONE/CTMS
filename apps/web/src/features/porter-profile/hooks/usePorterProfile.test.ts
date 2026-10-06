import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { porterProfileService } from "../services/porter-profile.service";
import { usePorterProfile } from "./usePorterProfile";

describe("usePorterProfile", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("loads virtual version-0 profile successfully when no persisted profile exists", async () => {
		const virtualProfile = {
			porterId: "p-virtual",
			experienceYears: 0,
			certifications: [],
			languages: [],
			availabilityStatus: "unavailable" as const,
			ratingAvg: 0,
			completedTrips: 0,
			version: 0,
			createdAt: null,
			updatedAt: null,
		};
		vi.spyOn(porterProfileService, "getProfile").mockResolvedValue(virtualProfile);

		const { result } = renderHook(() => usePorterProfile());

		expect(result.current.isLoading).toBe(true);

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.profile?.version).toBe(0);
		expect(result.current.profile?.experienceYears).toBe(0);
		expect(result.current.profile?.availabilityStatus).toBe("unavailable");
		expect(result.current.form.getValues("experienceYears")).toBe(0);
	});

	it("loads persisted profile and populates form values", async () => {
		const persistedProfile = {
			porterId: "p-persisted",
			experienceYears: 4,
			certifications: ["WFA", "Rescue"],
			languages: ["Vietnamese", "English"],
			availabilityStatus: "available" as const,
			ratingAvg: 4.9,
			completedTrips: 15,
			version: 3,
			createdAt: "2026-01-01",
			updatedAt: "2026-02-01",
		};
		vi.spyOn(porterProfileService, "getProfile").mockResolvedValue(persistedProfile);

		const { result } = renderHook(() => usePorterProfile());

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.profile?.version).toBe(3);
		expect(result.current.profile?.ratingAvg).toBe(4.9);
		expect(result.current.profile?.completedTrips).toBe(15);
		expect(result.current.form.getValues("experienceYears")).toBe(4);
		expect(result.current.form.getValues("certifications")).toEqual(["WFA", "Rescue"]);
	});

	it("first profile save omits expectedVersion when profile version is 0", async () => {
		const virtualProfile = {
			porterId: "p-virtual",
			experienceYears: 0,
			certifications: [],
			languages: [],
			availabilityStatus: "unavailable" as const,
			ratingAvg: 0,
			completedTrips: 0,
			version: 0,
			createdAt: null,
			updatedAt: null,
		};
		vi.spyOn(porterProfileService, "getProfile").mockResolvedValue(virtualProfile);
		const updateSpy = vi.spyOn(porterProfileService, "updateProfile").mockResolvedValue({
			...virtualProfile,
			experienceYears: 2,
			version: 1,
			createdAt: "2026-03-01",
			updatedAt: "2026-03-01",
		});

		const { result } = renderHook(() => usePorterProfile());

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		act(() => {
			result.current.form.setValue("experienceYears", 2);
			result.current.form.setValue("availabilityStatus", "available");
		});

		await act(async () => {
			await result.current.handleSubmit();
		});

		expect(updateSpy).toHaveBeenCalledWith({
			experienceYears: 2,
			certifications: [],
			languages: [],
			availabilityStatus: "available",
			// expectedVersion is NOT present for version 0
		});
		expect(result.current.profile?.version).toBe(1);
		expect(result.current.saveSuccessMessage).toBeTruthy();
	});

	it("existing profile save sends expectedVersion = current server version", async () => {
		const persistedProfile = {
			porterId: "p-persisted",
			experienceYears: 3,
			certifications: ["WFA"],
			languages: ["Vietnamese"],
			availabilityStatus: "available" as const,
			ratingAvg: 5.0,
			completedTrips: 10,
			version: 4,
			createdAt: "2026-01-01",
			updatedAt: "2026-02-01",
		};
		vi.spyOn(porterProfileService, "getProfile").mockResolvedValue(persistedProfile);
		const updateSpy = vi.spyOn(porterProfileService, "updateProfile").mockResolvedValue({
			...persistedProfile,
			experienceYears: 5,
			version: 5,
		});

		const { result } = renderHook(() => usePorterProfile());

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		act(() => {
			result.current.form.setValue("experienceYears", 5);
		});

		await act(async () => {
			await result.current.handleSubmit();
		});

		expect(updateSpy).toHaveBeenCalledWith({
			experienceYears: 5,
			certifications: ["WFA"],
			languages: ["Vietnamese"],
			availabilityStatus: "available",
			expectedVersion: 4,
		});
		expect(result.current.profile?.version).toBe(5);
	});

	it("handles 409 stale conflict by refetching authoritative profile and alerting user", async () => {
		const initialProfile = {
			porterId: "p-1",
			experienceYears: 2,
			certifications: [],
			languages: [],
			availabilityStatus: "available" as const,
			ratingAvg: 0,
			completedTrips: 0,
			version: 1,
			createdAt: "2026-01-01",
			updatedAt: "2026-01-01",
		};
		const latestProfile = {
			...initialProfile,
			experienceYears: 8,
			version: 3,
		};
		const getSpy = vi
			.spyOn(porterProfileService, "getProfile")
			.mockResolvedValueOnce(initialProfile)
			.mockResolvedValueOnce(latestProfile);

		const conflictError = new HttpError("Conflict", 409, { message: "Version conflict" });
		vi.spyOn(porterProfileService, "updateProfile").mockRejectedValue(conflictError);

		const { result } = renderHook(() => usePorterProfile());

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		act(() => {
			result.current.form.setValue("experienceYears", 4);
		});

		await act(async () => {
			await result.current.handleSubmit();
		});

		expect(result.current.conflictMessage).toBeTruthy();
		expect(getSpy).toHaveBeenCalledTimes(2);
		expect(result.current.profile?.version).toBe(3);
		expect(result.current.form.getValues("experienceYears")).toBe(8);
	});

	it("handles 403 authorization error without altering authoritative state", async () => {
		const initialProfile = {
			porterId: "p-1",
			experienceYears: 2,
			certifications: [],
			languages: [],
			availabilityStatus: "available" as const,
			ratingAvg: 0,
			completedTrips: 0,
			version: 1,
			createdAt: "2026-01-01",
			updatedAt: "2026-01-01",
		};
		vi.spyOn(porterProfileService, "getProfile").mockResolvedValue(initialProfile);
		const forbiddenError = new HttpError("Forbidden", 403, { message: "Forbidden" });
		vi.spyOn(porterProfileService, "updateProfile").mockRejectedValue(forbiddenError);

		const { result } = renderHook(() => usePorterProfile());

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		act(() => {
			result.current.form.setValue("experienceYears", 5);
		});

		await act(async () => {
			await result.current.handleSubmit();
		});

		expect(result.current.errorMessage).toContain("Bạn không có quyền");
		expect(result.current.profile?.version).toBe(1);
	});

	it("handles 422 backend validation error with inline field errors", async () => {
		const initialProfile = {
			porterId: "p-1",
			experienceYears: 2,
			certifications: [],
			languages: [],
			availabilityStatus: "available" as const,
			ratingAvg: 0,
			completedTrips: 0,
			version: 1,
			createdAt: "2026-01-01",
			updatedAt: "2026-01-01",
		};
		vi.spyOn(porterProfileService, "getProfile").mockResolvedValue(initialProfile);
		const valError = new HttpError("Unprocessable Entity", 422, {
			message: [{ field: "experienceYears", errors: ["experienceYears must not be less than 0"] }],
		});
		vi.spyOn(porterProfileService, "updateProfile").mockRejectedValue(valError);

		const { result } = renderHook(() => usePorterProfile());

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		act(() => {
			result.current.form.setValue("experienceYears", 3);
		});

		await act(async () => {
			await result.current.handleSubmit();
		});

		expect(result.current.errorMessage).toContain("không hợp lệ");
		expect(result.current.form.formState.errors.experienceYears?.message).toBe(
			"experienceYears must not be less than 0"
		);
	});
});
