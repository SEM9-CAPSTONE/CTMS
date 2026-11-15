import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { ReportPeriodPreset } from "../performance-reports/dto/get-performance-report-query.dto";
import { RevenueGranularity } from "./dto/get-revenue-analytics-query.dto";
import type { RevenueAnalyticsRepository } from "./revenue-analytics.repository";
import { RevenueAnalyticsService, effectiveGranularity } from "./revenue-analytics.service";
import { minorToAmount, sumToMinor } from "./revenue-money";

const HOST_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_HOST_ID = "22222222-2222-4222-8222-222222222222";
const TRIP_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TRIP_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function user(roles: string[], userId = HOST_ID): AuthenticatedUser {
	return { userId, roles, status: "active" } as AuthenticatedUser;
}

function buildRepository(): jest.Mocked<RevenueAnalyticsRepository> {
	return {
		listBuckets: jest.fn().mockResolvedValue(["2026-10-01", "2026-11-01"]),
		sumSucceededPayments: jest.fn().mockResolvedValue([
			{
				tripId: TRIP_A,
				type: "charge",
				bucket: "2026-10-01",
				amount: "4000000.00",
				bookingCount: 2,
			},
			{
				tripId: TRIP_A,
				type: "refund",
				bucket: "2026-10-01",
				amount: "500000.00",
				bookingCount: 1,
			},
			{
				tripId: TRIP_B,
				type: "charge",
				bucket: "2026-11-01",
				amount: "1000000.00",
				bookingCount: 1,
			},
		]),
		listSettlements: jest.fn().mockResolvedValue([
			{
				tripId: TRIP_A,
				bucket: "2026-11-01",
				platformFee: "175000.00",
				netAmount: "3325000.00",
				settledAt: new Date("2026-11-02T03:00:00Z"),
			},
		]),
		sumPostSettlementRefunds: jest
			.fn()
			.mockResolvedValue([{ tripId: TRIP_A, bucket: "2026-11-01", amount: "300000.00" }]),
		listHeldFunds: jest.fn().mockResolvedValue([{ tripId: TRIP_B, amount: "1000000.00" }]),
		sumPendingRefunds: jest.fn().mockResolvedValue({ count: 1, amount: "200000.00" }),
		sumSucceededPayouts: jest
			.fn()
			.mockResolvedValue([{ bucket: "2026-11-01", amount: "3000000.00" }]),
		sumPendingPayouts: jest.fn().mockResolvedValue("25000.00"),
		findTrips: jest.fn().mockResolvedValue([
			{
				id: TRIP_A,
				title: "Khám phá bán đảo Sơn Trà",
				startsAt: new Date("2026-10-20T00:00:00Z"),
				areaCode: "DNG-SON-TRA",
				areaName: "Sơn Trà",
				settledAt: new Date("2026-11-02T03:00:00Z"),
			},
			{
				id: TRIP_B,
				title: "Chinh phục đỉnh Bà Nà",
				startsAt: new Date("2026-11-20T00:00:00Z"),
				areaCode: "DNG-HOA-VANG",
				areaName: "Hòa Vang",
				settledAt: null,
			},
		]),
		listHosts: jest.fn().mockResolvedValue([{ id: HOST_ID, fullName: "Nguyễn Minh Quân" }]),
	} as unknown as jest.Mocked<RevenueAnalyticsRepository>;
}

