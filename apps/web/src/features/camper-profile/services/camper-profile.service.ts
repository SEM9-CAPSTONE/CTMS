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

function toDisplayDate(value: string | null): string {
	if (!value) {
		return "";
	}

	const [datePart] = value.split("T");
	const [year, month, day] = datePart.split("-");
	if (!year || !month || !day) {
		return value;
	}

	return `${day}/${month}/${year}`;
}

function toApiDate(value: string): string | undefined {
	if (!value) {
		return undefined;
	}

	const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
	if (ddmmyyyy) {
		const [, day, month, year] = ddmmyyyy;
		return `${year}-${month}-${day}`;
	}

	return value;
}

function getProfileDisplayName(apiProfile: ProfileApiResponse): string {
	const fullName = apiProfile.fullName?.trim();
	if (fullName) {
		return fullName;
	}

	const emailPrefix = apiProfile.email?.split("@")[0]?.trim();
	if (emailPrefix) {
		return emailPrefix;
	}

	return apiProfile.phone ?? "Người dùng";
}

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
		fullName: getProfileDisplayName(apiProfile),
		email: apiProfile.email ?? "",
		phone: apiProfile.phone ?? "",
		avatarUrl: DEFAULT_AVATAR_URL,
		isProMember: false,
		joinedYear: Number.isFinite(joinedYear) ? joinedYear : new Date().getFullYear(),
		dateOfBirth: toDisplayDate(apiProfile.dateOfBirth),
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
		dateOfBirth: toApiDate(values.dateOfBirth),
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
