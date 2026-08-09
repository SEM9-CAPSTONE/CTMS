import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { CamperProfileFormValues } from "../schema/profile.schema";
import type {
	CamperProfileData,
	LanguageItem,
	ProfileApiResponse,
	UpdateProfilePayload,
} from "../types";

const DEFAULT_AVATAR_URL =
	"https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80";

function toCamperProfileData(apiProfile: ProfileApiResponse): CamperProfileData {
	const joinedYear = new Date(apiProfile.createdAt).getFullYear();
	const emergencyContactAdded = apiProfile.emergencyContacts.length > 0;
	const requiredFields = [
		apiProfile.fullName,
		apiProfile.dateOfBirth,
		apiProfile.gender,
		apiProfile.address,
		apiProfile.phone,
	];
	const completionPercentage = Math.round(
		((requiredFields.filter(Boolean).length + (emergencyContactAdded ? 1 : 0)) /
			(requiredFields.length + 1)) *
			100
	);

	return {
		id: apiProfile.id,
		accountStatus: apiProfile.status,
		fullName: apiProfile.fullName ?? "Camper",
		email: apiProfile.email ?? "",
		phone: apiProfile.phone ?? "",
		avatarUrl: DEFAULT_AVATAR_URL,
		isProMember: false,
		joinedYear: Number.isFinite(joinedYear) ? joinedYear : new Date().getFullYear(),
		dateOfBirth: apiProfile.dateOfBirth ?? "",
		gender: apiProfile.gender ?? "male",
		address: apiProfile.address ?? "",
		bio: apiProfile.bio ?? "",
		campingExperienceYears: 0,
		trekkingExperienceDetails: "",
		languages: [],
		emergencyContacts: apiProfile.emergencyContacts,
		completionPercentage,
		emergencyContactAdded,
		phoneVerified: Boolean(apiProfile.phone),
	};
}

function toUpdateProfilePayload(values: CamperProfileFormValues): UpdateProfilePayload {
	return {
		fullName: values.fullName,
		dateOfBirth: values.dateOfBirth,
		gender: values.gender,
		address: values.address,
		bio: values.bio ?? "",
		emergencyContacts: values.emergencyContacts.map((contact) => ({
			name: contact.name,
			relationship: contact.relationship,
			phone: contact.phone,
			email: contact.email?.trim() ? contact.email.trim() : null,
		})),
	};
}

export const camperProfileService = {
	getProfile: async (): Promise<CamperProfileData> => {
		const profile = await httpClient.get<ProfileApiResponse>(API_ENDPOINTS.PROFILE.ME);
		return toCamperProfileData(profile);
	},

	updateProfile: async (
		values: CamperProfileFormValues,
		_languages: LanguageItem[]
	): Promise<CamperProfileData> => {
		const updated = await httpClient.patch<ProfileApiResponse>(
			API_ENDPOINTS.PROFILE.ME,
			toUpdateProfilePayload(values)
		);
		return toCamperProfileData(updated);
	},

	updateAvatar: async (avatarUrl: string): Promise<string> => avatarUrl,
};
