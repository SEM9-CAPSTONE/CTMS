export type DemandStatus =
	| "pending"
	| "running"
	| "succeeded"
	| "failed"
	| "insufficient_data"
	| "withheld";
export type TripType = "day_trip" | "overnight";
export type Difficulty = "easy" | "moderate" | "hard" | "expert";
export interface DemandCell {
	tripType: TripType;
	difficulty: Difficulty | null;
	bookerBand: { min: number; max: number };
}
export interface DemandReport {
	version: string;
	month: string;
	dataWindow: { start: string; end: string };
	generatedAt: string | null;
	status: DemandStatus;
	stale: boolean;
	cells: DemandCell[];
	suggestions: {
		tripType: TripType;
		difficulty: Difficulty | null;
		reason: "observed_booking_interest" | "advisory_not_forecast";
	}[];
	errorCode: string | null;
	canRetry?: boolean;
}
export interface DemandPeriod {
	month: string;
	availableAt: string;
	canCreate: boolean;
	hasReport: boolean;
}

export type DemandPlanningStatus =
	| "not_requested"
	| "pending"
	| "running"
	| "succeeded"
	| "failed"
	| "unavailable"
	| "withheld";

export type FocusCode =
	| "balanced_pace"
	| "clear_inclusions"
	| "group_organization"
	| "overnight_preparation"
	| "price_transparency";

export interface PlanningArea {
	code: string;
	label: string;
	provenance: "host_confirmed_catalog";
}

export interface PlanningRecommendation {
	candidateId: string;
	tripType: TripType;
	difficulty: Difficulty | null;
	bookerBand: { min: number; max: number };
	priceBand: string | null;
	capacityBand: string | null;
	durationBand: string | null;
	area: PlanningArea | null;
	priceRangeLabel: string | null;
	capacityRangeLabel: string | null;
	durationLabel: string | null;
	evidenceBasis: "observed_bookings";
	capacityMeaning: "offered_at_booking";
	generalAdvice: { code: FocusCode; text: string }[];
	disclaimer: string;
}

export interface DemandPlanningReport {
	status: DemandPlanningStatus;
	reportVersion: string;
	dataPeriod: string;
	generatedAt: string | null;
	stale: boolean;
	recommendations: PlanningRecommendation[];
	errorCode: string | null;
}

export interface CreatePlanningResponse {
	status: "pending" | "running" | "succeeded" | "failed";
	reused: boolean;
}
