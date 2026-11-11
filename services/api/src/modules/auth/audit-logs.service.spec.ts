import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { type User, UserRole, UserStatus } from "../users/entities/user.entity";
import type { UsersRepository } from "../users/users.repository";
import type { AuditLogRepository } from "./audit-log.repository";
import { AuditLogsService } from "./audit-logs.service";
import { AuditLogOutcome } from "./dto/list-audit-logs-query.dto";
import type { AuditLog } from "./entities/audit-log.entity";

function buildUser(overrides: Partial<User> = {}): User {
	return {
		id: "11111111-1111-1111-1111-111111111111",
		email: "user@example.com",
		phone: "+84912345678",
		passwordHash: "secret-hash",
		role: UserRole.CAMPER,
		status: UserStatus.ACTIVE,
		fullName: "Nguyen Van A",
		dateOfBirth: null,
		gender: null,
		address: null,
		bio: null,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		...overrides,
	};
}

function buildAuditLog(overrides: Partial<AuditLog> = {}): AuditLog {
	return {
		id: "22222222-2222-2222-2222-222222222222",
		actorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
		action: "auth.login",
		targetType: "user",
		targetId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
		before: null,
		after: null,
		reason: null,
		createdAt: new Date("2026-01-01T12:00:00.000Z"),
		...overrides,
	};
}

