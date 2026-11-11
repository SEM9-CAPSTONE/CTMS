import { UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { type User, UserRole, UserStatus } from "../users/entities/user.entity";
import type { UsersRepository } from "../users/users.repository";
import { JwtStrategy } from "./jwt.strategy";

function buildConfigService(secret = "test-secret"): ConfigService {
	return { get: jest.fn().mockReturnValue(secret) } as unknown as ConfigService;
}

function buildUser(overrides: Partial<User> = {}): User {
	return {
		id: "11111111-1111-1111-1111-111111111111",
		email: "camper@example.com",
		phone: null,
		passwordHash: "hash",
		role: UserRole.CAMPER,
		status: UserStatus.ACTIVE,
		fullName: null,
		dateOfBirth: null,
		gender: null,
		address: null,
		bio: null,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		...overrides,
	};
}

function buildUsersRepository(user: User | null): UsersRepository {
	return {
		findOneWithRolesById: jest.fn().mockResolvedValue(user),
		getGrantedRoles: jest.fn(
			(dbUser: User) =>
				dbUser.roleAssignments?.map((assignment) => assignment.role) ?? [dbUser.role]
		),
	} as unknown as UsersRepository;
}

describe("JwtStrategy.validate", () => {
	it("loads current role and status from the database instead of trusting JWT claims", async () => {
		const user = buildUser({
			role: UserRole.CAMPER,
			roleAssignments: [
				{ userId: "11111111-1111-1111-1111-111111111111", role: UserRole.CAMPER },
				{ userId: "11111111-1111-1111-1111-111111111111", role: UserRole.HOST },
			] as never,
		});
		const strategy = new JwtStrategy(buildConfigService(), buildUsersRepository(user));

		const result = await strategy.validate({
			sub: "11111111-1111-1111-1111-111111111111",
			roles: ["porter"],
		});

		expect(result).toEqual({
			userId: user.id,
			roles: [UserRole.CAMPER, UserRole.HOST],
			status: UserStatus.ACTIVE,
		});
	});

	it.each([UserStatus.PENDING_VERIFICATION, UserStatus.SUSPENDED, UserStatus.DELETED])(
		"rejects an account with status %s",
		async (status) => {
			const strategy = new JwtStrategy(
				buildConfigService(),
				buildUsersRepository(buildUser({ status }))
			);

			await expect(
				strategy.validate({ sub: "11111111-1111-1111-1111-111111111111", roles: ["admin"] })
			).rejects.toBeInstanceOf(UnauthorizedException);
		}
	);

	it("rejects a token whose account no longer exists", async () => {
		const strategy = new JwtStrategy(buildConfigService(), buildUsersRepository(null));

		await expect(
			strategy.validate({ sub: "11111111-1111-1111-1111-111111111111", roles: ["admin"] })
		).rejects.toBeInstanceOf(UnauthorizedException);
	});
});
