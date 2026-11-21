export enum ReportPeriodPreset {
	DAYS_7 = "7d",
	DAYS_30 = "30d",
	DAYS_90 = "90d",
	MONTHS_12 = "12m",
	THIS_MONTH = "this_month",
	LAST_MONTH = "last_month",
	ALL_TIME = "all",
}

export interface PerformanceReportFilterParams {
	from?: string;
	to?: string;
	period?: ReportPeriodPreset;
	province?: string;
	city?: string;
	routeId?: string;
	tripId?: string;
}

export interface ReportTimeWindow {
	from: string;
	to: string;
	preset?: string;
}

export interface BookingMetrics {
	total: number;
	confirmed: number;
	completed: number;
	cancelled: number;
	pending: number;
}

export interface TripMetrics {
	total: number;
	completed: number;
	ongoing: number;
	published: number;
	cancelled: number;
}

export interface RevenueMetricItem {
	amount: number;
	label: "Estimated" | "Actual";
	isEstimated: boolean;
	ledgerSource?: string;
}

export interface RevenueBreakdown {
	estimated: RevenueMetricItem;
	actual: RevenueMetricItem;
	platformFeeActual?: number;
	platformFeeEstimated?: number;
	gmvActual?: number;
	gmvEstimated?: number;
}

export interface PerformanceTrendPoint {
	date: string;
	bookingCount: number;
	tripCount: number;
	fillRate: number;
	cancellationRate: number;
	estimatedRevenue: number;
	actualRevenue: number;
}

export interface PerformanceTripBreakdown {
	id: string;
	title: string;
	routeName?: string;
	status: string;
	bookingCount: number;
	seatsTaken: number;
	capacity: number;
	fillRate: number;
	cancellationRate: number;
	estimatedRevenue: number;
	actualRevenue: number;
}

export interface PerformanceReportData {
	timeWindow: ReportTimeWindow;
	scope: {
		role: string;
		hostId?: string;
	};
	bookings: BookingMetrics;
	trips: TripMetrics;
	fillRate: number;
	cancellationRate: number;
	revenue: RevenueBreakdown;
	timeSeries: PerformanceTrendPoint[];
	breakdown: PerformanceTripBreakdown[];
}
