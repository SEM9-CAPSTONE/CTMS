import { ForbiddenException, Injectable, UnprocessableEntityException } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
// biome-ignore lint/style/useImportType: NestJS DI requires runtime metadata
import { RevenueAnalyticsService } from "../revenue-analytics/revenue-analytics.service";
import { UserRole } from "../users/entities/user.entity";
import type { GetHostAnalyticsQueryDto } from "./dto/get-host-analytics-query.dto";
import type { HostAnalyticsResponseDto } from "./dto/host-analytics-response.dto";
import {
	HOST_ANALYTICS_FORMULA_VERSION,
	HOST_ANALYTICS_TIMEZONE,
	SMALL_SAMPLE_MIN_BOOKINGS,
	SMALL_SAMPLE_MIN_TRIPS,
	buildLeadTime,
	buildOperationsMetrics,
	buildSeasonality,
	resolveAnalyticsWindow,
} from "./host-analytics.policy";
// biome-ignore lint/style/useImportType: NestJS DI requires runtime metadata
import { HostAnalyticsRepository } from "./host-analytics.repository";

@Injectable()
export class HostAnalyticsService {
	constructor(
		private readonly revenueAnalyticsService: RevenueAnalyticsService,
		private readonly repository: HostAnalyticsRepository
	) {}

	async getHostAnalytics(
		user: AuthenticatedUser,
		query: GetHostAnalyticsQueryDto,
		now: Date = new Date()
	): Promise<HostAnalyticsResponseDto> {
		if (!user.roles.includes(UserRole.HOST)) {
			throw new ForbiddenException({
				statusCode: 403,
				error: "FORBIDDEN",
				message: "Chỉ Chủ chuyến (Host) mới có quyền xem phân tích kinh doanh",
			});
		}

		const { from, to } = resolveAnalyticsWindow(query.from, query.to, now);
		const areaCode = query.areaCode?.trim() || undefined;

		if (areaCode) {
			const exists = await this.repository.areaExists(areaCode);
			if (!exists) {
				throw new UnprocessableEntityException({
					statusCode: 422,
					error: "INVALID_AREA_CODE",
					message: "Khu vực không tồn tại trong hệ thống",
				});
			}
		}

		// Pin strictly to Host role & current userId so CTMS-110 always scopes to this Host
		const hostOnlyUser: AuthenticatedUser = {
			userId: user.userId,
			roles: [UserRole.HOST],
			status: user.status,
		};

		const [financial, completedTrips, cancelledSummary, upcomingTrips, seasonalityTrips] =
			await Promise.all([
				this.revenueAnalyticsService.getRevenueAnalytics(hostOnlyUser, {
					from: from.toISOString(),
					to: to.toISOString(),
					areaCode,
				}),
				this.repository.getCompletedTripsInWindow(user.userId, from, to, areaCode),
				this.repository.getCancelledTripsSummary(user.userId, from, to, areaCode),
				this.repository.getUpcomingTrips(user.userId, areaCode, now),
				this.repository.getAllCompletedTripsForSeasonality(user.userId, areaCode),
			]);

		const bookingsOnCompleted = await this.repository.getBookingsForTrips(
			completedTrips.map((t) => t.id)
		);

		const operations = buildOperationsMetrics(
			completedTrips,
			bookingsOnCompleted,
			cancelledSummary.count,
			cancelledSummary.bookingsOnCancelledTrips
		);

		const leadTime = buildLeadTime(bookingsOnCompleted);
		const seasonality = buildSeasonality(seasonalityTrips);

		const upcomingCaps = upcomingTrips
			.map((t) => t.capacityMax)
			.filter((c): c is number => c !== null && c > 0);
		const upcomingTotalCapacityMax =
			upcomingCaps.length > 0 ? upcomingCaps.reduce((s, c) => s + c, 0) : null;
		const upcomingTotalSeatsTaken = upcomingTrips.reduce((s, t) => s + t.seatsTaken, 0);

		const analyzedTripCount = completedTrips.length;
		const totalBookingsInScope = bookingsOnCompleted.length;
		const smallSample =
			analyzedTripCount < SMALL_SAMPLE_MIN_TRIPS ||
			totalBookingsInScope < SMALL_SAMPLE_MIN_BOOKINGS;

		return {
			financial,
			operations,
			upcoming: {
				tripCount: upcomingTrips.length,
				totalCapacityMax: upcomingTotalCapacityMax,
				totalSeatsTaken: upcomingTotalSeatsTaken,
				includesHeldSeats: true,
				trips: upcomingTrips,
			},
			leadTime,
			seasonality,
			externalSeason: {
				status: "not_available",
			},
			profit: null,
			profitStatus: "insufficient_data",
			smallSample,
			dataBasis: {
				timezone: HOST_ANALYTICS_TIMEZONE,
				financialBasis:
					"payment_succeeded_at / settled_at / adjustment_created_at / payout_succeeded_at",
				operationsBasis: "trips.starts_at",
				period: {
					from: from.toISOString(),
					to: to.toISOString(),
				},
				analyzedTripCount,
				generatedAt: now.toISOString(),
				formulaVersion: HOST_ANALYTICS_FORMULA_VERSION,
			},
		};
	}
}
