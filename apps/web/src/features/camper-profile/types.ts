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

export interface CamperProfileData {
	id: string;
	fullName: string;
	email: string;
	phone: string;
	avatarUrl: string;
	isProMember: boolean;
	joinedYear: number;
	dateOfBirth: string;
	gender: "male" | "female" | "other";
	address: string;
	bio: string;
	campingExperienceYears: number;
	trekkingExperienceDetails: string;
	languages: LanguageItem[];
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
