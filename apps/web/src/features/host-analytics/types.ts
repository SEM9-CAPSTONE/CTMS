import type { RevenueAnalyticsData } from "../revenue-analytics/types";

export type HostAnalyticsPeriodPreset = "30d" | "90d" | "6m" | "12m" | "custom";

export type HostAnalyticsRationaleCode =
	| "high_fill_history"
	| "strong_route_rank"
	| "low_cancellation"
	| "repeat_area_demand"
	| "historical_high_month";

export type ExcludedTripReason = "missing_capacity_max" | "missing_num_people";

export interface ExcludedTrip {
	tripId: string;
	title: string;
	reason: ExcludedTripReason;
}

export interface OperationsTripBreakdown {
	tripId: string;
	title: string;
	routeId: string;
	routeName: string;
	areaCode: string | null;
	areaName: string | null;
	startsAt: string;
	capacityMax: number | null;
	seatsTaken: number;
	totalGuests: number | null;
	fillRate: number | null;
	bookingCount: number;
	cancelledBookingCount: number;
	cancellationRate: number | null;
}

export interface OperationsRouteBreakdown {
	routeId: string;
	routeName: string;
	tripCount: number;
	totalGuests: number | null;
	fillRate: number | null;
	cancellationRate: number | null;
}

export interface OperationsAreaBreakdown {
	areaCode: string | null;
	areaName: string | null;
	tripCount: number;
	totalGuests: number | null;
	fillRate: number | null;
	cancellationRate: number | null;
}

export interface OperationsMonthBreakdown {
	month: string;
	tripCount: number;
	totalGuests: number | null;
	fillRate: number | null;
	cancellationRate: number | null;
}

export interface CancelledTripsSummary {
	count: number;
	tripCancellationRate: number | null;
	bookingsOnCancelledTrips: number;
}

export interface HostOperationsMetrics {
	totalGuests: number | null;
	fillRate: number | null;
	cancellationRate: number | null;
	completedTripCount: number;
	includedFillTripCount: number;
	excludedTrips: ExcludedTrip[];
	cancelledTrips: CancelledTripsSummary;
	byTrip: OperationsTripBreakdown[];
	byRoute: OperationsRouteBreakdown[];
	byArea: OperationsAreaBreakdown[];
	byDepartureMonth: OperationsMonthBreakdown[];
}

export interface UpcomingTripSummary {
	tripId: string;
	title: string;
	routeId: string;
	routeName: string;
	areaCode: string | null;
	areaName: string | null;
	status: "published" | "ongoing";
	startsAt: string;
	capacityMin: number;
	capacityMax: number | null;
	seatsTaken: number;
}

export interface HostUpcomingBlock {
	tripCount: number;
	totalCapacityMax: number | null;
	totalSeatsTaken: number;
	includesHeldSeats: true;
	trips: UpcomingTripSummary[];
}

export interface HostLeadTime {
	averageDays: number | null;
	medianDays: number | null;
	sampleSize: number;
}

export interface SeasonalityMonthPoint {
	month: string;
	tripCount: number;
	totalGuests: number;
	fillRate: number | null;
}

export interface HostSeasonality {
	status: "ok" | "insufficient_history";
	basis: "all_history";
	historySpanMonths: number;
	trend: SeasonalityMonthPoint[];
	highestMonths: string[] | null;
	lowestMonths: string[] | null;
}

export interface HostAnalyticsDataBasis {
	timezone: "Asia/Ho_Chi_Minh";
	financialBasis: string;
	operationsBasis: "trips.starts_at";
	period: {
		from: string;
		to: string;
	};
	analyzedTripCount: number;
	generatedAt: string;
	formulaVersion: string;
}

export interface HostAnalyticsResponse {
	financial: RevenueAnalyticsData;
	operations: HostOperationsMetrics;
	upcoming: HostUpcomingBlock;
	leadTime: HostLeadTime;
	seasonality: HostSeasonality;
	externalSeason: {
		status: "not_available";
	};
	profit: null;
	profitStatus: "insufficient_data";
	smallSample: boolean;
	dataBasis: HostAnalyticsDataBasis;
}

export type HostSuggestionJobStatus = "queued" | "running" | "succeeded" | "failed";

export interface HostTripSuggestionItem {
	id: string;
	routeId: string;
	routeName: string | null;
	areaCode: string | null;
	areaName: string | null;
	tripType: "day_trip" | "overnight";
	monthHint: string;
	priceBand: string | null;
	capacityBand: string | null;
	suggestedPricePerPerson: number | null;
	suggestedCapacityMin: number | null;
	rationaleCodes: HostAnalyticsRationaleCode[];
	rationaleLabels: string[];
	missingData: string[];
	createdAt: string;
}

export interface HostSuggestionJobResponse {
	id: string;
	status: HostSuggestionJobStatus;
	periodFrom: string;
	periodTo: string;
	areaCode: string | null;
	promptVersion: string;
	errorCode: string | null;
	stale: boolean;
	createdAt: string;
	startedAt: string | null;
	finishedAt: string | null;
	suggestions: HostTripSuggestionItem[];
}

export interface ActiveSuggestionJobConflict {
	id: string;
	status: HostSuggestionJobStatus;
	periodFrom: string;
	periodTo: string;
	areaCode: string | null;
}

export interface QuickCreateContextResponse {
	valid: true;
	prefill: {
		routeId: string;
		areaCode: string | null;
		tripType: "day_trip" | "overnight";
		pricePerPerson: number | null;
		capacityMin: number | null;
		suggestedMonth: string;
	};
}

export interface HostAnalyticsFilterParams {
	from: string;
	to: string;
	areaCode?: string;
}