describe("RevenueAnalyticsService (CTMS-110)", () => {
	let repository: jest.Mocked<RevenueAnalyticsRepository>;
	let service: RevenueAnalyticsService;

	beforeEach(() => {
		repository = buildRepository();
		service = new RevenueAnalyticsService(repository);
	});

	it("rejects callers who are neither Host nor Admin", async () => {
		await expect(service.getRevenueAnalytics(user(["camper"]), {})).rejects.toBeInstanceOf(
			ForbiddenException
		);
	});

	it("rejects an inverted or half-open custom date range", async () => {
		await expect(
			service.getRevenueAnalytics(user(["host"]), {
				from: "2026-11-10T00:00:00Z",
				to: "2026-11-01T00:00:00Z",
			})
		).rejects.toBeInstanceOf(BadRequestException);
		await expect(
			service.getRevenueAnalytics(user(["host"]), { from: "2026-11-10T00:00:00Z" })
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it("pins a Host to their own scope even when another hostId is sent (BR-318)", async () => {
		const report = await service.getRevenueAnalytics(user(["host"]), { hostId: OTHER_HOST_ID });

		expect(repository.sumSucceededPayments).toHaveBeenCalledWith(
			expect.anything(),
			{ hostId: HOST_ID, areaCode: undefined },
			expect.anything()
		);
		expect(repository.sumSucceededPayouts).toHaveBeenCalledWith(
			expect.anything(),
			HOST_ID,
			expect.anything()
		);
		expect(report.scope).toEqual({ role: "host", hostId: HOST_ID });
		expect(report.hosts).toBeUndefined();
	});

	it("lets an Admin narrow to one Host and lists Host options", async () => {
		const report = await service.getRevenueAnalytics(user(["admin"], "admin-id"), {
			hostId: OTHER_HOST_ID,
		});
		expect(repository.listSettlements).toHaveBeenCalledWith(
			expect.anything(),
			{ hostId: OTHER_HOST_ID, areaCode: undefined },
			expect.anything()
		);
		expect(report.hosts).toEqual([{ id: HOST_ID, fullName: "Nguyễn Minh Quân" }]);
	});

	it("keeps each KPI separate and derives net revenue from the settlement snapshot", async () => {
		const report = await service.getRevenueAnalytics(user(["host"]), {});

		expect(report.currency).toBe("VND");
		expect(report.kpis).toEqual({
			grossRevenue: 5000000,
			refundAmount: 500000,
			platformFee: 175000,
			postSettlementRefund: 300000,
			netRevenue: 3025000,
			payout: 3000000,
			heldFunds: 1000000,
			pendingPayout: 25000,
			pendingRefundAmount: 200000,
			pendingRefundCount: 1,
		});
		expect(report.dateBasis.grossRevenue).toBe("payment_succeeded_at");
		expect(report.dateBasis.payout).toBe("payout_succeeded_at");
	});

	it("breaks totals down by trip and area so every figure is traceable (BR-329)", async () => {
		const report = await service.getRevenueAnalytics(user(["host"]), {});

		const sum = (key: "grossRevenue" | "refundAmount" | "platformFee" | "netRevenue") =>
			report.byTrip.reduce((total, trip) => total + trip[key], 0);
		expect(sum("grossRevenue")).toBe(report.kpis.grossRevenue);
		expect(sum("refundAmount")).toBe(report.kpis.refundAmount);
		expect(sum("platformFee")).toBe(report.kpis.platformFee);
		expect(sum("netRevenue")).toBe(report.kpis.netRevenue);

		expect(report.byTrip[0]).toMatchObject({
			tripId: TRIP_A,
			title: "Khám phá bán đảo Sơn Trà",
			areaName: "Sơn Trà",
			bookingCount: 2,
			netRevenue: 3025000,
		});
		expect(report.byArea).toEqual([
			expect.objectContaining({ areaCode: "DNG-SON-TRA", grossRevenue: 4000000, grossShare: 80 }),
			expect.objectContaining({ areaCode: "DNG-HOA-VANG", heldFunds: 1000000, grossShare: 20 }),
		]);
	});

	it("fills every bucket of the window, including empty ones", async () => {
		repository.listBuckets.mockResolvedValue(["2026-09-01", "2026-10-01", "2026-11-01"]);
		const report = await service.getRevenueAnalytics(user(["host"]), {});

		expect(report.timeSeries.map((point) => point.bucket)).toEqual([
			"2026-09-01",
			"2026-10-01",
			"2026-11-01",
		]);
		expect(report.timeSeries[0]).toMatchObject({ grossRevenue: 0, payout: 0 });
		expect(report.timeSeries[2]).toMatchObject({
			grossRevenue: 1000000,
			netRevenue: 3025000,
			payout: 3000000,
		});
	});

	it("trims empty leading buckets for the all-time preset", async () => {
		repository.listBuckets.mockResolvedValue(["2020-01-01", "2026-10-01", "2026-11-01"]);
		const report = await service.getRevenueAnalytics(user(["host"]), {
			period: ReportPeriodPreset.ALL_TIME,
		});
		expect(report.timeSeries[0].bucket).toBe("2026-10-01");
	});

	it("does not attribute Host-level payouts to an area", async () => {
		const report = await service.getRevenueAnalytics(user(["host"]), { areaCode: "DNG-SON-TRA" });

		expect(repository.sumSucceededPayouts).not.toHaveBeenCalled();
		expect(repository.sumPendingPayouts).not.toHaveBeenCalled();
		expect(report.payoutAreaScoped).toBe(false);
		expect(report.kpis.payout).toBeNull();
		expect(report.kpis.pendingPayout).toBeNull();
		expect(report.timeSeries.every((point) => point.payout === null)).toBe(true);
		expect(repository.listHeldFunds).toHaveBeenCalledWith({
			hostId: HOST_ID,
			areaCode: "DNG-SON-TRA",
		});
	});
});

describe("effectiveGranularity", () => {
	const window = (days: number) => ({
		from: new Date("2026-01-01T00:00:00Z"),
		to: new Date(new Date("2026-01-01T00:00:00Z").getTime() + days * 86400000),
	});

	it("keeps the requested bucket for short windows and defaults to month", () => {
		expect(effectiveGranularity(RevenueGranularity.DAY, window(30))).toBe(RevenueGranularity.DAY);
		expect(effectiveGranularity(undefined, window(30))).toBe(RevenueGranularity.MONTH);
	});

	it("coarsens day and week buckets for long windows", () => {
		expect(effectiveGranularity(RevenueGranularity.DAY, window(200))).toBe(RevenueGranularity.WEEK);
		expect(effectiveGranularity(RevenueGranularity.DAY, window(1000))).toBe(
			RevenueGranularity.MONTH
		);
		expect(effectiveGranularity(RevenueGranularity.WEEK, window(1000))).toBe(
			RevenueGranularity.MONTH
		);
	});
});

describe("revenue money helpers", () => {
	it("parses aggregated numeric sums exactly, including large and negative values", () => {
		expect(sumToMinor("123456789012345.67")).toBe(12345678901234567n);
		expect(sumToMinor("-500000.5")).toBe(-50000050n);
		expect(sumToMinor(null)).toBe(0n);
		expect(minorToAmount(sumToMinor("0.10") + sumToMinor("0.20"))).toBe(0.3);
	});
});
