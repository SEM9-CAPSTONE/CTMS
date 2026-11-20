import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError, queryKeys } from "../../../core/api";
import { toast } from "../../../shared/components/Toast";
import { healthProfileService } from "../services/health-profile.service";
import type { HealthProfileData } from "../types";
import { useHealthProfile } from "./useHealthProfile";

vi.mock("../services/health-profile.service", () => ({
	healthProfileService: {
		getHealthProfile: vi.fn(),
		updateHealthProfile: vi.fn(),
		grantConsent: vi.fn(),
		revokeConsent: vi.fn(),
	},
}));
vi.mock("../../../shared/components/Toast", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));
const service = vi.mocked(healthProfileService);
const profile: HealthProfileData = {
	id: "stored-health-profile",
	camperId: "camper-1",
	camperName: "Nguyễn Văn An",
	bloodType: "UNKNOWN",
	physicalFitnessLevel: "INTERMEDIATE",
	dietaryRestrictions: "",
	emergencyNotes: "",
	allergies: [],
	medicalConditions: [],
	consent: { isConsentGranted: true, allowedRoles: ["HOST", "PORTER"] },
	accountStatus: "ACTIVE",
	updatedAt: "2026-11-19T12:00:00Z",
	version: 7,
};
function setup() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
	return { ...renderHook(useHealthProfile, { wrapper }), client };
}

describe("useHealthProfile", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		localStorage.setItem("authUser", JSON.stringify({ id: "camper-1", role: "camper" }));
		service.getHealthProfile.mockResolvedValue(profile);
	});
	afterEach(() => localStorage.clear());
	it("loads the persisted fields and saves the current server version", async () => {
		const saved = { ...profile, physicalFitnessLevel: "ADVANCED" as const, version: 8 };
		service.updateHealthProfile.mockResolvedValue(saved);
		const { result } = setup();
		await waitFor(() =>
			expect(result.current.form.getValues("physicalFitnessLevel")).toBe("INTERMEDIATE")
		);
		act(() =>
			result.current.form.setValue("physicalFitnessLevel", "ADVANCED", { shouldDirty: true })
		);
		await act(async () => {
			await result.current.handleSubmit();
		});
		await waitFor(() => expect(result.current.profile?.version).toBe(8));
		expect(service.updateHealthProfile).toHaveBeenCalledWith(
			expect.objectContaining({ physicalFitnessLevel: "ADVANCED", isConsentGranted: true }),
			7
		);
		expect(toast.success).toHaveBeenCalledWith("Đã lưu hồ sơ sức khỏe.");
		expect(service.updateHealthProfile.mock.calls[0][0].activityProfile).not.toHaveProperty(
			"confirmCurrent"
		);
	});
	it("revokes sharing through the API and immediately clears cached suggestions", async () => {
		service.revokeConsent.mockResolvedValue({
			...profile,
			consent: { ...profile.consent, isConsentGranted: false },
			version: 8,
		});
		const { result, client } = setup();
		await waitFor(() => expect(result.current.profile).not.toBeNull());
		client.setQueryData(queryKeys.tripRecommendations.list("camper-1"), {
			status: "ready",
			items: [{ trip: { title: "Khám phá Sơn Trà" } }],
		});
		act(() => result.current.handleRevokeConsent());
		await waitFor(() => expect(result.current.profile?.consent.isConsentGranted).toBe(false));
		expect(client.getQueryData(queryKeys.tripRecommendations.list("camper-1"))).toMatchObject({
			status: "needs_health_consent",
			items: [],
		});
	});
	it("keeps entered fields on a version conflict and never displays raw server errors", async () => {
		service.updateHealthProfile.mockRejectedValue(new HttpError("Stale version", 409, {}));
		const { result } = setup();
		await waitFor(() =>
			expect(result.current.form.getValues("physicalFitnessLevel")).toBe("INTERMEDIATE")
		);
		act(() =>
			result.current.form.setValue("physicalFitnessLevel", "ADVANCED", { shouldDirty: true })
		);
		await act(async () => {
			await result.current.handleSubmit();
		});
		await waitFor(() => expect(result.current.conflictError).toBe(true));
		expect(result.current.form.getValues("physicalFitnessLevel")).toBe("ADVANCED");
		expect(result.current.apiError).not.toContain("Stale version");
	});
	it("does not fabricate a profile when loading fails", async () => {
		service.getHealthProfile.mockRejectedValue(new Error("Internal server error"));
		const { result } = setup();
		await waitFor(() => expect(result.current.apiError).not.toBeNull());
		expect(result.current.profile).toBeNull();
		expect(result.current.apiError).not.toContain("Internal server error");
	});
});
