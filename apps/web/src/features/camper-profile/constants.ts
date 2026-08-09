import { SettingsTabEnum } from "./enums/settings-tab.enum";
import type { CamperProfileData, SettingsTabConfig } from "./types";

export const INITIAL_MOCK_CAMPER_PROFILE: CamperProfileData = {
	id: "cmp-001",
	accountStatus: "active",
	fullName: "Minh Quân",
	email: "minhquan.camper@gmail.com",
	phone: "0905123456",
	avatarUrl:
		"https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
	isProMember: true,
	joinedYear: 2021,
	dateOfBirth: "1995-06-15",
	gender: "male",
	address: "123 Lê Lợi, Đà Nẵng",
	bio: "Yêu thích trekking và khám phá thiên nhiên, muốn chinh phục thêm các đỉnh núi mới tại Việt Nam.",
	campingExperienceYears: 5,
	trekkingExperienceDetails:
		"3 năm kinh nghiệm, đã hoàn thành trekking Fansipan, Tả Năng - Phan Dũng và Bidoup.",
	languages: [
		{ id: "lang-vi", code: "vi", name: "Tiếng Việt" },
		{ id: "lang-en", code: "en", name: "Tiếng Anh" },
	],
	emergencyContacts: [],
	completionPercentage: 80,
	emergencyContactAdded: false,
	phoneVerified: false,
};

export const SETTINGS_TABS: SettingsTabConfig[] = [
	{
		key: SettingsTabEnum.PERSONAL_PROFILE,
		label: "Hồ sơ cá nhân",
		iconName: "User",
	},
	{
		key: SettingsTabEnum.CONTACT_INFO,
		label: "Thông tin liên hệ",
		iconName: "PhoneCall",
	},
	{
		key: SettingsTabEnum.EMERGENCY_INFO,
		label: "Thông tin khẩn cấp",
		iconName: "ShieldAlert",
		badgeCount: 1,
	},
	{
		key: SettingsTabEnum.HEALTH_FITNESS,
		label: "Sức khỏe & thể lực",
		iconName: "HeartPulse",
	},
	{
		key: SettingsTabEnum.PERSONAL_GEAR,
		label: "Thiết bị cá nhân",
		iconName: "Backpack",
	},
	{
		key: SettingsTabEnum.NOTIFICATIONS,
		label: "Thông báo",
		iconName: "Bell",
	},
	{
		key: SettingsTabEnum.PRIVACY,
		label: "Quyền riêng tư",
		iconName: "Lock",
	},
	{
		key: SettingsTabEnum.SECURITY,
		label: "Bảo mật tài khoản",
		iconName: "KeyRound",
	},
];
