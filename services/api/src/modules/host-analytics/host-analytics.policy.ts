import { createHash } from "node:crypto";
import { BadRequestException } from "@nestjs/common";
import type {
	ExcludedTripDto,
	HostAnalyticsRationaleCode,
	HostLeadTimeDto,
	HostOperationsMetricsDto,
	HostSeasonalityDto,
	OperationsAreaBreakdownDto,
	OperationsMonthBreakdownDto,
	OperationsRouteBreakdownDto,
	OperationsTripBreakdownDto,
	SeasonalityMonthPointDto,
} from "./dto/host-analytics-response.dto";

export const HOST_ANALYTICS_TIMEZONE = "Asia/Ho_Chi_Minh" as const;
export const HOST_ANALYTICS_FORMULA_VERSION = "host-analytics-v1" as const;
export const HOST_PLANNING_PROMPT_VERSION = "host-planning-v1" as const;
export const SMALL_SAMPLE_MIN_TRIPS = 5;
export const SMALL_SAMPLE_MIN_BOOKINGS = 20;
export const SEASONALITY_MIN_SPAN_MONTHS = 12;
export const UPCOMING_TRIPS_LIMIT = 20;

export const ALLOWED_RATIONALE_CODES: readonly HostAnalyticsRationaleCode[] = [
	"high_fill_history",
	"strong_route_rank",
	"low_cancellation",
	"repeat_area_demand",
	"historical_high_month",
] as const;

export const RATIONALE_LABELS_VI: Record<HostAnalyticsRationaleCode, string> = {
	high_fill_history: "Tuyến có tỷ lệ lấp đầy lịch sử cao",
	strong_route_rank: "Tuyến nằm trong nhóm đóng góp doanh thu tốt nhất của bạn",
	low_cancellation: "Tỷ lệ hủy đặt chỗ lịch sử ở mức thấp",
	repeat_area_demand: "Khu vực có lịch sử tổ chức chuyến ổn định",
	historical_high_month: "Tháng nằm trong nhóm hoạt động cao nhất theo lịch sử",
};

export interface CompletedTripRow {
	id: string;
	title: string;
	routeId: string;
	routeName: string;
	tripType: "day_trip" | "overnight";
	areaCode: string | null;
	areaName: string | null;
	startsAt: Date;
	capacityMin: number;
	capacityMax: number | null;
	seatsTaken: number;
	pricePerPerson: number;
}

export interface BookingRow {
	id: string;
	tripId: string;
	status: string;
	numPeople: number | null;
	createdAt: Date;
	tripStartsAtSnapshot: Date | null;
}

export interface ActiveRouteWithAreaRow {
	routeId: string;
	routeName: string;
	areaCode: string | null;
	areaName: string | null;
	areaActive: boolean;
}

export interface RouteCandidate {
	candidateId: string;
	routeId: string;
	routeName: string;
	areaCode: string | null;
	areaName: string | null;
	tripType: "day_trip" | "overnight";
	priceBand: string | null;
	capacityBand: string | null;
	suggestedPricePerPerson: number | null;
	suggestedCapacityMin: number | null;
	fillBand: "low" | "medium" | "high" | "unknown";
	revenueRank: number;
	allowedMonths: string[];
	missingData: string[];
}

export interface AiPlanningSelectionItem {
	candidateId: string;
	monthHint: string;
	rationaleCodes: HostAnalyticsRationaleCode[];
}

export interface SourceHashInput {
	hostId: string;
	periodFrom: string;
	periodTo: string;
	areaCode: string | null;
	tripIds: string[];
	maxTripUpdatedAt: string | null;
	bookingCountsByStatus: Record<string, number>;
	financialTotals: {
		grossRevenue: number;
		refundAmount: number;
		platformFee: number;
		netRevenue: number;
		postSettlementRefund: number;
	};
	formulaVersion: string;
	promptVersion: string;
}

