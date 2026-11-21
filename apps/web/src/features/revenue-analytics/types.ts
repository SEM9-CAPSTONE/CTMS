import type { ReportPeriodPreset, ReportTimeWindow } from "../performance-reports/types";

export type RevenueGranularity = "day" | "week" | "month";

export interface RevenueAnalyticsFilterParams {
	period?: ReportPeriodPreset;
	from?: string;
	to?: string;
	granularity?: RevenueGranularity;
	areaCode?: string;
	hostId?: string;
}

export interface RevenueKpis {
	grossRevenue: number;
	refundAmount: number;
	platformFee: number;
	netRevenue: number;
	postSettlementRefund: number;
	payout: number | null;
	heldFunds: number;
	pendingPayout: number | null;
	pendingRefundAmount: number;
	pendingRefundCount: number;
}

export interface RevenueTimeSeriesPoint {
	bucket: string;
	grossRevenue: number;
	refundAmount: number;
	platformFee: number;
	netRevenue: number;
	payout: number | null;
}

export interface RevenueAreaBreakdown {
	areaCode: string | null;
	areaName: string | null;
	tripCount: number;
	grossRevenue: number;
	refundAmount: number;
	platformFee: number;
	netRevenue: number;
	heldFunds: number;
	grossShare: number;
}

export interface RevenueTripBreakdown {
	tripId: string;
	title: string;
	startsAt: string;
	areaName: string | null;
	bookingCount: number;
	grossRevenue: number;
	refundAmount: number;
	platformFee: number;
	netRevenue: number;
	heldFunds: number;
	settledAt: string | null;
}

export interface RevenueHostOption {
	id: string;
	fullName: string;
}

export interface RevenueAnalyticsData {
	currency: "VND";
	timeWindow: ReportTimeWindow;
	granularity: RevenueGranularity;
	scope: { role: "admin" | "host"; hostId?: string; areaCode?: string };
	dateBasis: Record<string, string>;
	kpis: RevenueKpis;
	payoutAreaScoped: boolean;
	timeSeries: RevenueTimeSeriesPoint[];
	byArea: RevenueAreaBreakdown[];
	byTrip: RevenueTripBreakdown[];
	hosts?: RevenueHostOption[];
}

export interface GeoArea {
	code: string;
	name: string;
	provinceCode: string;
	provinceName: string;
}
