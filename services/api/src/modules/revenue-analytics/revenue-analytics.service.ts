import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { ReportPeriodPreset } from "../performance-reports/dto/get-performance-report-query.dto";
import {
	type ResolvedTimeWindow,
	resolveReportTimeWindow,
} from "../performance-reports/report-time-window";
import { UserRole } from "../users/entities/user.entity";
import {
	type GetRevenueAnalyticsQueryDto,
	RevenueGranularity,
} from "./dto/get-revenue-analytics-query.dto";
import {
	REVENUE_REPORTING_CURRENCY,
	type RevenueAnalyticsResponseDto,
	type RevenueAreaBreakdownDto,
	type RevenueScopeDto,
	type RevenueTimeSeriesPointDto,
	type RevenueTripBreakdownDto,
} from "./dto/revenue-analytics-response.dto";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { RevenueAnalyticsRepository, type RevenueScope } from "./revenue-analytics.repository";
import { minorToAmount, sumToMinor } from "./revenue-money";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAY_BUCKET_SPAN_DAYS = 92;
const MAX_WEEK_BUCKET_SPAN_DAYS = 730;

interface MinorTotals {
	grossRevenue: bigint;
	refundAmount: bigint;
	platformFee: bigint;
	settledNet: bigint;
	postSettlementRefund: bigint;
}

interface TripAccumulator extends MinorTotals {
	bookingCount: number;
	heldFunds: bigint;
}

function emptyTotals(): MinorTotals {
	return {
		grossRevenue: 0n,
		refundAmount: 0n,
		platformFee: 0n,
		settledNet: 0n,
		postSettlementRefund: 0n,
	};
}

/** Picks the requested bucket size, coarsening it when the window would produce too many bars. */
export function effectiveGranularity(
	requested: RevenueGranularity | undefined,
	window: ResolvedTimeWindow
): RevenueGranularity {
	const spanDays = (window.to.getTime() - window.from.getTime()) / DAY_MS;
	const wanted = requested ?? RevenueGranularity.MONTH;
	if (wanted === RevenueGranularity.DAY && spanDays > MAX_DAY_BUCKET_SPAN_DAYS) {
		return spanDays > MAX_WEEK_BUCKET_SPAN_DAYS
			? RevenueGranularity.MONTH
			: RevenueGranularity.WEEK;
	}
	if (wanted === RevenueGranularity.WEEK && spanDays > MAX_WEEK_BUCKET_SPAN_DAYS) {
		return RevenueGranularity.MONTH;
	}
	return wanted;
}

@Injectable()
export class RevenueAnalyticsService {
	constructor(private readonly repository: RevenueAnalyticsRepository) {}

