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
