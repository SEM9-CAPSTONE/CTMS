import { afterEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "../../../core/api/httpClient";
import type { HealthProfileFormValues } from "../schema/health-profile.schema";
import { healthProfileService } from "./health-profile.service";

describe("persisted health profile API", () => {
	afterEach(() => vi.restoreAllMocks());
	it("returns the API's direct response and never a substitute profile", async () => {
		const profile = {
			id: "stored-profile",
			physicalFitnessLevel: "ADVANCED",
			consent: { isConsentGranted: false },
		};
		const get = vi.spyOn(httpClient, "get").mockResolvedValue(profile);
		expect(await healthProfileService.getHealthProfile()).toBe(profile);
		expect(get).toHaveBeenCalledWith("/camper/health-profile");
		get.mockRejectedValueOnce(new Error("Unavailable"));
		await expect(healthProfileService.getHealthProfile()).rejects.toThrow("Unavailable");
	});
	it("saves fields and the version through PUT, and persists consent through POST", async () => {
		const values: HealthProfileFormValues = {
			bloodType: "UNKNOWN",
			physicalFitnessLevel: "BEGINNER",
			allergies: [],
			medicalConditions: [],
			isConsentGranted: false,
		};
		const put = vi.spyOn(httpClient, "put").mockResolvedValue({});
		const post = vi.spyOn(httpClient, "post").mockResolvedValue({});
		await healthProfileService.updateHealthProfile(values, 4);
		expect(put).toHaveBeenCalledWith("/camper/health-profile", values, { params: { version: 4 } });
		await healthProfileService.grantConsent();
		expect(post).toHaveBeenLastCalledWith("/camper/health-profile/consent/grant");
		await healthProfileService.revokeConsent();
		expect(post).toHaveBeenLastCalledWith("/camper/health-profile/consent/revoke");
	});
});
