import type { TrekkingRouteDifficulty, TripSummary, TripType } from "../trips/types";

export type TripRegionCode =
	| "son_tra"
	| "hai_van_lien_chieu"
	| "ba_na_hoa_vang"
	| "ngu_hanh_son"
	| "city_center";

export type RecommendationReason =
	| "preferred_trip_type"
	| "preferred_difficulty"
	| "preferred_region"
	| "preferred_price"
	| "booked_trip_type"
	| "booked_difficulty"
	| "booked_region"
	| "booked_price"
	| "departing_soon"
	| "fitness_match";

export interface TripPreferencesInput {
	tripTypes: TripType[];
	difficulties: TrekkingRouteDifficulty[];
	regions: TripRegionCode[];
	minPrice: number | null;
	maxPrice: number | null;
}

export interface TripPreferences extends TripPreferencesInput {
	updatedAt: string | null;
	regionOptions: Array<{ code: TripRegionCode; label: string }>;
}

export interface TripRecommendationItem {
	trip: TripSummary;
	reasons: RecommendationReason[];
}

export type ExplanationKind =
	| "trip_type"
	| "fitness"
	| "difficulty"
	| "health_note"
	| "allergy"
	| "diet"
	| "age"
	| "interest"
	| "experience"
	| "region"
	| "price"
	| "route"
	| "timing"
	| "availability";

export type ExplanationSource =
	| "health_profile"
	| "personal_profile"
	| "trip_preferences"
	| "booking_history";

export interface TripRecommendationExplanationSection {
	kind: ExplanationKind;
	/** match: why it fits; info: facts; caution: what to weigh before booking. */
	tone: "match" | "info" | "caution";
	title: string;
	/** What the Camper entered, quoted back; null for facts that come only from the Trip. */
	quote: { source: ExplanationSource; field: string; text: string } | null;
	detail: string;
	/** "Vì vậy …" */
	conclusion: string | null;
}

/** Server-written, Vietnamese "why this Trip" for one Trip of the Camper's latest suggestions. */
export interface TripRecommendationExplanation {
	tripTitle: string;
	reasons: RecommendationReason[];
	sections: TripRecommendationExplanationSection[];
	/** Overall "Vì vậy chuyến này phù hợp với bạn…" */
	summary: string;
	healthConsidered: boolean;
	generatedAt: string;
}

export interface TripRecommendations {
	/** needs_preferences: no preferences and no booking history yet, nothing was generated. */
	status: "ready" | "needs_preferences";
	items: TripRecommendationItem[];
	generatedAt: string;
	mode: "ai" | "rules" | null;
}
