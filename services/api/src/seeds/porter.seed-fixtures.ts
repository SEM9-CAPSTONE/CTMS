export const PORTER_SEED_ROUTE_NAMES = [
	"Bán Đảo Sơn Trà Discovery",
	"Hải Vân Pass - Nam Hải Vân Trail",
	"Rừng Nguyên Sinh Bà Nà - Núi Chúa",
	"Khe Ram - Suối Mơ - Rừng Hòa Bắc",
] as const;

export type PorterSeedRouteName = (typeof PORTER_SEED_ROUTE_NAMES)[number];
export type PorterSeedAvailability = "available" | "unavailable";
export type PorterSeedProficiency = "learning" | "proficient" | "expert";
export type PorterSeedUserStatus = "active" | "suspended";

export interface PorterSeedFixture {
	key: string;
	email: string;
	phone: string;
	fullName: string;
	userStatus: PorterSeedUserStatus;
	profile: {
		experienceYears: number;
		availabilityStatus: PorterSeedAvailability;
		ratingAvg: number;
		completedTrips: number;
		languages: string[];
	} | null;
	qualification: {
		proficiency: PorterSeedProficiency;
		timesLed: number;
		routeNames: readonly PorterSeedRouteName[];
	} | null;
	conflictingTripTitle?: string;
}

export interface PorterSeedTripScenario {
	title: string;
	window: {
		startsAfterDays: number;
		startHour: number;
		endsAfterDays: number;
		endHour: number;
	};
}

export const PORTER_CONFLICT_TARGET_TRIP: PorterSeedTripScenario = {
	title: "[CTMS-024] Trekking Khe Ram - Rừng Hòa Bắc (Sắp hết hạn - Còn 8h)",
	window: { startsAfterDays: 2, startHour: 6, endsAfterDays: 3, endHour: 17 },
};

export const PORTER_NON_CONFLICT_TARGET_TRIP: PorterSeedTripScenario = {
	title: "[CTMS-024] Khám Phá Bán Đảo Sơn Trà (Bình thường - Còn 12 chỗ)",
	window: { startsAfterDays: 4, startHour: 7, endsAfterDays: 4, endHour: 16 },
};

export const PORTER_CONFLICT_ASSIGNMENT_TRIP: PorterSeedTripScenario = {
	title: "[H-09] Chuyến phân công Porter trùng lịch Khe Ram",
	window: { startsAfterDays: 2, startHour: 12, endsAfterDays: 2, endHour: 16 },
};

export const PORTER_CONFLICT_TRIP_TITLE = PORTER_CONFLICT_ASSIGNMENT_TRIP.title;

export function porterSeedTripWindowsOverlap(
	left: PorterSeedTripScenario["window"],
	right: PorterSeedTripScenario["window"]
): boolean {
	const leftStart = left.startsAfterDays * 24 + left.startHour;
	const leftEnd = left.endsAfterDays * 24 + left.endHour;
	const rightStart = right.startsAfterDays * 24 + right.startHour;
	const rightEnd = right.endsAfterDays * 24 + right.endHour;
	return leftStart < rightEnd && leftEnd > rightStart;
}

export const PORTER_SEED_FIXTURES: readonly PorterSeedFixture[] = [
	{
		key: "expert-lead",
		email: "porter@ctms.local",
		phone: "0900000001",
		fullName: "Nguyễn Minh Sơn",
		userStatus: "active",
		profile: {
			experienceYears: 5,
			availabilityStatus: "available",
			ratingAvg: 4.95,
			completedTrips: 42,
			languages: ["Tiếng Việt", "Tiếng Anh"],
		},
		qualification: {
			proficiency: "expert",
			timesLed: 28,
			routeNames: PORTER_SEED_ROUTE_NAMES,
		},
	},
	{
		key: "proficient-lead",
		email: "porter.proficient@ctms.local",
		phone: "0900000021",
		fullName: "Trần Hoàng An",
		userStatus: "active",
		profile: {
			experienceYears: 4,
			availabilityStatus: "available",
			ratingAvg: 4.7,
			completedTrips: 24,
			languages: ["Tiếng Việt"],
		},
		qualification: {
			proficiency: "proficient",
			timesLed: 9,
			routeNames: PORTER_SEED_ROUTE_NAMES,
		},
	},
	{
		key: "learning-support",
		email: "porter.learning@ctms.local",
		phone: "0900000022",
		fullName: "Lê Thị Mai",
		userStatus: "active",
		profile: {
			experienceYears: 1,
			availabilityStatus: "available",
			ratingAvg: 4.2,
			completedTrips: 5,
			languages: ["Tiếng Việt"],
		},
		qualification: {
			proficiency: "learning",
			timesLed: 0,
			routeNames: PORTER_SEED_ROUTE_NAMES,
		},
	},
	{
		key: "support-no-qualification",
		email: "porter.support@ctms.local",
		phone: "0900000023",
		fullName: "Phạm Quốc Bảo",
		userStatus: "active",
		profile: {
			experienceYears: 2,
			availabilityStatus: "available",
			ratingAvg: 4.4,
			completedTrips: 11,
			languages: ["Tiếng Việt"],
		},
		qualification: null,
	},
	{
		key: "second-expert-lead",
		email: "porter.expert@ctms.local",
		phone: "0900000024",
		fullName: "Đỗ Thanh Tùng",
		userStatus: "active",
		profile: {
			experienceYears: 8,
			availabilityStatus: "available",
			ratingAvg: 4.85,
			completedTrips: 67,
			languages: ["Tiếng Việt", "Tiếng Anh"],
		},
		qualification: {
			proficiency: "expert",
			timesLed: 41,
			routeNames: PORTER_SEED_ROUTE_NAMES,
		},
	},
	{
		key: "unavailable",
		email: "porter.unavailable@ctms.local",
		phone: "0900000025",
		fullName: "Võ Ngọc Hà",
		userStatus: "active",
		profile: {
			experienceYears: 6,
			availabilityStatus: "unavailable",
			ratingAvg: 4.6,
			completedTrips: 31,
			languages: ["Tiếng Việt"],
		},
		qualification: {
			proficiency: "expert",
			timesLed: 17,
			routeNames: PORTER_SEED_ROUTE_NAMES,
		},
	},
	{
		key: "inactive-account",
		email: "porter.inactive@ctms.local",
		phone: "0900000026",
		fullName: "Bùi Đức Long",
		userStatus: "suspended",
		profile: {
			experienceYears: 7,
			availabilityStatus: "available",
			ratingAvg: 4.8,
			completedTrips: 38,
			languages: ["Tiếng Việt"],
		},
		qualification: null,
	},
	{
		key: "missing-profile",
		email: "porter.no-profile@ctms.local",
		phone: "0900000027",
		fullName: "Ngô Hải Nam",
		userStatus: "active",
		profile: null,
		qualification: null,
	},
	{
		key: "schedule-conflict",
		email: "porter.conflict@ctms.local",
		phone: "0900000028",
		fullName: "Hoàng Gia Huy",
		userStatus: "active",
		profile: {
			experienceYears: 3,
			availabilityStatus: "available",
			ratingAvg: 4.5,
			completedTrips: 16,
			languages: ["Tiếng Việt"],
		},
		qualification: {
			proficiency: "proficient",
			timesLed: 6,
			routeNames: PORTER_SEED_ROUTE_NAMES,
		},
		conflictingTripTitle: PORTER_CONFLICT_TRIP_TITLE,
	},
];
