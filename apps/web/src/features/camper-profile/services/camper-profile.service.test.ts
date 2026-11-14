import { beforeEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "../../../core/api";
import type { CamperProfileFormValues } from "../schema/profile.schema";
import type { ProfileApiResponse } from "../types";
import { camperProfileService } from "./camper-profile.service";

vi.mock("../../../core/api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../../core/api")>();
	return { ...actual, httpClient: { get: vi.fn(), patch: vi.fn() } };
});

const http = vi.mocked(httpClient);

const apiProfile = (overrides: Partial<ProfileApiResponse> = {}): ProfileApiResponse => ({
	id: "camper-1",
	email: "camper@ctms.local",
	phone: "+84912345678",
	role: "camper",
	status: "active",
	fullName: "Nguyễn Thu Hà",
	avatarUrl: null,
	dateOfBirth: "1996-05-14",
	gender: "female",
	address: "Hải Châu, Đà Nẵng",
	bio: "Mê săn mây",
	campingExperienceYears: 3,
	trekkingExperienceDetails: "Đã trekking Sơn Trà và đèo Hải Vân",
	emergencyContacts: [],
	createdAt: "2025-01-01T00:00:00.000Z",
	updatedAt: "2025-01-01T00:00:00.000Z",
	...overrides,
});

describe("camperProfileService experience", () => {
	beforeEach(() => vi.clearAllMocks());

	it("reads the saved experience instead of resetting it", async () => {
		http.get.mockResolvedValue(apiProfile());
		const profile = await camperProfileService.getProfile();
		expect(profile.campingExperienceYears).toBe(3);
		expect(profile.trekkingExperienceDetails).toBe("Đã trekking Sơn Trà và đèo Hải Vân");
	});

	it("shows empty fields for an account that never filled them", async () => {
		http.get.mockResolvedValue(
			apiProfile({ campingExperienceYears: null, trekkingExperienceDetails: null })
		);
		const profile = await camperProfileService.getProfile();
		expect(profile.campingExperienceYears).toBe(0);
		expect(profile.trekkingExperienceDetails).toBe("");
	});

	it("sends the experience when saving the profile", async () => {
		http.patch.mockResolvedValue(apiProfile({ campingExperienceYears: 5 }));
		const values = {
			fullName: "Nguyễn Thu Hà",
			phone: "+84912345678",
			dateOfBirth: "14/05/1996",
			gender: "female",
			address: "Hải Châu, Đà Nẵng",
			bio: "Mê săn mây",
			avatarUrl: "",
			campingExperienceYears: 5,
			trekkingExperienceDetails: "Leo Bà Nà hai lần",
			emergencyContacts: [],
		} as unknown as CamperProfileFormValues;
		const saved = await camperProfileService.updateProfile(values, []);
		expect(http.patch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				campingExperienceYears: 5,
				trekkingExperienceDetails: "Leo Bà Nà hai lần",
				dateOfBirth: "1996-05-14",
			})
		);
		expect(saved.campingExperienceYears).toBe(5);
	});
});
