import type { RevenueAnalyticsResponseDto } from "../../revenue-analytics/dto/revenue-analytics-response.dto";

export type HostAnalyticsRationaleCode =
	| "high_fill_history"
	| "strong_route_rank"
	| "low_cancellation"
	| "repeat_area_demand"
	| "historical_high_month";

export type ExcludedTripReason = "missing_capacity_max" | "missing_num_people";

export interface ExcludedTripDto {
	tripId: string;
	title: string;
	reason: ExcludedTripReason;
}

export interface OperationsTripBreakdownDto {
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

export interface OperationsRouteBreakdownDto {
	routeId: string;
	routeName: string;
	tripCount: number;
	totalGuests: number | null;
	fillRate: number | null;
	cancellationRate: number | null;
}

export interface OperationsAreaBreakdownDto {
	areaCode: string | null;
	areaName: string | null;
	tripCount: number;
	totalGuests: number | null;
	fillRate: number | null;
	cancellationRate: number | null;
}

export interface OperationsMonthBreakdownDto {
	month: string;
	tripCount: number;
	totalGuests: number | null;
	fillRate: number | null;
	cancellationRate: number | null;
}

export interface CancelledTripsSummaryDto {
	count: number;
	tripCancellationRate: number | null;
	bookingsOnCancelledTrips: number;
}

export interface HostOperationsMetricsDto {
	totalGuests: number | null;
	fillRate: number | null;
	cancellationRate: number | null;
	completedTripCount: number;
	includedFillTripCount: number;
	excludedTrips: ExcludedTripDto[];
	cancelledTrips: CancelledTripsSummaryDto;
	byTrip: OperationsTripBreakdownDto[];
	byRoute: OperationsRouteBreakdownDto[];
	byArea: OperationsAreaBreakdownDto[];
	byDepartureMonth: OperationsMonthBreakdownDto[];
}

export interface UpcomingTripSummaryDto {
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

export interface HostUpcomingBlockDto {
	tripCount: number;
	totalCapacityMax: number | null;
	totalSeatsTaken: number;
	includesHeldSeats: true;
	trips: UpcomingTripSummaryDto[];
}

export interface HostLeadTimeDto {
	averageDays: number | null;
	medianDays: number | null;
	sampleSize: number;
}

export interface SeasonalityMonthPointDto {
	month: string;
	tripCount: number;
	totalGuests: number;
	fillRate: number | null;
}

export interface HostSeasonalityDto {
	status: "ok" | "insufficient_history";
	basis: "all_history";
	historySpanMonths: number;
	trend: SeasonalityMonthPointDto[];
	highestMonths: string[] | null;
	lowestMonths: string[] | null;
}

export interface HostAnalyticsDataBasisDto {
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

export interface HostAnalyticsResponseDto {
	financial: RevenueAnalyticsResponseDto;
	operations: HostOperationsMetricsDto;
	upcoming: HostUpcomingBlockDto;
	leadTime: HostLeadTimeDto;
	seasonality: HostSeasonalityDto;
	externalSeason: {
		status: "not_available";
	};
	profit: null;
	profitStatus: "insufficient_data";
	smallSample: boolean;
	dataBasis: HostAnalyticsDataBasisDto;
}

export type HostSuggestionJobStatus = "queued" | "running" | "succeeded" | "failed";

export interface HostTripSuggestionItemDto {
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

export interface HostSuggestionJobResponseDto {
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
	suggestions: HostTripSuggestionItemDto[];
}

export interface QuickCreateContextResponseDto {
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
