import type { SettingsTabEnum } from "./enums/settings-tab.enum";

export interface LanguageItem {
	id: string;
	code: string;
	name: string;
}

export interface ProfileCompletionAction {
	id: string;
	label: string;
	tabTarget: SettingsTabEnum;
	isCompleted: boolean;
}

export type ProfileGender = "male" | "female" | "other";

export interface EmergencyContactData {
	id?: string;
	name: string;
	relationship: string;
	phone: string;
	email?: string | null;
}

export interface ProfileApiResponse {
	id: string;
	email: string | null;
	phone: string | null;
	role: "camper" | "host" | "porter" | "admin";
	status: "pending_verification" | "active" | "suspended" | "deleted";
	fullName: string | null;
	dateOfBirth: string | null;
	gender: ProfileGender | null;
	address: string | null;
	bio: string | null;
	emergencyContacts: EmergencyContactData[];
	createdAt: string;
	updatedAt: string;
}

export interface UpdateProfilePayload {
	fullName?: string;
	dateOfBirth?: string;
	gender?: ProfileGender;
	address?: string;
	bio?: string;
	emergencyContacts?: EmergencyContactData[];
}

export interface CamperProfileData {
	id: string;
	accountStatus: ProfileApiResponse["status"];
	fullName: string;
	email: string;
	phone: string;
	avatarUrl: string;
	isProMember: boolean;
	joinedYear: number;
	dateOfBirth: string;
	gender: ProfileGender;
	address: string;
	bio: string;
	campingExperienceYears: number;
	trekkingExperienceDetails: string;
	languages: LanguageItem[];
	emergencyContacts: EmergencyContactData[];
	completionPercentage: number;
	emergencyContactAdded: boolean;
	phoneVerified: boolean;
}

export interface SettingsTabConfig {
	key: SettingsTabEnum;
	label: string;
	iconName: string;
	badgeCount?: number;
}
