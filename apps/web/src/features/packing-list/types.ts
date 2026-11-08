export type PackingListItemCategory = "essential" | "clothing" | "gear" | "safety" | "health";

export interface PackingListItem {
	id: string;
	name: string;
	category: PackingListItemCategory;
	required: boolean;
	reason: string;
	alreadyCovered: boolean;
}

export type PackingListTripType = "day_trip" | "overnight";

export type PackingListDifficulty = "easy" | "moderate" | "hard" | "expert";

export type PackingListWeatherRiskLevel = "green" | "yellow" | "red";

export interface PackingListContext {
	durationNights: number;
	tripType: PackingListTripType;
	difficulty: PackingListDifficulty | null;
	memberCount: number;
	weatherRiskLevel: PackingListWeatherRiskLevel | null;
	/** `trip_forecast` = forecast for the Trip's own dates; absent on older API responses. */
	weatherSource?: "trip_forecast" | "route_assessment" | null;
}

export interface PackingListResponse {
	bookingId: string;
	tripId: string;
	context: PackingListContext;
	items: PackingListItem[];
}
