import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { DataSource, EntityManager } from "typeorm";
import type { AuditLog } from "../auth/entities/audit-log.entity";
import { RefreshToken } from "../auth/entities/refresh-token.entity";
import { User, UserRole, UserStatus } from "./entities/user.entity";
import type { UsersRepository } from "./users.repository";
import { UsersService } from "./users.service";

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

describe("UsersService", () => {
	const actor = buildUser({
		id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
		role: UserRole.ADMIN,
		email: "admin@example.com",
	});
	const target = buildUser();
	let usersRepository: {
		findOneBy: jest.Mock;
		findOneWithRolesById: jest.Mock;
		getGrantedRoles: jest.Mock;
		findAccounts: jest.Mock;
	};
	let dataSource: { transaction: jest.Mock };
	let service: UsersService;

	beforeEach(() => {
		usersRepository = {
			findOneBy: jest.fn(),
			findOneWithRolesById: jest.fn().mockResolvedValue(actor),
			getGrantedRoles: jest.fn((user: User) => [user.role]),
			findAccounts: jest.fn(),
		};
		dataSource = { transaction: jest.fn() };
		service = new UsersService(
			usersRepository as unknown as UsersRepository,
			dataSource as unknown as DataSource
		);
	});

	describe("listUsers", () => {
		it("returns a paginated whitelist without passwordHash", async () => {
			usersRepository.findAccounts.mockResolvedValue({ users: [target], total: 1 });
			const result = await service.listUsers(actor.id, { page: 1, limit: 20 });

			expect(result.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
			expect(result.items[0]).not.toHaveProperty("passwordHash");
		});

		it("rejects a non-admin before querying accounts", async () => {
			usersRepository.findOneWithRolesById.mockResolvedValue(buildUser({ id: actor.id }));

			await expect(service.listUsers(actor.id, { page: 1, limit: 20 })).rejects.toBeInstanceOf(
				ForbiddenException
			);
			expect(usersRepository.findAccounts).not.toHaveBeenCalled();
		});
	});

	describe("getUser", () => {
		it("throws NotFoundException when the target does not exist", async () => {
			usersRepository.findOneBy.mockResolvedValueOnce(null);
			await expect(service.getUser(actor.id, target.id)).rejects.toBeInstanceOf(NotFoundException);
		});
	});

	describe("lockUser", () => {
		it("changes active to suspended, revokes sessions, and writes audit in one transaction", async () => {
			const transaction = buildTransaction(actor, target);
			dataSource.transaction.mockImplementation(transaction.execute);

			const result = await service.lockUser(actor.id, target.id, { reason: "Policy violation" });

			expect(result.status).toBe(UserStatus.SUSPENDED);
			expect(transaction.targetSetLock).toHaveBeenCalledWith("pessimistic_write");
			expect(transaction.refreshExecute).toHaveBeenCalledTimes(1);
			expect(transaction.auditSave).toHaveBeenCalledWith(
				expect.objectContaining({
					action: "user.account_locked",
					actorId: actor.id,
					targetId: target.id,
					before: { status: UserStatus.ACTIVE },
					after: { status: UserStatus.SUSPENDED },
					reason: "Policy violation",
				})
			);
		});

		it("rejects self-lock after authorization without writing", async () => {
			const transaction = buildTransaction(actor, actor);
			dataSource.transaction.mockImplementation(transaction.execute);

			await expect(service.lockUser(actor.id, actor.id, {})).rejects.toBeInstanceOf(
				ConflictException
			);
			expect(dataSource.transaction).toHaveBeenCalledTimes(1);
			expect(transaction.transactionalSave).not.toHaveBeenCalled();
			expect(transaction.refreshExecute).not.toHaveBeenCalled();
			expect(transaction.auditSave).not.toHaveBeenCalled();
		});

		it("rejects an invalid transition without writes", async () => {
			const transaction = buildTransaction(actor, buildUser({ status: UserStatus.SUSPENDED }));
			dataSource.transaction.mockImplementation(transaction.execute);

			await expect(service.lockUser(actor.id, target.id, {})).rejects.toBeInstanceOf(
				ConflictException
			);
			expect(transaction.transactionalSave).not.toHaveBeenCalled();
			expect(transaction.refreshExecute).not.toHaveBeenCalled();
			expect(transaction.auditSave).not.toHaveBeenCalled();
		});
	});

	describe("unlockUser", () => {
		it("changes suspended to active and does not create a new session", async () => {
			const transaction = buildTransaction(actor, buildUser({ status: UserStatus.SUSPENDED }));
			dataSource.transaction.mockImplementation(transaction.execute);

			const result = await service.unlockUser(actor.id, target.id, {});

			expect(result.status).toBe(UserStatus.ACTIVE);
			expect(transaction.refreshExecute).not.toHaveBeenCalled();
			expect(transaction.auditSave).toHaveBeenCalledWith(
				expect.objectContaining({ action: "user.account_unlocked", reason: null })
			);
		});
	});
});

function buildTransaction(actor: User, target: User) {
	const transactionalSave = jest.fn(async (user: User) => user);
	const transactionalUsersRepository = {
		findOneWithRolesById: jest.fn().mockResolvedValue(actor),
		getGrantedRoles: jest.fn((user: User) => [user.role]),
		save: transactionalSave,
	};
	const targetQuery = {
		setLock: jest.fn().mockReturnThis(),
		where: jest.fn().mockReturnThis(),
		getOne: jest.fn().mockResolvedValue(target),
	};
	const refreshExecute = jest.fn().mockResolvedValue({ affected: 1 });
	const refreshQuery = {
		update: jest.fn().mockReturnThis(),
		set: jest.fn().mockReturnThis(),
		where: jest.fn().mockReturnThis(),
		andWhere: jest.fn().mockReturnThis(),
		execute: refreshExecute,
	};
	const auditSave = jest.fn().mockResolvedValue({});
	const manager = {
		withRepository: jest.fn().mockReturnValue(transactionalUsersRepository),
		getRepository: jest.fn((entity: typeof User | typeof RefreshToken | typeof AuditLog) => {
			if (entity === User) return { createQueryBuilder: jest.fn().mockReturnValue(targetQuery) };
			if (entity === RefreshToken)
				return { createQueryBuilder: jest.fn().mockReturnValue(refreshQuery) };
			return { save: auditSave };
		}),
	} as unknown as EntityManager;

	return {
		transactionalSave,
		targetSetLock: targetQuery.setLock,
		refreshExecute,
		auditSave,
		execute: async <T>(callback: (entityManager: EntityManager) => Promise<T>): Promise<T> =>
			callback(manager),
	};
}