export function resolveAnalyticsWindow(
	from?: string,
	to?: string,
	now: Date = new Date()
): { from: Date; to: Date } {
	if ((from && !to) || (!from && to)) {
		throw new BadRequestException({
			statusCode: 400,
			error: "INVALID_DATE_RANGE",
			message: "Cần truyền đầy đủ cả ngày bắt đầu và ngày kết thúc",
		});
	}

	if (from && to) {
		const fromDate = new Date(from);
		const toDate = new Date(to);
		if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
			throw new BadRequestException({
				statusCode: 400,
				error: "INVALID_DATE_RANGE",
				message: "Định dạng ngày không hợp lệ",
			});
		}
		if (fromDate.getTime() > toDate.getTime()) {
			throw new BadRequestException({
				statusCode: 400,
				error: "INVALID_DATE_RANGE",
				message: "Ngày bắt đầu không được lớn hơn ngày kết thúc",
			});
		}
		return { from: fromDate, to: toDate };
	}

	const toDate = new Date(now.getTime());
	const fromDate = new Date(now.getTime());
	fromDate.setUTCMonth(fromDate.getUTCMonth() - 12);
	return { from: fromDate, to: toDate };
}

export function monthKeyInVietnam(date: Date): string {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: HOST_ANALYTICS_TIMEZONE,
		year: "numeric",
		month: "2-digit",
	}).formatToParts(date);
	const year = parts.find((p) => p.type === "year")?.value ?? "1970";
	const month = parts.find((p) => p.type === "month")?.value ?? "01";
	return `${year}-${month}`;
}

export function vietnamDateKey(date: Date = new Date()): string {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: HOST_ANALYTICS_TIMEZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(date);
	const year = parts.find((p) => p.type === "year")?.value ?? "1970";
	const month = parts.find((p) => p.type === "month")?.value ?? "01";
	const day = parts.find((p) => p.type === "day")?.value ?? "01";
	return `${year}-${month}-${day}`;
}

