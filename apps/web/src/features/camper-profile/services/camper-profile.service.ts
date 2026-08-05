import { INITIAL_MOCK_CAMPER_PROFILE } from "../constants";
import type { CamperProfileFormValues } from "../schema/profile.schema";
import type { CamperProfileData, LanguageItem } from "../types";

let currentProfileMemory: CamperProfileData = { ...INITIAL_MOCK_CAMPER_PROFILE };

export const camperProfileService = {
	getProfile: async (): Promise<CamperProfileData> => {
		// Simulate API response delay
		await new Promise((resolve) => setTimeout(resolve, 150));
		return { ...currentProfileMemory };
	},

	updateProfile: async (
		values: CamperProfileFormValues,
		languages: LanguageItem[]
	): Promise<CamperProfileData> => {
		await new Promise((resolve) => setTimeout(resolve, 200));

		currentProfileMemory = {
			...currentProfileMemory,
			fullName: values.fullName,
			dateOfBirth: values.dateOfBirth,
			gender: values.gender,
			address: values.address,
			bio: values.bio ?? "",
			campingExperienceYears: values.campingExperienceYears,
			trekkingExperienceDetails: values.trekkingExperienceDetails ?? "",
			languages: [...languages],
		};

		return { ...currentProfileMemory };
	},

	updateAvatar: async (avatarUrl: string): Promise<string> => {
		await new Promise((resolve) => setTimeout(resolve, 150));
		currentProfileMemory.avatarUrl = avatarUrl;
		return avatarUrl;
	},
};