	async getRevenueAnalytics(
		user: AuthenticatedUser,
		query: GetRevenueAnalyticsQueryDto
	): Promise<RevenueAnalyticsResponseDto> {
		const isAdmin = user.roles.includes(UserRole.ADMIN);
		const isHost = user.roles.includes(UserRole.HOST);
		if (!isAdmin && !isHost) {
			throw new ForbiddenException({
				statusCode: 403,
				error: "FORBIDDEN",
				message: "Bạn không có quyền xem báo cáo doanh thu",
			});
		}

		if ((query.from && !query.to) || (!query.from && query.to)) {
			throw new BadRequestException({
				statusCode: 400,
				error: "INVALID_DATE_RANGE",
				message: "Cần chọn cả ngày bắt đầu và ngày kết thúc",
			});
		}
		if (query.from && query.to && new Date(query.from).getTime() > new Date(query.to).getTime()) {
			throw new BadRequestException({
				statusCode: 400,
				error: "INVALID_DATE_RANGE",
				message: "Ngày bắt đầu không được lớn hơn ngày kết thúc",
			});
		}

		// BR-318. A Host is always pinned to their own data; any hostId they send is ignored.
		const hostId = isAdmin ? query.hostId : user.userId;
		const scope: RevenueScope = { hostId, areaCode: query.areaCode };
		const window = resolveReportTimeWindow(query);
		const granularity = effectiveGranularity(query.granularity, window);
		const payoutAreaScoped = !query.areaCode;

		const [
			buckets,
			payments,
			settlements,
			adjustments,
			held,
			pendingRefunds,
			payouts,
			pendingPayout,
		] = await Promise.all([
			this.repository.listBuckets(window, granularity),
			this.repository.sumSucceededPayments(window, scope, granularity),
			this.repository.listSettlements(window, scope, granularity),
			this.repository.sumPostSettlementRefunds(window, scope, granularity),
			this.repository.listHeldFunds(scope),
			this.repository.sumPendingRefunds(scope),
			payoutAreaScoped
				? this.repository.sumSucceededPayouts(window, hostId, granularity)
				: Promise.resolve([]),
			payoutAreaScoped ? this.repository.sumPendingPayouts(hostId) : Promise.resolve(null),
		]);

		const series = new Map<string, MinorTotals & { payout: bigint }>();
		const seriesAt = (bucket: string) => {
			let point = series.get(bucket);
			if (!point) {
				point = { ...emptyTotals(), payout: 0n };
				series.set(bucket, point);
			}
			return point;
		};
		const trips = new Map<string, TripAccumulator>();
		const tripAt = (tripId: string) => {
			let trip = trips.get(tripId);
			if (!trip) {
				trip = { ...emptyTotals(), bookingCount: 0, heldFunds: 0n };
				trips.set(tripId, trip);
			}
			return trip;
		};

		for (const row of payments) {
			const amount = sumToMinor(row.amount);
			const trip = tripAt(row.tripId);
			const point = seriesAt(row.bucket);
			if (row.type === "charge") {
				trip.grossRevenue += amount;
				trip.bookingCount += Number(row.bookingCount);
				point.grossRevenue += amount;
			} else {
				trip.refundAmount += amount;
				point.refundAmount += amount;
			}
		}
		for (const row of settlements) {
			const fee = sumToMinor(row.platformFee);
			const net = sumToMinor(row.netAmount);
			const trip = tripAt(row.tripId);
			const point = seriesAt(row.bucket);
			trip.platformFee += fee;
			trip.settledNet += net;
			point.platformFee += fee;
			point.settledNet += net;
		}
		for (const row of adjustments) {
			const amount = sumToMinor(row.amount);
			tripAt(row.tripId).postSettlementRefund += amount;
			seriesAt(row.bucket).postSettlementRefund += amount;
		}
		for (const row of held) {
			tripAt(row.tripId).heldFunds += sumToMinor(row.amount);
		}
		let payoutTotal = 0n;
		for (const row of payouts) {
			const amount = sumToMinor(row.amount);
			payoutTotal += amount;
			seriesAt(row.bucket).payout += amount;
		}

		const tripMeta = await this.repository.findTrips([...trips.keys()]);
		const metaById = new Map(tripMeta.map((row) => [row.id, row]));

		const totals = emptyTotals();
		let heldTotal = 0n;
		const byTrip: RevenueTripBreakdownDto[] = [];
		const areas = new Map<
			string,
			{ code: string | null; name: string | null; trip: TripAccumulator; tripCount: number }
		>();

		for (const [tripId, trip] of trips) {
			const meta = metaById.get(tripId);
			totals.grossRevenue += trip.grossRevenue;
			totals.refundAmount += trip.refundAmount;
			totals.platformFee += trip.platformFee;
			totals.settledNet += trip.settledNet;
			totals.postSettlementRefund += trip.postSettlementRefund;
			heldTotal += trip.heldFunds;

			byTrip.push({
				tripId,
				title: meta?.title ?? "",
				startsAt: meta ? new Date(meta.startsAt).toISOString() : "",
				areaName: meta?.areaName ?? null,
				bookingCount: trip.bookingCount,
				grossRevenue: minorToAmount(trip.grossRevenue),
				refundAmount: minorToAmount(trip.refundAmount),
				platformFee: minorToAmount(trip.platformFee),
				netRevenue: minorToAmount(trip.settledNet - trip.postSettlementRefund),
				heldFunds: minorToAmount(trip.heldFunds),
				settledAt: meta?.settledAt ? new Date(meta.settledAt).toISOString() : null,
			});

			const areaKey = meta?.areaCode ?? "";
			let area = areas.get(areaKey);
			if (!area) {
				area = {
					code: meta?.areaCode ?? null,
					name: meta?.areaName ?? null,
					trip: { ...emptyTotals(), bookingCount: 0, heldFunds: 0n },
					tripCount: 0,
				};
				areas.set(areaKey, area);
			}
			area.tripCount += 1;
			area.trip.grossRevenue += trip.grossRevenue;
			area.trip.refundAmount += trip.refundAmount;
			area.trip.platformFee += trip.platformFee;
			area.trip.settledNet += trip.settledNet;
			area.trip.postSettlementRefund += trip.postSettlementRefund;
			area.trip.heldFunds += trip.heldFunds;
		}

		byTrip.sort((a, b) => b.grossRevenue - a.grossRevenue || a.startsAt.localeCompare(b.startsAt));

		const byArea: RevenueAreaBreakdownDto[] = [...areas.values()]
			.map((area) => ({
				areaCode: area.code,
				areaName: area.name,
				tripCount: area.tripCount,
				grossRevenue: minorToAmount(area.trip.grossRevenue),
				refundAmount: minorToAmount(area.trip.refundAmount),
				platformFee: minorToAmount(area.trip.platformFee),
				netRevenue: minorToAmount(area.trip.settledNet - area.trip.postSettlementRefund),
				heldFunds: minorToAmount(area.trip.heldFunds),
				grossShare:
					totals.grossRevenue > 0n
						? Number((area.trip.grossRevenue * 10000n) / totals.grossRevenue) / 100
						: 0,
			}))
			.sort((a, b) => b.grossRevenue - a.grossRevenue || b.netRevenue - a.netRevenue);

		let bucketKeys = buckets;
		if (query.period === ReportPeriodPreset.ALL_TIME && !query.from) {
			// "All time" starts in 2020; drop the empty months before the first ledger entry.
			const firstActive = bucketKeys.findIndex((bucket) => series.has(bucket));
			bucketKeys = firstActive === -1 ? bucketKeys.slice(-1) : bucketKeys.slice(firstActive);
		}
		const timeSeries: RevenueTimeSeriesPointDto[] = bucketKeys.map((bucket) => {
			const point = series.get(bucket) ?? { ...emptyTotals(), payout: 0n };
			return {
				bucket,
				grossRevenue: minorToAmount(point.grossRevenue),
				refundAmount: minorToAmount(point.refundAmount),
				platformFee: minorToAmount(point.platformFee),
				netRevenue: minorToAmount(point.settledNet - point.postSettlementRefund),
				payout: payoutAreaScoped ? minorToAmount(point.payout) : null,
			};
		});

		const responseScope: RevenueScopeDto = {
			role: isAdmin ? "admin" : "host",
			...(hostId ? { hostId } : {}),
			...(query.areaCode ? { areaCode: query.areaCode } : {}),
		};

		return {
			currency: REVENUE_REPORTING_CURRENCY,
			timeWindow: {
				from: window.from.toISOString(),
				to: window.to.toISOString(),
				preset: window.preset,
			},
			granularity,
			scope: responseScope,
			dateBasis: {
				grossRevenue: "payment_succeeded_at",
				refundAmount: "refund_succeeded_at",
				platformFee: "settled_at",
				netRevenue: "settled_at",
				postSettlementRefund: "adjustment_created_at",
				payout: "payout_succeeded_at",
				heldFunds: "current_balance",
			},
			kpis: {
				grossRevenue: minorToAmount(totals.grossRevenue),
				refundAmount: minorToAmount(totals.refundAmount),
				platformFee: minorToAmount(totals.platformFee),
				netRevenue: minorToAmount(totals.settledNet - totals.postSettlementRefund),
				postSettlementRefund: minorToAmount(totals.postSettlementRefund),
				payout: payoutAreaScoped ? minorToAmount(payoutTotal) : null,
				heldFunds: minorToAmount(heldTotal),
				pendingPayout: payoutAreaScoped ? minorToAmount(sumToMinor(pendingPayout)) : null,
				pendingRefundAmount: minorToAmount(sumToMinor(pendingRefunds.amount)),
				pendingRefundCount: Number(pendingRefunds.count ?? 0),
			},
			payoutAreaScoped,
			timeSeries,
			byArea,
			byTrip,
			...(isAdmin ? { hosts: await this.repository.listHosts() } : {}),
		};
	}
}
