import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	UnauthorizedException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource } from "typeorm";
import type { EntityManager } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import { RefreshToken } from "../auth/entities/refresh-token.entity";
import type { AccountStatusActionDto } from "./dto/account-status-action.dto";
import type { ListUsersQueryDto } from "./dto/list-users-query.dto";
import type {
	PaginatedUserAccountsResponseDto,
	UserAccountDetailDto,
} from "./dto/user-account-response.dto";
import { toUserAccountDetail, toUserAccountSummary } from "./dto/user-account-response.dto";
import { User, UserRole, UserStatus } from "./entities/user.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { UsersRepository } from "./users.repository";

const AUTHENTICATION_REQUIRED_MESSAGE = "Authentication required";
const ADMIN_ACCESS_REQUIRED_MESSAGE = "Admin access required";
const USER_NOT_FOUND_MESSAGE = "User account not found";
const SELF_LOCK_NOT_ALLOWED_MESSAGE = "Administrators cannot lock their own account";
const INVALID_STATUS_TRANSITION_MESSAGE = "Account status transition is not allowed";

@Injectable()
export class UsersService {
	constructor(
		private readonly usersRepository: UsersRepository,
		private readonly dataSource: DataSource
	) {}

	async listUsers(
		actorId: string,
		query: ListUsersQueryDto
	): Promise<PaginatedUserAccountsResponseDto> {
		await this.assertAdminActor(actorId);
		const { users, total } = await this.usersRepository.findAccounts(query);
		return {
			items: users.map(toUserAccountSummary),
			pagination: {
				page: query.page,
				limit: query.limit,
				total,
				totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
			},
		};
	}

	async getUser(actorId: string, userId: string): Promise<UserAccountDetailDto> {
		await this.assertAdminActor(actorId);
		const user = await this.usersRepository.findOneBy({ id: userId });
		if (!user) {
			throw new NotFoundException(USER_NOT_FOUND_MESSAGE);
		}
		return toUserAccountDetail(user);
	}

	lockUser(
		actorId: string,
		userId: string,
		dto: AccountStatusActionDto
	): Promise<UserAccountDetailDto> {
		return this.changeStatus(
			actorId,
			userId,
			UserStatus.ACTIVE,
			UserStatus.SUSPENDED,
			"user.account_locked",
			dto.reason,
			true
		);
	}

	unlockUser(
		actorId: string,
		userId: string,
		dto: AccountStatusActionDto
	): Promise<UserAccountDetailDto> {
		return this.changeStatus(
			actorId,
			userId,
			UserStatus.SUSPENDED,
			UserStatus.ACTIVE,
			"user.account_unlocked",
			dto.reason
		);
	}

	private async changeStatus(
		actorId: string,
		userId: string,
		expectedStatus: UserStatus,
		nextStatus: UserStatus,
		action: string,
		reason?: string,
		preventSelfLock = false
	): Promise<UserAccountDetailDto> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const transactionalUsersRepository = manager.withRepository(this.usersRepository);
			await this.assertAdminActor(actorId, transactionalUsersRepository);
			if (preventSelfLock && actorId === userId) {
				throw new ConflictException(SELF_LOCK_NOT_ALLOWED_MESSAGE);
			}

			const user = await manager
				.getRepository(User)
				.createQueryBuilder("user")
				.setLock("pessimistic_write")
				.where("user.id = :userId", { userId })
				.getOne();
			if (!user) {
				throw new NotFoundException(USER_NOT_FOUND_MESSAGE);
			}
			if (user.status !== expectedStatus) {
				throw new ConflictException(INVALID_STATUS_TRANSITION_MESSAGE);
			}

			const before = { status: user.status };
			user.status = nextStatus;
			const updatedUser = await transactionalUsersRepository.save(user);

			if (nextStatus === UserStatus.SUSPENDED) {
				const revokedAt = new Date();
				await manager
					.getRepository(RefreshToken)
					.createQueryBuilder()
					.update()
					.set({ revokedAt })
					.where("user_id = :userId", { userId })
					.andWhere("revoked_at IS NULL")
					.execute();
			}

			await manager.getRepository(AuditLog).save({
				actorId,
				action,
				targetType: "user",
				targetId: userId,
				before,
				after: { status: nextStatus },
				reason: reason ?? null,
			});

			return toUserAccountDetail(updatedUser);
		});
	}

	private async assertAdminActor(
		actorId: string,
		usersRepository: UsersRepository = this.usersRepository
	): Promise<void> {
		const actor = await usersRepository.findOneWithRolesById(actorId);
		if (!actor || actor.status !== UserStatus.ACTIVE) {
			throw new UnauthorizedException(AUTHENTICATION_REQUIRED_MESSAGE);
		}
		if (!usersRepository.getGrantedRoles(actor).includes(UserRole.ADMIN)) {
			throw new ForbiddenException(ADMIN_ACCESS_REQUIRED_MESSAGE);
		}
	}
}
