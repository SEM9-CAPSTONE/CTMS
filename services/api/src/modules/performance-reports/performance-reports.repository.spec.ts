import type { DataSource } from "typeorm";
import { BookingStatus } from "../profiles/entities/booking.entity";
import { TripStatus } from "../trips/entities/trip.entity";
import { ReportPeriodPreset } from "./dto/get-performance-report-query.dto";
import { PerformanceReportsRepository } from "./performance-reports.repository";

describe("PerformanceReportsRepository (CTMS-101, BR-283)", () => {
	let repository: PerformanceReportsRepository;
	let dataSource: jest.Mocked<DataSource>;

	beforeEach(() => {
		dataSource = {
			query: jest.fn(),
		} as unknown as jest.Mocked<DataSource>;

		repository = new PerformanceReportsRepository(dataSource);
	});

	describe("resolveTimeWindow", () => {
		it("respects explicit from and to dates", () => {
			const from = "2026-08-01T00:00:00.000Z";
			const to = "2026-08-31T23:59:59.999Z";
			const window = repository.resolveTimeWindow({ from, to });

			expect(window.from.toISOString()).toBe(from);
			expect(window.to.toISOString()).toBe(to);
			expect(window.preset).toBeUndefined();
		});

		it("resolves 7d preset correctly", () => {
			const window = repository.resolveTimeWindow({ period: ReportPeriodPreset.DAYS_7 });
			const diffDays = (window.to.getTime() - window.from.getTime()) / (1000 * 60 * 60 * 24);
			expect(Math.round(diffDays)).toBe(7);
			expect(window.preset).toBe(ReportPeriodPreset.DAYS_7);
		});

		it("resolves 30d preset correctly", () => {
			const window = repository.resolveTimeWindow({ period: ReportPeriodPreset.DAYS_30 });
			const diffDays = (window.to.getTime() - window.from.getTime()) / (1000 * 60 * 60 * 24);
			expect(Math.round(diffDays)).toBe(30);
			expect(window.preset).toBe(ReportPeriodPreset.DAYS_30);
		});
	});

	describe("generateReport", () => {
		it("computes correct metrics, fill rate, cancellation rate, and labels revenue appropriately (BR-283)", async () => {
			// Mock trips query return
			dataSource.query.mockImplementation(async (sql: string) => {
				if (sql.includes("FROM trips trip")) {
					return [
						{
							id: "trip-1",
							title: "Trekking Fansipan",
							status: TripStatus.PUBLISHED,
							capacity_min: 10,
							capacity_max: 20,
							seats_taken: 16,
							created_at: new Date("2026-10-10"),
							route_name: "Fansipan Trạm Tôn",
						},
						{
							id: "trip-2",
							title: "Trekking Tà Năng",
							status: TripStatus.COMPLETED,
							capacity_min: 10,
							capacity_max: 20,
							seats_taken: 20,
							created_at: new Date("2026-10-12"),
							route_name: "Tà Năng - Phan Dũng",
						},
					];
				}
				if (sql.includes("FROM bookings b")) {
					return [
						{
							id: "book-1",
							trip_id: "trip-1",
							status: BookingStatus.CONFIRMED,
							num_people: 4,
							total_amount: "8000000",
							created_at: new Date("2026-10-10"),
						},
						{
							id: "book-2",
							trip_id: "trip-1",
							status: BookingStatus.CANCELLED,
							num_people: 2,
							total_amount: "4000000",
							created_at: new Date("2026-10-11"),
						},
						{
							id: "book-3",
							trip_id: "trip-2",
							status: BookingStatus.COMPLETED,
							num_people: 5,
							total_amount: "10000000",
							created_at: new Date("2026-10-12"),
						},
					];
				}
				if (sql.includes("FROM settlements s")) {
					return [
						{
							trip_id: "trip-2",
							settlement_base: "9500000",
							platform_fee: "500000",
							net_amount: "9000000",
							settled_at: new Date("2026-10-15"),
						},
					];
				}
				return [];
			});

			const report = await repository.generateReport(
				{ period: ReportPeriodPreset.DAYS_30 },
				{ role: "admin" }
			);

			// Trips: 2 total, 1 completed, 1 published
			expect(report.trips.total).toBe(2);
			expect(report.trips.completed).toBe(1);
			expect(report.trips.published).toBe(1);

			// Bookings: 3 total, 1 confirmed, 1 completed, 1 cancelled
			expect(report.bookings.total).toBe(3);
			expect(report.bookings.confirmed).toBe(1);
			expect(report.bookings.completed).toBe(1);
			expect(report.bookings.cancelled).toBe(1);

			// Capacity: 20 + 20 = 40; seats_taken: 16 + 20 = 36 => Fill Rate = 36/40 = 90%
			expect(report.fillRate).toBe(90);

			// Cancellation rate: 1 cancelled / 3 total = 33.33%
			expect(report.cancellationRate).toBe(33.33);

			// Revenue:
			// Estimated revenue from confirmed & completed bookings (8M + 10M = 18M)
			expect(report.revenue.estimated.amount).toBe(18000000);
			expect(report.revenue.estimated.label).toBe("Estimated");
			expect(report.revenue.estimated.isEstimated).toBe(true);

			// Actual revenue from settlements ledger (9.5M)
			expect(report.revenue.actual.amount).toBe(9500000);
			expect(report.revenue.actual.label).toBe("Actual");
			expect(report.revenue.actual.isEstimated).toBe(false);
			expect(report.revenue.actual.ledgerSource).toBe("settlements");
		});

		it("scopes Host actual revenue to netAmount after platform commission", async () => {
			dataSource.query.mockImplementation(async (sql: string) => {
				if (sql.includes("FROM trips trip")) return [];
				if (sql.includes("FROM bookings b")) return [];
				if (sql.includes("FROM settlements s")) {
					return [
						{
							trip_id: "trip-2",
							settlement_base: "10000000",
							platform_fee: "500000",
							net_amount: "9500000",
							settled_at: new Date("2026-10-15"),
						},
					];
				}
				return [];
			});

			const hostReport = await repository.generateReport(
				{ period: ReportPeriodPreset.DAYS_30 },
				{ role: "host", hostId: "host-uuid-1" }
			);

			// Host sees net amount (9.5M)
			expect(hostReport.revenue.actual.amount).toBe(9500000);
			expect(hostReport.scope.hostId).toBe("host-uuid-1");
		});
	});
});
