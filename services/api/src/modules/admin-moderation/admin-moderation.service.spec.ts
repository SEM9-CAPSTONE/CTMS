import { type DataSource, In } from "typeorm";
import { ContentReportStatus } from "../content-reports/content-report-status.enum";
import { ContentReport } from "../content-reports/entities/content-report.entity";
import type { PorterVerificationsRepository } from "../profiles/repositories/porter-verifications.repository";
import {
	TrekkingRoute,
	TrekkingRouteStatus,
} from "../trekking-routes/entities/trekking-route.entity";
import { Trip, TripStatus } from "../trips/entities/trip.entity";
import { AdminModerationService } from "./admin-moderation.service";

describe("AdminModerationService", () => {
	it("counts each pending queue and keeps reviewing reports in the workload", async () => {
		const trips = { countBy: jest.fn().mockResolvedValue(4) };
		const routes = { countBy: jest.fn().mockResolvedValue(2) };
		const reports = { countBy: jest.fn().mockResolvedValue(1) };
		const porters = { countPendingReview: jest.fn().mockResolvedValue(0) };
		const repositories = new Map<
			typeof Trip | typeof TrekkingRoute | typeof ContentReport,
			typeof trips
		>([
			[Trip, trips],
			[TrekkingRoute, routes],
			[ContentReport, reports],
		]);
		const dataSource = {
			getRepository: jest.fn((entity: typeof Trip | typeof TrekkingRoute | typeof ContentReport) =>
				repositories.get(entity)
			),
		};
		const service = new AdminModerationService(
			dataSource as unknown as DataSource,
			porters as unknown as PorterVerificationsRepository
		);

		await expect(service.getCounts()).resolves.toEqual({
			trips: 4,
			trekkingRoutes: 2,
			porterVerifications: 0,
			contentReports: 1,
		});
		expect(trips.countBy).toHaveBeenCalledWith({ status: TripStatus.PENDING_APPROVAL });
		expect(routes.countBy).toHaveBeenCalledWith({ status: TrekkingRouteStatus.PENDING_APPROVAL });
		expect(porters.countPendingReview).toHaveBeenCalledTimes(1);
		expect(reports.countBy).toHaveBeenCalledWith({
			status: In([ContentReportStatus.PENDING, ContentReportStatus.REVIEWING]),
		});
	});
});
