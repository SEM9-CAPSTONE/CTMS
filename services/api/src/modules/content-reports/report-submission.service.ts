import { createHash } from "node:crypto";
import {
	ConflictException,
	Injectable,
	NotFoundException,
	UnauthorizedException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest runtime injection metadata
import { DataSource, type EntityManager, QueryFailedError } from "typeorm";
import { POSTGRES_ERROR_CODES } from "../../shared/database/postgres-error-codes";
import { AuditLog } from "../auth/entities/audit-log.entity";
import { UserRole, UserStatus } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: Nest runtime injection metadata
import { UsersRepository } from "../users/users.repository";
import type { CreateContentReportDto } from "./dto/create-content-report.dto";
import type { ListContentReportsQueryDto } from "./dto/list-content-reports-query.dto";
// biome-ignore lint/style/useImportType: Nest runtime injection metadata
import { ReportSubmissionRepository } from "./report-submission.repository";
import {
	REPORT_IDEMPOTENCY_INDEX,
	REPORT_OPEN_TARGET_INDEX,
	type StoredSubmission,
	type SubmittedReport,
} from "./report-submission.types";

function response(row: StoredSubmission): SubmittedReport {
	const { requestHash: _hash, ...report } = row;
	return report;
}

function replay(row: StoredSubmission, hash: string): SubmittedReport {
	if (row.requestHash !== hash)
		throw new ConflictException({
			code: "REPORT_IDEMPOTENCY_CONFLICT",
			message: "Mã gửi báo cáo đã được dùng cho nội dung khác.",
		});
	return response(row);
}

@Injectable()
export class ReportSubmissionService {
	constructor(
		private readonly db: DataSource,
		private readonly users: UsersRepository,
		private readonly reports: ReportSubmissionRepository
	) {}

	async create(actorId: string, dto: CreateContentReportDto): Promise<SubmittedReport> {
		const hash = createHash("sha256")
			.update(
				JSON.stringify([
					dto.reportType,
					dto.targetType,
					dto.targetId.toLowerCase(),
					dto.description,
				])
			)
			.digest("hex");
		try {
			return await this.db.transaction(async (manager) => {
				const roles = await this.assertActor(manager, actorId);
				// Replay precedes target authorization and the open-report constraint, even after resolution.
				const previous = await this.reports.findByKey(manager, actorId, dto.idempotencyKey);
				if (previous) return replay(previous, hash);
				if (
					!(await this.reports.canReportReview(
						manager,
						actorId,
						dto.targetId,
						roles.includes(UserRole.HOST),
						roles.includes(UserRole.CAMPER)
					))
				) {
					throw new NotFoundException({
						code: "REPORT_TARGET_NOT_FOUND",
						message: "Không tìm thấy nội dung có thể báo cáo.",
					});
				}
				const saved = await this.reports.insert(manager, actorId, dto, hash);
				await manager.getRepository(AuditLog).save({
					actorId,
					action: "content_report.created",
					targetType: "content_report",
					targetId: saved.id,
					before: null,
					after: {
						status: saved.status,
						reportType: saved.reportType,
						targetType: saved.targetType,
						targetId: saved.targetId,
					},
					reason: null,
				});
				return response(saved);
			});
		} catch (error: unknown) {
			if (!(error instanceof QueryFailedError)) throw error;
			const driver = error.driverError as { code?: string; constraint?: string };
			if (
				driver.code !== POSTGRES_ERROR_CODES.UNIQUE_VIOLATION ||
				![REPORT_IDEMPOTENCY_INDEX, REPORT_OPEN_TARGET_INDEX].includes(driver.constraint ?? "")
			)
				throw error;
			// The failed transaction has rolled back. A fresh statement sees the concurrent winner.
			const previous = await this.reports.findByKey(this.db.manager, actorId, dto.idempotencyKey);
			if (previous) return replay(previous, hash);
			if (driver.constraint !== REPORT_OPEN_TARGET_INDEX) throw error;
			throw new ConflictException({
				code: "REPORT_ALREADY_OPEN",
				message: "Bạn đã gửi báo cáo cho nội dung này và báo cáo đang được xem xét.",
			});
		}
	}

	async getOwn(actorId: string, id: string): Promise<SubmittedReport> {
		await this.assertActor(this.db.manager, actorId);
		const report = await this.reports.own(this.db.manager, actorId, id);
		if (!report)
			throw new NotFoundException({ code: "REPORT_NOT_FOUND", message: "Không tìm thấy báo cáo." });
		return response(report);
	}

	async listOwn(actorId: string, query: ListContentReportsQueryDto) {
		await this.assertActor(this.db.manager, actorId);
		const { items, total } = await this.reports.listOwn(
			this.db.manager,
			actorId,
			query.page,
			query.limit
		);
		return {
			items: items.map(response),
			pagination: {
				page: query.page,
				limit: query.limit,
				total,
				totalPages: Math.ceil(total / query.limit),
			},
		};
	}

	private async assertActor(manager: EntityManager, actorId: string): Promise<UserRole[]> {
		const users = manager.withRepository(this.users);
		const user = await users.findOneWithRolesById(actorId);
		if (!user || user.status !== UserStatus.ACTIVE)
			throw new UnauthorizedException("Vui lòng đăng nhập để tiếp tục.");
		return users.getGrantedRoles(user);
	}
}
