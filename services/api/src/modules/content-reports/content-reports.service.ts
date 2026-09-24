import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	UnauthorizedException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest runtime injection metadata
import { DataSource, type EntityManager } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import { User, UserRole, UserStatus } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: Nest runtime injection metadata
import { UsersRepository } from "../users/users.repository";
import { ContentReportStatus } from "./content-report-status.enum";
// biome-ignore lint/style/useImportType: Nest runtime injection metadata
import { ContentReportsRepository } from "./content-reports.repository";
import {
	type ContentReportQueueResponseDto,
	type ContentReportResponseDto,
	toContentReportResponse,
} from "./dto/content-report-response.dto";
import type { ListContentReportsQueryDto } from "./dto/list-content-reports-query.dto";
import type { TransitionContentReportDto } from "./dto/transition-content-report.dto";
import type { ContentReport } from "./entities/content-report.entity";

const ALLOWED_TRANSITIONS: Record<ContentReportStatus, readonly ContentReportStatus[]> = {
	[ContentReportStatus.PENDING]: [
		ContentReportStatus.REVIEWING,
		ContentReportStatus.ACTIONED,
		ContentReportStatus.REJECTED,
	],
	[ContentReportStatus.REVIEWING]: [ContentReportStatus.ACTIONED, ContentReportStatus.REJECTED],
	[ContentReportStatus.ACTIONED]: [],
	[ContentReportStatus.REJECTED]: [],
};

@Injectable()
export class ContentReportsService {
	constructor(
		private readonly reports: ContentReportsRepository,
		private readonly users: UsersRepository,
		private readonly dataSource: DataSource
	) {}

	async getReport(actorId: string, reportId: string): Promise<ContentReportResponseDto> {
		await this.assertAdmin(actorId, this.dataSource.manager);
		const report = await this.reports.findOneBy({ id: reportId });
		if (!report) throw new NotFoundException("Content report not found");
		return this.toResponse(report, this.dataSource.manager);
	}

	async listReports(
		actorId: string,
		query: ListContentReportsQueryDto
	): Promise<ContentReportQueueResponseDto> {
		await this.assertAdmin(actorId, this.dataSource.manager);
		const [reports, total] = await this.reports.findQueue(query);
		return {
			items: reports.map((report) => toContentReportResponse(report, report.reporter)),
			pagination: {
				page: query.page,
				limit: query.limit,
				total,
				totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
			},
		};
	}

	transition(
		actorId: string,
		reportId: string,
		dto: TransitionContentReportDto
	): Promise<ContentReportResponseDto> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			await this.assertAdmin(actorId, manager);
			const reports = manager.withRepository(this.reports);
			const report = await reports.findForUpdate(reportId);
			if (!report) throw new NotFoundException("Content report not found");
			if (report.status !== dto.expectedStatus) {
				throw new ConflictException("Content report status has changed; reload before retrying");
			}
			if (!ALLOWED_TRANSITIONS[report.status].includes(dto.status)) {
				throw new ConflictException("Content report status transition is not allowed");
			}
			const before = { status: report.status };
			report.status = dto.status;
			const saved = await reports.save(report);
			await manager.getRepository(AuditLog).save({
				actorId,
				action: "content_report.status_changed",
				targetType: "content_report",
				targetId: report.id,
				before,
				after: { status: saved.status },
				reason: null,
			});
			return this.toResponse(saved, manager);
		});
	}

	private async assertAdmin(actorId: string, manager: EntityManager): Promise<void> {
		const users = manager.withRepository(this.users);
		const actor = await users.findOneWithRolesById(actorId);
		if (!actor || actor.status !== UserStatus.ACTIVE)
			throw new UnauthorizedException("Authentication required");
		if (!users.getGrantedRoles(actor).includes(UserRole.ADMIN))
			throw new ForbiddenException("Admin access required");
	}

	private async toResponse(
		report: ContentReport,
		manager: EntityManager
	): Promise<ContentReportResponseDto> {
		const reporter = await manager.getRepository(User).findOneOrFail({
			where: { id: report.reporterId },
			select: { id: true, fullName: true },
		});
		return toContentReportResponse(report, reporter);
	}
}
