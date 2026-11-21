import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import { ReportPeriodPreset } from "./dto/get-performance-report-query.dto";
import type { PerformanceReportResponseDto } from "./dto/performance-report-response.dto";
import type { PerformanceReportsRepository } from "./performance-reports.repository";
import { PerformanceReportsService } from "./performance-reports.service";

describe("PerformanceReportsService (CTMS-101, BR-283, BR-211)", () => {
	let service: PerformanceReportsService;
	let repository: jest.Mocked<PerformanceReportsRepository>;

	const mockReport: PerformanceReportResponseDto = {
		timeWindow: {
			from: "2026-10-01T00:00:00.000Z",
			to: "2026-10-31T23:59:59.999Z",
			preset: "30d",
		},
		scope: {
			role: "admin",
		},
		bookings: {
			total: 50,
			confirmed: 30,
			completed: 15,
			cancelled: 4,
			pending: 1,
		},
		trips: {
			total: 10,
			completed: 6,
			ongoing: 1,
			published: 2,
			cancelled: 1,
		},
		fillRate: 85.5,
		cancellationRate: 8.0,
		revenue: {
			estimated: {
				amount: 150000000,
				label: "Estimated",
				isEstimated: true,
			},
			actual: {
				amount: 120000000,
				label: "Actual",
				isEstimated: false,
				ledgerSource: "settlements",
			},
		},
		timeSeries: [],
		breakdown: [],
	};

	beforeEach(() => {
		repository = {
			generateReport: jest.fn().mockResolvedValue(mockReport),
			resolveTimeWindow: jest.fn(),
		} as unknown as jest.Mocked<PerformanceReportsRepository>;

		service = new PerformanceReportsService(repository);
	});

	it("allows Admin to view platform-wide report (scope: admin)", async () => {
		const adminUser: AuthenticatedUser = {
			userId: "admin-uuid-1",
			roles: [UserRole.ADMIN],
			status: UserStatus.ACTIVE,
		};

		const result = await service.getPerformanceReport(adminUser, {
			period: ReportPeriodPreset.DAYS_30,
		});

		expect(result).toBe(mockReport);
		expect(repository.generateReport).toHaveBeenCalledWith(
			{ period: ReportPeriodPreset.DAYS_30 },
			{ role: "admin" }
		);
	});

	it("allows Host to view report strictly scoped to their hostId (scope: host, hostId: host-uuid-2)", async () => {
		const hostUser: AuthenticatedUser = {
			userId: "host-uuid-2",
			roles: [UserRole.HOST],
			status: UserStatus.ACTIVE,
		};

		const result = await service.getPerformanceReport(hostUser, {
			province: "Lâm Đồng",
		});

		expect(result).toBe(mockReport);
		expect(repository.generateReport).toHaveBeenCalledWith(
			{ province: "Lâm Đồng" },
			{ role: "host", hostId: "host-uuid-2" }
		);
	});

	it("rejects unauthorized roles (Camper) with ForbiddenException (BR-211)", async () => {
		const camperUser: AuthenticatedUser = {
			userId: "camper-uuid-3",
			roles: [UserRole.CAMPER],
			status: UserStatus.ACTIVE,
		};

		await expect(
			service.getPerformanceReport(camperUser, { period: ReportPeriodPreset.DAYS_30 })
		).rejects.toThrow(ForbiddenException);

		expect(repository.generateReport).not.toHaveBeenCalled();
	});

	it("rejects unauthorized roles (Porter) with ForbiddenException (BR-211)", async () => {
		const porterUser: AuthenticatedUser = {
			userId: "porter-uuid-4",
			roles: [UserRole.PORTER],
			status: UserStatus.ACTIVE,
		};

		await expect(
			service.getPerformanceReport(porterUser, { period: ReportPeriodPreset.DAYS_30 })
		).rejects.toThrow(ForbiddenException);

		expect(repository.generateReport).not.toHaveBeenCalled();
	});

	it("throws BadRequestException when 'from' is after 'to'", async () => {
		const adminUser: AuthenticatedUser = {
			userId: "admin-uuid-1",
			roles: [UserRole.ADMIN],
			status: UserStatus.ACTIVE,
		};

		await expect(
			service.getPerformanceReport(adminUser, {
				from: "2026-11-10T00:00:00.000Z",
				to: "2026-10-01T00:00:00.000Z",
			})
		).rejects.toThrow(BadRequestException);

		expect(repository.generateReport).not.toHaveBeenCalled();
	});
});
