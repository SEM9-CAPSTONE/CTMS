import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest runtime injection metadata
import { DataSource, In } from "typeorm";
import { ContentReportStatus } from "../content-reports/content-report-status.enum";
import { ContentReport } from "../content-reports/entities/content-report.entity";
// biome-ignore lint/style/useImportType: Nest runtime injection metadata
import { PorterVerificationsRepository } from "../profiles/repositories/porter-verifications.repository";
import {
	TrekkingRoute,
	TrekkingRouteStatus,
} from "../trekking-routes/entities/trekking-route.entity";
import { Trip, TripStatus } from "../trips/entities/trip.entity";
import type { AdminModerationCountsDto } from "./dto/admin-moderation-counts.dto";

@Injectable()
export class AdminModerationService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly porterVerifications: PorterVerificationsRepository
	) {}

	async getCounts(): Promise<AdminModerationCountsDto> {
		const [trips, trekkingRoutes, porterVerifications, contentReports] = await Promise.all([
			this.dataSource.getRepository(Trip).countBy({ status: TripStatus.PENDING_APPROVAL }),
			this.dataSource
				.getRepository(TrekkingRoute)
				.countBy({ status: TrekkingRouteStatus.PENDING_APPROVAL }),
			this.porterVerifications.countPendingReview(),
			this.dataSource.getRepository(ContentReport).countBy({
				status: In([ContentReportStatus.PENDING, ContentReportStatus.REVIEWING]),
			}),
		]);
		return { trips, trekkingRoutes, porterVerifications, contentReports };
	}
}
