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

function getStoredAvatar(userId?: string): string | null {
	if (typeof window === "undefined" || !userId) return null;
	try {
		return localStorage.getItem(`camper_avatar_${userId}`);
	} catch {
		return null;
	}
}

function setStoredAvatar(userId: string, avatarUrl: string): void {
	if (typeof window === "undefined" || !userId) return;
	try {
		localStorage.setItem(`camper_avatar_${userId}`, avatarUrl);
	} catch {
		// Ignore storage errors
	}
}

function toCamperProfileData(apiProfile: ProfileApiResponse): CamperProfileData {
	const joinedYear = new Date(apiProfile.createdAt).getFullYear();
	const emergencyContactAdded = (apiProfile.emergencyContacts?.length ?? 0) > 0;
	const requiredFields = [
		Boolean(apiProfile.fullName?.trim()),
		Boolean(apiProfile.phone?.trim()),
		Boolean(apiProfile.dateOfBirth?.trim()),
		Boolean(apiProfile.gender),
		Boolean(apiProfile.address?.trim()),
		emergencyContactAdded,
	];
	const completionPercentage = Math.round(
		(requiredFields.filter(Boolean).length / requiredFields.length) * 100
	);

	const storedAvatar = getStoredAvatar(apiProfile.id);
	const resolvedAvatarUrl = apiProfile.avatarUrl || storedAvatar || DEFAULT_AVATAR_URL;
	if (apiProfile.avatarUrl && apiProfile.id) {
		setStoredAvatar(apiProfile.id, apiProfile.avatarUrl);
	}

	return {
		id: apiProfile.id,
		accountStatus: apiProfile.status,
		fullName: getProfileDisplayName(apiProfile),
		email: apiProfile.email ?? "",
		phone: apiProfile.phone ?? "",
		avatarUrl: resolvedAvatarUrl,
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
		phone: values.phone,
		dateOfBirth: toApiDate(values.dateOfBirth),
		gender: values.gender,
		address: values.address,
		bio: values.bio ?? "",
		avatarUrl: values.avatarUrl,
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

	updateAvatar: async (avatarUrl: string, userId?: string): Promise<string> => {
		if (userId) {
			setStoredAvatar(userId, avatarUrl);
		}
		const updated = await httpClient.patch<ProfileApiResponse>(API_ENDPOINTS.PROFILE.ME, {
			avatarUrl,
		});
		if (updated?.id) {
			setStoredAvatar(updated.id, updated.avatarUrl || avatarUrl);
		}
		return updated?.avatarUrl || avatarUrl;
	},
};
