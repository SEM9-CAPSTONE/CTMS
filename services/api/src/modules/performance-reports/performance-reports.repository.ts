import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { DataSource } from "typeorm";
import { BookingStatus } from "../profiles/entities/booking.entity";
import { TripStatus } from "../trips/entities/trip.entity";
import {
	type GetPerformanceReportQueryDto,
	ReportPeriodPreset,
} from "./dto/get-performance-report-query.dto";
import type {
	BookingMetricsDto,
	PerformanceReportResponseDto,
	PerformanceTrendPointDto,
	PerformanceTripBreakdownDto,
	RevenueBreakdownDto,
	TripMetricsDto,
} from "./dto/performance-report-response.dto";

export interface ResolvedTimeWindow {
	from: Date;
	to: Date;
	preset?: string;
}

export interface ReportUserScope {
	role: string;
	hostId?: string;
}

@Injectable()
export class PerformanceReportsRepository {
	constructor(private readonly dataSource: DataSource) {}

	resolveTimeWindow(query: GetPerformanceReportQueryDto): ResolvedTimeWindow {
		const now = new Date();

		if (query.from && query.to) {
			return {
				from: new Date(query.from),
				to: new Date(query.to),
				preset: undefined,
			};
		}

		const preset = query.period ?? ReportPeriodPreset.DAYS_30;
		switch (preset) {
			case ReportPeriodPreset.DAYS_7: {
				const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
				return { from, to: now, preset };
			}
			case ReportPeriodPreset.DAYS_30: {
				const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
				return { from, to: now, preset };
			}
			case ReportPeriodPreset.DAYS_90: {
				const from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
				return { from, to: now, preset };
			}
			case ReportPeriodPreset.MONTHS_12: {
				const from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
				return { from, to: now, preset };
			}
			case ReportPeriodPreset.THIS_MONTH: {
				const from = new Date(now.getFullYear(), now.getMonth(), 1);
				return { from, to: now, preset };
			}
			case ReportPeriodPreset.LAST_MONTH: {
				const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
				const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
				return { from, to, preset };
			}
			default: {
				const from = new Date(2020, 0, 1);
				return { from, to: now, preset };
			}
		}
	}

