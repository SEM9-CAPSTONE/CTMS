import { ForbiddenException, UnprocessableEntityException } from "@nestjs/common";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import { HostAnalyticsService } from "./host-analytics.service";

describe("HostAnalyticsService", () => {
	const hostUser = {
		userId: "host-a",
		roles: [UserRole.HOST],
		status: UserStatus.ACTIVE,
	};

	const mockFinancial = {
		currency: "VND" as const,
		timeWindow: { from: "2025-11-20T00:00:00.000Z", to: "2026-11-20T00:00:00.000Z" },
		granularity: "month" as const,
		scope: { role: "host" as const, hostId: "host-a", areaCode: "DNG-SON-TRA" },
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
			grossRevenue: 5000000,
			refundAmount: 0,
			platformFee: 250000,
			netRevenue: 4750000,
			postSettlementRefund: 0,
			payout: null,
			heldFunds: 0,
			pendingPayout: null,
			pendingRefundAmount: 0,
			pendingRefundCount: 0,
		},
		payoutAreaScoped: false,
		timeSeries: [],
		byArea: [],
		byTrip: [],
	};

	function createService() {
		const revenueService = {
			getRevenueAnalytics: jest.fn().mockResolvedValue(mockFinancial),
		};
		const repo = {
			areaExists: jest.fn().mockResolvedValue(true),
			getCompletedTripsInWindow: jest.fn().mockResolvedValue([]),
			getCancelledTripsSummary: jest
				.fn()
				.mockResolvedValue({ count: 0, bookingsOnCancelledTrips: 0 }),
			getUpcomingTrips: jest.fn().mockResolvedValue([]),
			getAllCompletedTripsForSeasonality: jest.fn().mockResolvedValue([]),
			getBookingsForTrips: jest.fn().mockResolvedValue([]),
		};
		const service = new HostAnalyticsService(revenueService as never, repo as never);
		return { service, revenueService, repo };
	}

	it("rejects non-host callers with 403", async () => {
		const { service } = createService();
		await expect(
			service.getHostAnalytics(
				{ userId: "camper-1", roles: [UserRole.CAMPER], status: UserStatus.ACTIVE },
				{}
			)
		).rejects.toBeInstanceOf(ForbiddenException);
	});

	it("rejects unknown areaCode with 422", async () => {
		const { service, repo } = createService();
		repo.areaExists.mockResolvedValue(false);
		await expect(
			service.getHostAnalytics(hostUser, { areaCode: "INVALID-AREA" })
		).rejects.toBeInstanceOf(UnprocessableEntityException);
	});

	it("preserves payout=null when areaCode is set, returns profit=null and externalSeason=not_available, and pins Host scope", async () => {
		const { service, revenueService } = createService();
		const res = await service.getHostAnalytics(
			{
				userId: "host-a",
				roles: [UserRole.HOST, UserRole.ADMIN],
				status: UserStatus.ACTIVE,
			},
			{
				from: "2025-11-20T00:00:00.000Z",
				to: "2026-11-20T00:00:00.000Z",
				areaCode: "DNG-SON-TRA",
			},
			new Date("2026-11-20T00:00:00.000Z")
		);

		expect(revenueService.getRevenueAnalytics).toHaveBeenCalledWith(
			expect.objectContaining({ userId: "host-a", roles: [UserRole.HOST] }),
			expect.objectContaining({ areaCode: "DNG-SON-TRA" })
		);
		expect(res.financial.kpis.payout).toBeNull();
		expect(res.financial.kpis.pendingPayout).toBeNull();
		expect(res.profit).toBeNull();
		expect(res.profitStatus).toBe("insufficient_data");
		expect(res.externalSeason).toEqual({ status: "not_available" });
		expect(res.smallSample).toBe(true);
		expect(res.upcoming.includesHeldSeats).toBe(true);
	});
});