export function addMonthsToKey(monthKey: string, delta: number): string {
	const [yStr, mStr] = monthKey.split("-");
	const totalMonths = Number(yStr) * 12 + (Number(mStr) - 1) + delta;
	const year = Math.floor(totalMonths / 12);
	const month = (totalMonths % 12) + 1;
	return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

export function inclusiveMonthSpan(startMonth: string, endMonth: string): number {
	const [sy, sm] = startMonth.split("-").map(Number);
	const [ey, em] = endMonth.split("-").map(Number);
	return (ey - sy) * 12 + (em - sm) + 1;
}

export function roundPercentage(numerator: number, denominator: number): number | null {
	if (denominator <= 0) return null;
	return Number(((numerator / denominator) * 100).toFixed(2));
}

export function roundToTenThousandVnd(value: number): number {
	if (!Number.isFinite(value) || value < 0) return 0;
	return Math.round(value / 10000) * 10000;
}

export function computeMedian(values: number[]): number | null {
	if (values.length === 0) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 1) {
		return sorted[mid];
	}
	return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function priceToBand(price: number | null): string | null {
	if (price === null || !Number.isFinite(price)) return null;
	if (price < 500_000) return "under_500k";
	if (price < 1_000_000) return "500k_1m";
	if (price < 2_000_000) return "1m_2m";
	return "over_2m";
}

export function capacityToBand(capacityMin: number | null): string | null {
	if (capacityMin === null || !Number.isFinite(capacityMin)) return null;
	if (capacityMin <= 6) return "small_1_6";
	if (capacityMin <= 12) return "medium_7_12";
	return "large_13_plus";
}

export function fillRateToBand(fillRate: number | null): "low" | "medium" | "high" | "unknown" {
	if (fillRate === null) return "unknown";
	if (fillRate >= 75) return "high";
	if (fillRate >= 45) return "medium";
	return "low";
}

export function buildOperationsMetrics(
	completedTrips: CompletedTripRow[],
	bookingsOnCompleted: BookingRow[],
	cancelledTripCount: number,
	bookingsOnCancelledTrips: number
): HostOperationsMetricsDto {
	const bookingsByTrip = new Map<string, BookingRow[]>();
	for (const booking of bookingsOnCompleted) {
		const list = bookingsByTrip.get(booking.tripId) ?? [];
		list.push(booking);
		bookingsByTrip.set(booking.tripId, list);
	}

	const excludedTrips: ExcludedTripDto[] = [];
	let totalCapacityMax = 0;
	let totalSeatsTaken = 0;
	let includedFillTripCount = 0;
	let totalGuestsSum = 0;
	let hasAnyGuestTrip = false;
	let totalBookingsAll = 0;
	let cancelledBookingsAll = 0;

	const byTrip: OperationsTripBreakdownDto[] = [];

	const routeAgg = new Map<
		string,
		{
			routeId: string;
			routeName: string;
			tripCount: number;
			guests: number;
			hasGuests: boolean;
			cap: number;
			seats: number;
			bookings: number;
			cancelled: number;
		}
	>();

	const areaAgg = new Map<
		string,
		{
			areaCode: string | null;
			areaName: string | null;
			tripCount: number;
			guests: number;
			hasGuests: boolean;
			cap: number;
			seats: number;
			bookings: number;
			cancelled: number;
		}
	>();

	const monthAgg = new Map<
		string,
		{
			month: string;
			tripCount: number;
			guests: number;
			hasGuests: boolean;
			cap: number;
			seats: number;
			bookings: number;
			cancelled: number;
		}
	>();

	for (const trip of completedTrips) {
		const tripBookings = bookingsByTrip.get(trip.id) ?? [];
		const activeBookings = tripBookings.filter(
			(b) => b.status === "confirmed" || b.status === "completed"
		);
		const cancelledCount = tripBookings.filter((b) => b.status === "cancelled").length;
		const bookingCount = tripBookings.length;

		totalBookingsAll += bookingCount;
		cancelledBookingsAll += cancelledCount;

		const hasValidCap = trip.capacityMax !== null && trip.capacityMax > 0;
		if (!hasValidCap) {
			excludedTrips.push({
				tripId: trip.id,
				title: trip.title,
				reason: "missing_capacity_max",
			});
		} else {
			includedFillTripCount += 1;
			totalCapacityMax += trip.capacityMax as number;
			totalSeatsTaken += trip.seatsTaken;
		}

		const hasMissingNumPeople = activeBookings.some((b) => b.numPeople === null);
		let tripGuests: number | null = null;
		if (hasMissingNumPeople) {
			excludedTrips.push({
				tripId: trip.id,
				title: trip.title,
				reason: "missing_num_people",
			});
		} else {
			tripGuests = activeBookings.reduce((sum, b) => sum + (b.numPeople ?? 0), 0);
			totalGuestsSum += tripGuests;
			hasAnyGuestTrip = true;
		}

		const tripFillRate = hasValidCap
			? roundPercentage(trip.seatsTaken, trip.capacityMax as number)
			: null;
		const tripCancelRate = roundPercentage(cancelledCount, bookingCount);

		byTrip.push({
			tripId: trip.id,
			title: trip.title,
			routeId: trip.routeId,
			routeName: trip.routeName,
			areaCode: trip.areaCode,
			areaName: trip.areaName,
			startsAt: trip.startsAt.toISOString(),
			capacityMax: trip.capacityMax,
			seatsTaken: trip.seatsTaken,
			totalGuests: tripGuests,
			fillRate: tripFillRate,
			bookingCount,
			cancelledBookingCount: cancelledCount,
			cancellationRate: tripCancelRate,
		});

		const rEntry = routeAgg.get(trip.routeId) ?? {
			routeId: trip.routeId,
			routeName: trip.routeName,
			tripCount: 0,
			guests: 0,
			hasGuests: false,
			cap: 0,
			seats: 0,
			bookings: 0,
			cancelled: 0,
		};
		rEntry.tripCount += 1;
		if (tripGuests !== null) {
			rEntry.guests += tripGuests;
			rEntry.hasGuests = true;
		}
		if (hasValidCap) {
			rEntry.cap += trip.capacityMax as number;
			rEntry.seats += trip.seatsTaken;
		}
		rEntry.bookings += bookingCount;
		rEntry.cancelled += cancelledCount;
		routeAgg.set(trip.routeId, rEntry);

		const areaKey = trip.areaCode ?? "__unknown__";
		const aEntry = areaAgg.get(areaKey) ?? {
			areaCode: trip.areaCode,
			areaName: trip.areaName,
			tripCount: 0,
			guests: 0,
			hasGuests: false,
			cap: 0,
			seats: 0,
			bookings: 0,
			cancelled: 0,
		};
		aEntry.tripCount += 1;
		if (tripGuests !== null) {
			aEntry.guests += tripGuests;
			aEntry.hasGuests = true;
		}
		if (hasValidCap) {
			aEntry.cap += trip.capacityMax as number;
			aEntry.seats += trip.seatsTaken;
		}
		aEntry.bookings += bookingCount;
		aEntry.cancelled += cancelledCount;
		areaAgg.set(areaKey, aEntry);

		const mKey = monthKeyInVietnam(trip.startsAt);
		const mEntry = monthAgg.get(mKey) ?? {
			month: mKey,
			tripCount: 0,
			guests: 0,
			hasGuests: false,
			cap: 0,
			seats: 0,
			bookings: 0,
			cancelled: 0,
		};
		mEntry.tripCount += 1;
		if (tripGuests !== null) {
			mEntry.guests += tripGuests;
			mEntry.hasGuests = true;
		}
		if (hasValidCap) {
			mEntry.cap += trip.capacityMax as number;
			mEntry.seats += trip.seatsTaken;
		}
		mEntry.bookings += bookingCount;
		mEntry.cancelled += cancelledCount;
		monthAgg.set(mKey, mEntry);
	}

	const byRoute: OperationsRouteBreakdownDto[] = [...routeAgg.values()].map((r) => ({
		routeId: r.routeId,
		routeName: r.routeName,
		tripCount: r.tripCount,
		totalGuests: r.hasGuests ? r.guests : null,
		fillRate: roundPercentage(r.seats, r.cap),
		cancellationRate: roundPercentage(r.cancelled, r.bookings),
	}));

	const byArea: OperationsAreaBreakdownDto[] = [...areaAgg.values()].map((a) => ({
		areaCode: a.areaCode,
		areaName: a.areaName,
		tripCount: a.tripCount,
		totalGuests: a.hasGuests ? a.guests : null,
		fillRate: roundPercentage(a.seats, a.cap),
		cancellationRate: roundPercentage(a.cancelled, a.bookings),
	}));

	const byDepartureMonth: OperationsMonthBreakdownDto[] = [...monthAgg.values()]
		.sort((a, b) => a.month.localeCompare(b.month))
		.map((m) => ({
			month: m.month,
			tripCount: m.tripCount,
			totalGuests: m.hasGuests ? m.guests : null,
			fillRate: roundPercentage(m.seats, m.cap),
			cancellationRate: roundPercentage(m.cancelled, m.bookings),
		}));

	return {
		totalGuests: hasAnyGuestTrip ? totalGuestsSum : null,
		fillRate: roundPercentage(totalSeatsTaken, totalCapacityMax),
		cancellationRate: roundPercentage(cancelledBookingsAll, totalBookingsAll),
		completedTripCount: completedTrips.length,
		includedFillTripCount,
		excludedTrips,
		cancelledTrips: {
			count: cancelledTripCount,
			tripCancellationRate: roundPercentage(
				cancelledTripCount,
				completedTrips.length + cancelledTripCount
			),
			bookingsOnCancelledTrips,
		},
		byTrip,
		byRoute,
		byArea,
		byDepartureMonth,
	};
}

export function buildLeadTime(bookings: BookingRow[]): HostLeadTimeDto {
	const days: number[] = [];
	for (const b of bookings) {
		if (b.status !== "confirmed" && b.status !== "completed") continue;
		if (!b.tripStartsAtSnapshot) continue;
		const diffDays = (b.tripStartsAtSnapshot.getTime() - b.createdAt.getTime()) / 86_400_000;
		if (Number.isFinite(diffDays) && diffDays >= 0) {
			days.push(diffDays);
		}
	}

	if (days.length === 0) {
		return { averageDays: null, medianDays: null, sampleSize: 0 };
	}

	const avg = days.reduce((s, d) => s + d, 0) / days.length;
	const med = computeMedian(days);

	return {
		averageDays: Number(avg.toFixed(2)),
		medianDays: med !== null ? Number(med.toFixed(2)) : null,
		sampleSize: days.length,
	};
}

export function buildSeasonality(
	allCompletedTrips: Array<{
		startsAt: Date;
		capacityMax: number | null;
		seatsTaken: number;
		guests: number;
	}>
): HostSeasonalityDto {
	if (allCompletedTrips.length === 0) {
		return {
			status: "insufficient_history",
			basis: "all_history",
			historySpanMonths: 0,
			trend: [],
			highestMonths: null,
			lowestMonths: null,
		};
	}

	const byMonth = new Map<
		string,
		{ tripCount: number; totalGuests: number; cap: number; seats: number }
	>();

	for (const t of allCompletedTrips) {
		const mKey = monthKeyInVietnam(t.startsAt);
		const entry = byMonth.get(mKey) ?? { tripCount: 0, totalGuests: 0, cap: 0, seats: 0 };
		entry.tripCount += 1;
		entry.totalGuests += t.guests;
		if (t.capacityMax !== null && t.capacityMax > 0) {
			entry.cap += t.capacityMax;
			entry.seats += t.seatsTaken;
		}
		byMonth.set(mKey, entry);
	}

	const sortedMonths = [...byMonth.keys()].sort();
	const firstMonth = sortedMonths[0];
	const lastMonth = sortedMonths[sortedMonths.length - 1];
	const historySpanMonths = inclusiveMonthSpan(firstMonth, lastMonth);
	const isSufficient = historySpanMonths >= SEASONALITY_MIN_SPAN_MONTHS;

	// Continuous series ending at the latest completed trip month:
	// 12 months when span >= 12, otherwise full span from firstMonth..lastMonth.
	const seriesStart = isSufficient ? addMonthsToKey(lastMonth, -11) : firstMonth;
	const seriesLength = isSufficient ? 12 : historySpanMonths;

	const trend: SeasonalityMonthPointDto[] = [];
	for (let i = 0; i < seriesLength; i += 1) {
		const mKey = addMonthsToKey(seriesStart, i);
		const data = byMonth.get(mKey);
		if (!data) {
			trend.push({
				month: mKey,
				tripCount: 0,
				totalGuests: 0,
				fillRate: null,
			});
		} else {
			trend.push({
				month: mKey,
				tripCount: data.tripCount,
				totalGuests: data.totalGuests,
				fillRate: roundPercentage(data.seats, data.cap),
			});
		}
	}

	if (!isSufficient) {
		return {
			status: "insufficient_history",
			basis: "all_history",
			historySpanMonths,
			trend,
			highestMonths: null,
			lowestMonths: null,
		};
	}

	const rankedHigh = [...trend].sort(
		(a, b) =>
			b.tripCount - a.tripCount || b.totalGuests - a.totalGuests || a.month.localeCompare(b.month)
	);
	const rankedLow = [...trend].sort(
		(a, b) =>
			a.tripCount - b.tripCount || a.totalGuests - b.totalGuests || a.month.localeCompare(b.month)
	);

	return {
		status: "ok",
		basis: "all_history",
		historySpanMonths,
		trend,
		highestMonths: rankedHigh.slice(0, 3).map((p) => p.month),
		lowestMonths: rankedLow.slice(0, 3).map((p) => p.month),
	};
}

export function computeSourceHash(input: SourceHashInput): string {
	const sortedBookingCounts: Record<string, number> = {};
	for (const key of Object.keys(input.bookingCountsByStatus).sort()) {
		sortedBookingCounts[key] = input.bookingCountsByStatus[key];
	}

	const canonical = JSON.stringify({
		hostId: input.hostId,
		periodFrom: input.periodFrom,
		periodTo: input.periodTo,
		areaCode: input.areaCode,
		tripIds: [...input.tripIds].sort(),
		maxTripUpdatedAt: input.maxTripUpdatedAt,
		bookingCountsByStatus: sortedBookingCounts,
		financialTotals: {
			grossRevenue: input.financialTotals.grossRevenue,
			refundAmount: input.financialTotals.refundAmount,
			platformFee: input.financialTotals.platformFee,
			netRevenue: input.financialTotals.netRevenue,
			postSettlementRefund: input.financialTotals.postSettlementRefund,
		},
		formulaVersion: input.formulaVersion,
		promptVersion: input.promptVersion,
	});

	return createHash("sha256").update(canonical).digest("hex");
}

export function buildAllowedFutureMonths(now: Date = new Date(), count = 6): string[] {
	const currentMonth = monthKeyInVietnam(now);
	const months: string[] = [];
	for (let i = 1; i <= count; i += 1) {
		months.push(addMonthsToKey(currentMonth, i));
	}
	return months;
}

export function buildRouteCandidates(
	activeRoutes: ActiveRouteWithAreaRow[],
	completedTrips: CompletedTripRow[],
	areaCodeFilter: string | null,
	now: Date = new Date()
): RouteCandidate[] {
	const tripsByRoute = new Map<string, CompletedTripRow[]>();
	const tripsByArea = new Map<string, CompletedTripRow[]>();

	for (const t of completedTrips) {
		const rList = tripsByRoute.get(t.routeId) ?? [];
		rList.push(t);
		tripsByRoute.set(t.routeId, rList);
		if (t.areaCode) {
			const aList = tripsByArea.get(t.areaCode) ?? [];
			aList.push(t);
			tripsByArea.set(t.areaCode, aList);
		}
	}

	// Filter routes according to areaCode rule:
	// Route without any trip has areaCode = null and cannot be a candidate when areaCodeFilter is set.
	const eligible = activeRoutes.filter((r) => {
		const validAreaCode = r.areaCode && r.areaActive ? r.areaCode : null;
		if (areaCodeFilter !== null) {
			return validAreaCode === areaCodeFilter;
		}
		return true;
	});

	// Rank routes by historical revenue proxy (seatsTaken * pricePerPerson) descending
	const scored = eligible.map((r) => {
		const rTrips = tripsByRoute.get(r.routeId) ?? [];
		const revenueProxy = rTrips.reduce((s, t) => s + t.seatsTaken * t.pricePerPerson, 0);
		return { route: r, rTrips, revenueProxy };
	});
	scored.sort(
		(a, b) =>
			b.revenueProxy - a.revenueProxy ||
			b.rTrips.length - a.rTrips.length ||
			a.route.routeId.localeCompare(b.route.routeId)
	);

	const allowedMonths = buildAllowedFutureMonths(now, 6);

	return scored.slice(0, 20).map((item, idx) => {
		const { route, rTrips } = item;
		const validAreaCode = route.areaCode && route.areaActive ? route.areaCode : null;
		const validAreaName = validAreaCode ? route.areaName : null;
		const aTrips = validAreaCode ? (tripsByArea.get(validAreaCode) ?? []) : [];

		// Dominant tripType from route history (default day_trip)
		const overnightCount = rTrips.filter((t) => t.tripType === "overnight").length;
		const tripType: "day_trip" | "overnight" =
			rTrips.length > 0 && overnightCount > rTrips.length / 2 ? "overnight" : "day_trip";

		const missingData: string[] = [];
		if (!validAreaCode) {
			missingData.push("area_history");
		}

		// Median price: route history -> host's same area history -> null
		const routePrices = rTrips.map((t) => t.pricePerPerson).filter((p) => p >= 0);
		const areaPrices = aTrips.map((t) => t.pricePerPerson).filter((p) => p >= 0);
		const rawPriceMedian = computeMedian(routePrices) ?? computeMedian(areaPrices);
		const suggestedPricePerPerson =
			rawPriceMedian !== null ? roundToTenThousandVnd(rawPriceMedian) : null;
		if (suggestedPricePerPerson === null) {
			missingData.push("price_history");
		}

		// Median capacity_min: route history -> host's same area history -> null
		const routeCaps = rTrips.map((t) => t.capacityMin).filter((c) => c >= 1);
		const areaCaps = aTrips.map((t) => t.capacityMin).filter((c) => c >= 1);
		const rawCapMedian = computeMedian(routeCaps) ?? computeMedian(areaCaps);
		const suggestedCapacityMin =
			rawCapMedian !== null ? Math.max(1, Math.round(rawCapMedian)) : null;
		if (suggestedCapacityMin === null) {
			missingData.push("capacity_history");
		}

		let capSum = 0;
		let seatsSum = 0;
		for (const t of rTrips) {
			if (t.capacityMax !== null && t.capacityMax > 0) {
				capSum += t.capacityMax;
				seatsSum += t.seatsTaken;
			}
		}
		const fillBand = fillRateToBand(roundPercentage(seatsSum, capSum));

		return {
			candidateId: `cand-${idx + 1}`,
			routeId: route.routeId,
			routeName: route.routeName,
			areaCode: validAreaCode,
			areaName: validAreaName,
			tripType,
			priceBand: priceToBand(suggestedPricePerPerson),
			capacityBand: capacityToBand(suggestedCapacityMin),
			suggestedPricePerPerson,
			suggestedCapacityMin,
			fillBand,
			revenueRank: idx + 1,
			allowedMonths,
			missingData,
		};
	});
}

export function validateAiPlanningSelection(
	candidates: RouteCandidate[],
	rawSelections: unknown
): AiPlanningSelectionItem[] {
	if (!Array.isArray(rawSelections)) return [];
	const byId = new Map(candidates.map((c) => [c.candidateId, c]));
	const allowedCodeSet = new Set<string>(ALLOWED_RATIONALE_CODES);
	const seenCandidates = new Set<string>();
	const valid: AiPlanningSelectionItem[] = [];

	for (const item of rawSelections) {
		if (!item || typeof item !== "object") continue;
		const rec = item as Record<string, unknown>;
		const candidateId = typeof rec.candidateId === "string" ? rec.candidateId : null;
		const monthHint = typeof rec.monthHint === "string" ? rec.monthHint : null;
		if (!candidateId || !monthHint) continue;
		if (seenCandidates.has(candidateId)) continue;

		const candidate = byId.get(candidateId);
		if (!candidate) continue;
		if (!candidate.allowedMonths.includes(monthHint)) continue;

		const rawCodes = Array.isArray(rec.rationaleCodes) ? rec.rationaleCodes : [];
		const rationaleCodes: HostAnalyticsRationaleCode[] = [];
		for (const code of rawCodes) {
			if (
				typeof code === "string" &&
				allowedCodeSet.has(code) &&
				!rationaleCodes.includes(code as HostAnalyticsRationaleCode)
			) {
				rationaleCodes.push(code as HostAnalyticsRationaleCode);
			}
		}
		if (rationaleCodes.length === 0) continue;

		seenCandidates.add(candidateId);
		valid.push({
			candidateId,
			monthHint,
			rationaleCodes: rationaleCodes.slice(0, 3),
		});
	}

	return valid;
}

export function mapRationaleLabels(codes: HostAnalyticsRationaleCode[]): string[] {
	return codes
		.filter((c): c is HostAnalyticsRationaleCode => c in RATIONALE_LABELS_VI)
		.map((c) => RATIONALE_LABELS_VI[c]);
}