describe("AuditLogsService", () => {
	let service: AuditLogsService;
	let auditLogRepository: {
		createQueryBuilder: jest.Mock;
	};
	let usersRepository: {
		findOneWithRolesById: jest.Mock;
		getGrantedRoles: jest.Mock;
		find: jest.Mock;
		createQueryBuilder: jest.Mock;
	};
	let userQueryBuilder: {
		select: jest.Mock;
		where: jest.Mock;
		getMany: jest.Mock;
	};
	let queryBuilder: {
		andWhere: jest.Mock;
		orderBy: jest.Mock;
		addOrderBy: jest.Mock;
		skip: jest.Mock;
		take: jest.Mock;
		getManyAndCount: jest.Mock;
	};

	const adminUser = buildUser({
		id: "admin-uuid",
		role: UserRole.ADMIN,
		email: "admin@example.com",
	});

	beforeEach(() => {
		queryBuilder = {
			andWhere: jest.fn().mockReturnThis(),
			orderBy: jest.fn().mockReturnThis(),
			addOrderBy: jest.fn().mockReturnThis(),
			skip: jest.fn().mockReturnThis(),
			take: jest.fn().mockReturnThis(),
			getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
		};

		auditLogRepository = {
			createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
		};

		userQueryBuilder = {
			select: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			getMany: jest.fn().mockResolvedValue([]),
		};

		usersRepository = {
			findOneWithRolesById: jest.fn().mockResolvedValue(adminUser),
			getGrantedRoles: jest.fn((user: User) => [user.role]),
			find: jest.fn().mockResolvedValue([]),
			createQueryBuilder: jest.fn().mockReturnValue(userQueryBuilder),
		};

		service = new AuditLogsService(
			auditLogRepository as unknown as AuditLogRepository,
			usersRepository as unknown as UsersRepository
		);
	});

	describe("listAuditLogs", () => {
		it("throws UnauthorizedException if actor does not exist", async () => {
			usersRepository.findOneWithRolesById.mockResolvedValue(null);

			await expect(
				service.listAuditLogs("invalid-uuid", { page: 1, limit: 20 })
			).rejects.toBeInstanceOf(UnauthorizedException);
		});

		it("throws UnauthorizedException if actor is not active", async () => {
			const inactiveAdmin = buildUser({
				id: "admin-uuid",
				role: UserRole.ADMIN,
				status: UserStatus.SUSPENDED,
			});
			usersRepository.findOneWithRolesById.mockResolvedValue(inactiveAdmin);

			await expect(
				service.listAuditLogs("admin-uuid", { page: 1, limit: 20 })
			).rejects.toBeInstanceOf(UnauthorizedException);
		});

		it("throws ForbiddenException if actor is not an admin", async () => {
			const camperUser = buildUser({
				id: "camper-uuid",
				role: UserRole.CAMPER,
			});
			usersRepository.findOneWithRolesById.mockResolvedValue(camperUser);

			await expect(
				service.listAuditLogs("camper-uuid", { page: 1, limit: 20 })
			).rejects.toBeInstanceOf(ForbiddenException);
		});

		it("returns empty result immediately if outcome is failure", async () => {
			const result = await service.listAuditLogs("admin-uuid", {
				page: 1,
				limit: 20,
				outcome: AuditLogOutcome.FAILURE,
			});

			expect(result.items).toHaveLength(0);
			expect(result.pagination).toEqual({
				page: 1,
				limit: 20,
				total: 0,
				totalPages: 0,
			});
			expect(auditLogRepository.createQueryBuilder).not.toHaveBeenCalled();
		});

		it("queries, paginates and filters audit logs for active admin", async () => {
			const log = buildAuditLog({
				before: { passwordHash: "secret", data: "ok" },
				after: { codeHash: "otpSecret", tokenHash: "tokenSecret", details: "yes" },
			});
			queryBuilder.getManyAndCount.mockResolvedValue([[log], 1]);
			userQueryBuilder.getMany.mockResolvedValue([
				{
					id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
					fullName: "Actor User",
					email: "actor@example.com",
				},
			]);

			const startDate = new Date("2026-01-01T00:00:00.000Z");
			const endDate = new Date("2026-01-02T00:00:00.000Z");

			const result = await service.listAuditLogs("admin-uuid", {
				actorId: "actor-uuid",
				action: "auth.login",
				targetId: "target-uuid",
				targetType: "user",
				startDate,
				endDate,
				page: 1,
				limit: 10,
			});

			expect(auditLogRepository.createQueryBuilder).toHaveBeenCalledWith("log");
			expect(queryBuilder.andWhere).toHaveBeenCalledWith("log.actorId IN (:...actorIds)", {
				actorIds: ["actor-uuid"],
			});
			expect(queryBuilder.andWhere).toHaveBeenCalledWith("log.action = :action", {
				action: "auth.login",
			});
			expect(queryBuilder.andWhere).toHaveBeenCalledWith("log.targetId = :targetId", {
				targetId: "target-uuid",
			});
			expect(queryBuilder.andWhere).toHaveBeenCalledWith("log.targetType = :targetType", {
				targetType: "user",
			});
			expect(queryBuilder.andWhere).toHaveBeenCalledWith("log.createdAt >= :startDate", {
				startDate,
			});
			expect(queryBuilder.andWhere).toHaveBeenCalledWith("log.createdAt <= :endDate", { endDate });
			expect(queryBuilder.skip).toHaveBeenCalledWith(0);
			expect(queryBuilder.take).toHaveBeenCalledWith(10);
			expect(queryBuilder.orderBy).toHaveBeenCalledWith("log.createdAt", "DESC");
			expect(queryBuilder.addOrderBy).toHaveBeenCalledWith("log.id", "DESC");

			expect(result.items).toHaveLength(1);
			expect(result.pagination).toEqual({
				page: 1,
				limit: 10,
				total: 1,
				totalPages: 1,
			});

			const item = result.items[0];
			expect(item.before).toEqual({ passwordHash: "[MASKED]", data: "ok" });
			expect(item.after).toEqual({ codeHash: "[MASKED]", tokenHash: "[MASKED]", details: "yes" });
		});

		it("correctly maps actor and target alias parameters", async () => {
			queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
			userQueryBuilder.getMany.mockResolvedValue([{ id: "actor-alias-uuid" }]);

			await service.listAuditLogs("admin-uuid", {
				actor: "actor-alias-uuid",
				targetId: "target-alias-uuid",
				page: 1,
				limit: 20,
			});

			expect(userQueryBuilder.where).toHaveBeenCalledWith(
				"user.fullName ILIKE :actor OR user.email ILIKE :actor OR user.phone ILIKE :actor",
				{ actor: "%actor-alias-uuid%" }
			);
			expect(queryBuilder.andWhere).toHaveBeenCalledWith("log.actorId IN (:...actorIds)", {
				actorIds: ["actor-alias-uuid"],
			});
			expect(queryBuilder.andWhere).toHaveBeenCalledWith("log.targetId = :targetId", {
				targetId: "target-alias-uuid",
			});
		});
	});
});
