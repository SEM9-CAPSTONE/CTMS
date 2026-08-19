import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { UserRole, UserStatus } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires value imports
import { UsersRepository } from "../users/users.repository";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires value imports
import { AuditLogRepository } from "./audit-log.repository";
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
			targetId,
			target,
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

		let actorIdsFilter: string[] | undefined = undefined;
		if (qActorAlias) {
			const query = this.usersRepository
				.createQueryBuilder("user")
				.select("user.id")
				.where("user.fullName ILIKE :actor OR user.email ILIKE :actor OR user.phone ILIKE :actor", {
					actor: `%${qActorAlias}%`,
				});

			const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
				qActorAlias
			);
			if (isUuid) {
				query.orWhere("user.id = :actorIdRaw", { actorIdRaw: qActorAlias });
			}

			const matchedUsers = await query.getMany();
			const matchedIds = matchedUsers.map((u) => u.id);

			if (isUuid && !matchedIds.includes(qActorAlias)) {
				matchedIds.push(qActorAlias);
			}

			if (matchedIds.length === 0) {
				return {
					items: [],
					pagination: { page, limit, total: 0, totalPages: 0 },
				};
			}
			actorIdsFilter = matchedIds;
		}

		if (qActorId) {
			if (actorIdsFilter) {
				actorIdsFilter = actorIdsFilter.filter((id) => id === qActorId);
				if (actorIdsFilter.length === 0) {
					return {
						items: [],
						pagination: { page, limit, total: 0, totalPages: 0 },
					};
				}
			} else {
				actorIdsFilter = [qActorId];
			}
		}

		const qTargetId = targetId ?? target;
		const queryBuilder = this.auditLogRepository.createQueryBuilder("log");

		if (actorIdsFilter && actorIdsFilter.length > 0) {
			queryBuilder.andWhere("log.actorId IN (:...actorIds)", { actorIds: actorIdsFilter });
		}

		if (action) {
			queryBuilder.andWhere("log.action = :action", { action });
		}

		if (qTargetId) {
			queryBuilder.andWhere("log.targetId = :targetId", { targetId: qTargetId });
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

		const uniqueActorIds = [...new Set(logs.map((log) => log.actorId).filter(Boolean))] as string[];
		const actorNamesMap = new Map<string, string>();

		if (uniqueActorIds.length > 0) {
			const users = await this.usersRepository
				.createQueryBuilder("u")
				.select(["u.id", "u.fullName", "u.email"])
				.where("u.id IN (:...ids)", { ids: uniqueActorIds })
				.getMany();
			for (const u of users) {
				const displayName = u.fullName ? `${u.fullName} (${u.email})` : (u.email ?? u.id);
				actorNamesMap.set(u.id, displayName);
			}
		}

		return {
			items: logs.map((log) =>
				toAuditLogItem(log, log.actorId ? actorNamesMap.get(log.actorId) || null : null)
			),
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
