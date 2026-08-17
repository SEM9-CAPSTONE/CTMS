import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import type { UsersRepository } from "../users/users.repository";
import type { AuditLogRepository } from "./audit-log.repository";
import { type PaginatedAuditLogsResponseDto, toAuditLogItem } from "./dto/audit-log-response.dto";
import { AuditLogOutcome, type ListAuditLogsQueryDto } from "./dto/list-audit-logs-query.dto";

const AUTHENTICATION_REQUIRED_MESSAGE = "Authentication required";
const ADMIN_ACCESS_REQUIRED_MESSAGE = "Admin access required";

@Injectable()
export class AuditLogsService {
	constructor(
		private readonly auditLogRepository: AuditLogRepository,
		private readonly usersRepository: UsersRepository
	) {}

	async listAuditLogs(
		actorId: string,
		query: ListAuditLogsQueryDto
	): Promise<PaginatedAuditLogsResponseDto> {
		await this.assertAdminActor(actorId);

		const {
			actorId: qActorId,
			actor: qActorAlias,
			action,
			targetId: qTargetId,
			target: qTargetAlias,
			targetType,
			outcome,
			startDate,
			endDate,
			page,
			limit,
		} = query;

		// Filter by outcome: CTMS only records successful operations as transactions
		// roll back on failure. Thus, outcome = failure will always return empty.
		if (outcome === AuditLogOutcome.FAILURE) {
			return {
				items: [],
				pagination: {
					page,
					limit,
					total: 0,
					totalPages: 0,
				},
			};
		}

		const actorFilter = qActorId || qActorAlias;
		const targetFilter = qTargetId || qTargetAlias;

		const queryBuilder = this.auditLogRepository.createQueryBuilder("log");

		if (actorFilter) {
			queryBuilder.andWhere("log.actorId = :actorId", { actorId: actorFilter });
		}

		if (action) {
			queryBuilder.andWhere("log.action = :action", { action });
		}

		if (targetFilter) {
			queryBuilder.andWhere("log.targetId = :targetId", { targetId: targetFilter });
		}

		if (targetType) {
			queryBuilder.andWhere("log.targetType = :targetType", { targetType });
		}

		if (startDate) {
			queryBuilder.andWhere("log.createdAt >= :startDate", { startDate });
		}

		if (endDate) {
			queryBuilder.andWhere("log.createdAt <= :endDate", { endDate });
		}

		const skip = (page - 1) * limit;

		// Stable ordering: reverse chronological (latest first), with ID fallback
		queryBuilder
			.orderBy("log.createdAt", "DESC")
			.addOrderBy("log.id", "DESC")
			.skip(skip)
			.take(limit);

		const [logs, total] = await queryBuilder.getManyAndCount();

		return {
			items: logs.map(toAuditLogItem),
			pagination: {
				page,
				limit,
				total,
				totalPages: total === 0 ? 0 : Math.ceil(total / limit),
			},
		};
	}

	private async assertAdminActor(actorId: string): Promise<void> {
		const actor = await this.usersRepository.findOneWithRolesById(actorId);
		if (!actor || actor.status !== UserStatus.ACTIVE) {
			throw new UnauthorizedException(AUTHENTICATION_REQUIRED_MESSAGE);
		}
		if (!this.usersRepository.getGrantedRoles(actor).includes(UserRole.ADMIN)) {
			throw new ForbiddenException(ADMIN_ACCESS_REQUIRED_MESSAGE);
		}
	}
}