	async generateReport(
		query: GetPerformanceReportQueryDto,
		scope: ReportUserScope
	): Promise<PerformanceReportResponseDto> {
		const window = this.resolveTimeWindow(query);

		// Build WHERE criteria for trips
		const tripConditions: string[] = ["trip.created_at >= $1 AND trip.created_at <= $2"];
		const tripParams: unknown[] = [window.from.toISOString(), window.to.toISOString()];

		if (scope.hostId) {
			tripParams.push(scope.hostId);
			tripConditions.push(`trip.host_id = $${tripParams.length}`);
		}

		if (query.routeId) {
			tripParams.push(query.routeId);
			tripConditions.push(`trip.route_id = $${tripParams.length}`);
		}

		if (query.tripId) {
			tripParams.push(query.tripId);
			tripConditions.push(`trip.id = $${tripParams.length}`);
		}

		if (query.province) {
			tripParams.push(`%${query.province}%`);
			tripConditions.push(
				`(trip.title ILIKE $${tripParams.length} OR trip.description ILIKE $${tripParams.length})`
			);
		}

		if (query.city) {
			tripParams.push(`%${query.city}%`);
			tripConditions.push(
				`(trip.title ILIKE $${tripParams.length} OR trip.description ILIKE $${tripParams.length})`
			);
		}

		const tripWhereClause = `WHERE ${tripConditions.join(" AND ")}`;

		// 1. Query Trips metrics & list
		const tripsRaw = await this.dataSource.query(
			`SELECT 
				trip.id,
				trip.title,
				trip.status,
				trip.capacity_min,
				trip.capacity_max,
				trip.seats_taken,
				trip.created_at,
				r.name as route_name
			 FROM trips trip
			 LEFT JOIN trekking_routes r ON r.id = trip.route_id
			 ${tripWhereClause}
			 ORDER BY trip.created_at DESC`,
			tripParams
		);

		const tripsMetrics: TripMetricsDto = {
			total: tripsRaw.length,
			completed: tripsRaw.filter((t: { status: string }) => t.status === TripStatus.COMPLETED)
				.length,
			ongoing: tripsRaw.filter((t: { status: string }) => t.status === TripStatus.ONGOING).length,
			published: tripsRaw.filter((t: { status: string }) => t.status === TripStatus.PUBLISHED)
				.length,
			cancelled: tripsRaw.filter((t: { status: string }) => t.status === TripStatus.CANCELLED)
				.length,
		};

		// 2. Query Bookings metrics associated with these trips and time window
		const bookingConditions: string[] = ["b.created_at >= $1 AND b.created_at <= $2"];
		const bookingParams: unknown[] = [window.from.toISOString(), window.to.toISOString()];

		if (scope.hostId) {
			bookingParams.push(scope.hostId);
			bookingConditions.push(`t.host_id = $${bookingParams.length}`);
		}

		if (query.routeId) {
			bookingParams.push(query.routeId);
			bookingConditions.push(`t.route_id = $${bookingParams.length}`);
		}

		if (query.tripId) {
			bookingParams.push(query.tripId);
			bookingConditions.push(`b.trip_id = $${bookingParams.length}`);
		}

		if (query.province) {
			bookingParams.push(`%${query.province}%`);
			bookingConditions.push(
				`(t.title ILIKE $${bookingParams.length} OR t.description ILIKE $${bookingParams.length})`
			);
		}

		if (query.city) {
			bookingParams.push(`%${query.city}%`);
			bookingConditions.push(
				`(t.title ILIKE $${bookingParams.length} OR t.description ILIKE $${bookingParams.length})`
			);
		}

		const bookingsRaw = await this.dataSource.query(
			`SELECT 
				b.id,
				b.trip_id,
				b.status,
				b.num_people,
				b.total_amount,
				b.created_at
			 FROM bookings b
			 JOIN trips t ON t.id = b.trip_id
			 WHERE ${bookingConditions.join(" AND ")}
			 ORDER BY b.created_at ASC`,
			bookingParams
		);

		const bookingMetrics: BookingMetricsDto = {
			total: bookingsRaw.length,
			confirmed: bookingsRaw.filter((b: { status: string }) => b.status === BookingStatus.CONFIRMED)
				.length,
			completed: bookingsRaw.filter((b: { status: string }) => b.status === BookingStatus.COMPLETED)
				.length,
			cancelled: bookingsRaw.filter((b: { status: string }) => b.status === BookingStatus.CANCELLED)
				.length,
			pending: bookingsRaw.filter(
				(b: { status: string }) => b.status === BookingStatus.PENDING_PAYMENT
			).length,
		};

		// 3. Compute Fill Rate (PB AC-4) and Cancellation Rate (PB AC-5)
		let totalCapacity = 0;
		let totalSeatsTaken = 0;
		for (const t of tripsRaw) {
			const cap = Number(t.capacity_max ?? t.capacity_min ?? 0);
			totalCapacity += cap;
			totalSeatsTaken += Number(t.seats_taken ?? 0);
		}

		const fillRate =
			totalCapacity > 0 ? Number(((totalSeatsTaken / totalCapacity) * 100).toFixed(2)) : 0;

		const cancellationRate =
			bookingMetrics.total > 0
				? Number(((bookingMetrics.cancelled / bookingMetrics.total) * 100).toFixed(2))
				: 0;

		// 4. Query Actual Revenue from authoritative financial settlements ledger (PB AC-8, BR-283)
		const settlementConditions: string[] = ["s.settled_at >= $1 AND s.settled_at <= $2"];
		const settlementParams: unknown[] = [window.from.toISOString(), window.to.toISOString()];

		if (scope.hostId) {
			settlementParams.push(scope.hostId);
			settlementConditions.push(`s.host_id = $${settlementParams.length}`);
		}

		if (query.tripId) {
			settlementParams.push(query.tripId);
			settlementConditions.push(`s.trip_id = $${settlementParams.length}`);
		}

		if (query.routeId) {
			settlementParams.push(query.routeId);
			settlementConditions.push(`t.route_id = $${settlementParams.length}`);
		}

		const settlementsRaw = await this.dataSource.query(
			`SELECT 
				s.trip_id,
				s.settlement_base,
				s.platform_fee,
				s.net_amount,
				s.settled_at
			 FROM settlements s
			 JOIN trips t ON t.id = s.trip_id
			 WHERE ${settlementConditions.join(" AND ")}`,
			settlementParams
		);

		let actualRevenueTotal = 0;
		let actualPlatformFeeTotal = 0;
		let actualGmvTotal = 0;
		for (const s of settlementsRaw) {
			const gmv = Number(s.settlement_base ?? 0);
			const fee = Number(s.platform_fee ?? 0);
			const net = Number(s.net_amount ?? 0);
			actualGmvTotal += gmv;
			actualPlatformFeeTotal += fee;
			actualRevenueTotal += scope.role === "host" ? net : gmv;
		}

		// Track settled trips to calculate escrow/unsettled vs settled
		const settledTripIds = new Set(settlementsRaw.map((s: { trip_id: string }) => s.trip_id));

		// 5. Estimated Revenue from active bookings (PB AC-7, BR-283)
		let estimatedRevenueTotal = 0;
		let escrowGmvTotal = 0;
		for (const b of bookingsRaw) {
			if (b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.COMPLETED) {
				const bAmt = Number(b.total_amount ?? 0);
				estimatedRevenueTotal += scope.role === "host" ? bAmt * 0.95 : bAmt;
				if (!settledTripIds.has(b.trip_id)) {
					escrowGmvTotal += bAmt;
				}
			}
		}

		const gmvEstimated = escrowGmvTotal;
		const estimatedPlatformFeeTotal = Math.round(gmvEstimated * 0.05);

		const revenue: RevenueBreakdownDto = {
			estimated: {
				amount: Math.round(estimatedRevenueTotal),
				label: "Estimated",
				isEstimated: true,
			},
			actual: {
				amount: Math.round(actualRevenueTotal),
				label: "Actual",
				isEstimated: false,
				ledgerSource: "settlements",
			},
			platformFeeActual: Math.round(actualPlatformFeeTotal),
			platformFeeEstimated: estimatedPlatformFeeTotal,
			gmvActual: Math.round(actualGmvTotal),
			gmvEstimated: Math.round(gmvEstimated),
		};

		// 6. Build TimeSeries aggregation for charts
		const dateMap = new Map<
			string,
			{
				bookingCount: number;
				tripCount: number;
				seatsTaken: number;
				capacity: number;
				cancelledBookings: number;
				estimatedRevenue: number;
				actualRevenue: number;
			}
		>();

		for (const t of tripsRaw) {
			const dStr = new Date(t.created_at).toISOString().split("T")[0];
			const current = dateMap.get(dStr) ?? {
				bookingCount: 0,
				tripCount: 0,
				seatsTaken: 0,
				capacity: 0,
				cancelledBookings: 0,
				estimatedRevenue: 0,
				actualRevenue: 0,
			};
			current.tripCount += 1;
			current.seatsTaken += Number(t.seats_taken ?? 0);
			current.capacity += Number(t.capacity_max ?? t.capacity_min ?? 0);
			dateMap.set(dStr, current);
		}

		for (const b of bookingsRaw) {
			const dStr = new Date(b.created_at).toISOString().split("T")[0];
			const current = dateMap.get(dStr) ?? {
				bookingCount: 0,
				tripCount: 0,
				seatsTaken: 0,
				capacity: 0,
				cancelledBookings: 0,
				estimatedRevenue: 0,
				actualRevenue: 0,
			};
			current.bookingCount += 1;
			if (b.status === BookingStatus.CANCELLED) {
				current.cancelledBookings += 1;
			}
			if (b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.COMPLETED) {
				current.estimatedRevenue += Number(b.total_amount ?? 0);
			}
			dateMap.set(dStr, current);
		}

		for (const s of settlementsRaw) {
			const dStr = new Date(s.settled_at).toISOString().split("T")[0];
			const current = dateMap.get(dStr) ?? {
				bookingCount: 0,
				tripCount: 0,
				seatsTaken: 0,
				capacity: 0,
				cancelledBookings: 0,
				estimatedRevenue: 0,
				actualRevenue: 0,
			};
			const amt =
				scope.role === "host" ? Number(s.net_amount ?? 0) : Number(s.settlement_base ?? 0);
			current.actualRevenue += amt;
			dateMap.set(dStr, current);
		}

		const sortedDates = Array.from(dateMap.keys()).sort();
		const timeSeries: PerformanceTrendPointDto[] = sortedDates.map((date) => {
			const data = dateMap.get(date) ?? {
				bookingCount: 0,
				tripCount: 0,
				seatsTaken: 0,
				capacity: 0,
				cancelledBookings: 0,
				estimatedRevenue: 0,
				actualRevenue: 0,
			};
			const dayFillRate =
				data.capacity > 0 ? Number(((data.seatsTaken / data.capacity) * 100).toFixed(1)) : 0;
			const dayCancelRate =
				data.bookingCount > 0
					? Number(((data.cancelledBookings / data.bookingCount) * 100).toFixed(1))
					: 0;

			return {
				date,
				bookingCount: data.bookingCount,
				tripCount: data.tripCount,
				fillRate: dayFillRate,
				cancellationRate: dayCancelRate,
				estimatedRevenue: Math.round(data.estimatedRevenue),
				actualRevenue: Math.round(data.actualRevenue),
			};
		});

		// 7. Build Trip Breakdown list
		const tripBookingsMap = new Map<
			string,
			{ total: number; cancelled: number; estimatedRevenue: number }
		>();
		for (const b of bookingsRaw) {
			const tId = b.trip_id;
			const cur = tripBookingsMap.get(tId) ?? { total: 0, cancelled: 0, estimatedRevenue: 0 };
			cur.total += 1;
			if (b.status === BookingStatus.CANCELLED) cur.cancelled += 1;
			if (b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.COMPLETED) {
				cur.estimatedRevenue += Number(b.total_amount ?? 0);
			}
			tripBookingsMap.set(tId, cur);
		}

		const tripSettlementMap = new Map<string, number>();
		for (const s of settlementsRaw) {
			const amt =
				scope.role === "host" ? Number(s.net_amount ?? 0) : Number(s.settlement_base ?? 0);
			tripSettlementMap.set(s.trip_id, (tripSettlementMap.get(s.trip_id) ?? 0) + amt);
		}

		const breakdown: PerformanceTripBreakdownDto[] = tripsRaw.map(
			(t: {
				id: string;
				title: string;
				route_name: string | null;
				status: string;
				capacity_min: number;
				capacity_max: number | null;
				seats_taken: number;
			}) => {
				const cap = Number(t.capacity_max ?? t.capacity_min ?? 0);
				const taken = Number(t.seats_taken ?? 0);
				const tFill = cap > 0 ? Number(((taken / cap) * 100).toFixed(1)) : 0;
				const bInfo = tripBookingsMap.get(t.id) ?? { total: 0, cancelled: 0, estimatedRevenue: 0 };
				const tCancel =
					bInfo.total > 0 ? Number(((bInfo.cancelled / bInfo.total) * 100).toFixed(1)) : 0;
				const actualRev = tripSettlementMap.get(t.id) ?? 0;

				return {
					id: t.id,
					title: t.title,
					routeName: t.route_name ?? undefined,
					status: t.status,
					bookingCount: bInfo.total,
					seatsTaken: taken,
					capacity: cap,
					fillRate: tFill,
					cancellationRate: tCancel,
					estimatedRevenue: Math.round(bInfo.estimatedRevenue),
					actualRevenue: Math.round(actualRev),
				};
			}
		);

		return {
			timeWindow: {
				from: window.from.toISOString(),
				to: window.to.toISOString(),
				preset: window.preset,
			},
			scope: {
				role: scope.role,
				hostId: scope.hostId,
			},
			bookings: bookingMetrics,
			trips: tripsMetrics,
			fillRate,
			cancellationRate,
			revenue,
			timeSeries,
			breakdown,
		};
	}
}
