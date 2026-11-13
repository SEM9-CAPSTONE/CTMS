import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import { ReportPeriodPreset } from "./dto/get-performance-report-query.dto";
import type { PerformanceReportResponseDto } from "./dto/performance-report-response.dto";
import { PerformanceReportsController } from "./performance-reports.controller";
import type { PerformanceReportsService } from "./performance-reports.service";

describe("PerformanceReportsController (CTMS-101)", () => {
	let controller: PerformanceReportsController;
	let service: jest.Mocked<PerformanceReportsService>;

	const sampleResponse: PerformanceReportResponseDto = {
		timeWindow: {
			from: "2026-10-01T00:00:00.000Z",
			to: "2026-10-31T23:59:59.999Z",
			preset: "30d",
		},
		scope: { role: "admin" },
		bookings: { total: 10, confirmed: 6, completed: 3, cancelled: 1, pending: 0 },
		trips: { total: 2, completed: 1, ongoing: 0, published: 1, cancelled: 0 },
		fillRate: 80.0,
		cancellationRate: 10.0,
		revenue: {
			estimated: { amount: 20000000, label: "Estimated", isEstimated: true },
			actual: {
				amount: 18000000,
				label: "Actual",
				isEstimated: false,
				ledgerSource: "settlements",
			},
		},
		timeSeries: [],
		breakdown: [],
	};

	beforeEach(() => {
		service = {
			getPerformanceReport: jest.fn().mockResolvedValue(sampleResponse),
		} as unknown as jest.Mocked<PerformanceReportsService>;

		controller = new PerformanceReportsController(service);
	});

	it("GET /reports/performance delegates to service with user and query", async () => {
		const user: AuthenticatedUser = {
			userId: "admin-1",
			roles: [UserRole.ADMIN],
			status: UserStatus.ACTIVE,
		};
		const query = { period: ReportPeriodPreset.DAYS_30 };

		const result = await controller.getReport({ user }, query);

		expect(result).toBe(sampleResponse);
		expect(service.getPerformanceReport).toHaveBeenCalledWith(user, query);
	});
});
