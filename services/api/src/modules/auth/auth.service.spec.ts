import { ConflictException, Logger } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import type { DataSource, EntityManager } from "typeorm";
import { QueryFailedError } from "typeorm";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import type { UsersRepository } from "../users/users.repository";
import { AuthService } from "./auth.service";
import type { RegisterDto } from "./dto/register.dto";

jest.mock("bcrypt");

const BCRYPT_COST_FACTOR = 10;
const HASHED_PASSWORD = "$2b$10$mockedHashValueForTestingPurposesOnly";
const FIXED_DATE = new Date("2026-08-04T00:00:00.000Z");

type MockUsersRepository = {
	findByEmailOrPhone: jest.Mock;
	createUser: jest.Mock;
};

// Email and phone are both mandatory (business flow update) — a RegisterDto
// reaching AuthService always has both fields by the time it passes the
// controller's ValidationPipe, so every test below constructs a dto with
// both present rather than the old "email only / phone only" shapes.
function buildDto(overrides: Partial<RegisterDto> = {}): RegisterDto {
	return {
		email: "default@example.com",
		phone: "+84900000001",
		password: "plain-password",
		role: UserRole.CAMPER,
		...overrides,
	} as RegisterDto;
}

function buildUser(overrides: Record<string, unknown> = {}) {
	return {
		id: "11111111-1111-1111-1111-111111111111",
		email: "default@example.com",
		phone: "+84900000001",
		passwordHash: HASHED_PASSWORD,
		role: UserRole.CAMPER,
		status: UserStatus.PENDING_VERIFICATION,
		createdAt: FIXED_DATE,
		updatedAt: FIXED_DATE,
		...overrides,
	};
}

describe("AuthService.register", () => {
	let authService: AuthService;
	let usersRepository: MockUsersRepository;
	let transactionalUsersRepository: MockUsersRepository;
	let manager: { withRepository: jest.Mock };
	let dataSource: { transaction: jest.Mock };
	let loggerLogSpy: jest.SpyInstance;
	const bcryptHash = bcrypt.hash as unknown as jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();
		loggerLogSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);

		transactionalUsersRepository = { findByEmailOrPhone: jest.fn(), createUser: jest.fn() };
		manager = { withRepository: jest.fn().mockReturnValue(transactionalUsersRepository) };
		dataSource = {
			transaction: jest.fn(async (callback: (manager: EntityManager) => unknown) =>
				callback(manager as unknown as EntityManager)
			),
		};
		usersRepository = { findByEmailOrPhone: jest.fn(), createUser: jest.fn() };

		bcryptHash.mockResolvedValue(HASHED_PASSWORD);

		authService = new AuthService(
			usersRepository as unknown as UsersRepository,
			dataSource as unknown as DataSource
		);
	});

	afterEach(() => {
		loggerLogSpy.mockRestore();
	});

	// --- Success path (email and phone are both mandatory) -------------------

	it("registers successfully with email and phone", async () => {
		const dto = buildDto({ email: "host@example.com", phone: "+84987654321", role: UserRole.HOST });
		const createdUser = buildUser({
			email: "host@example.com",
			phone: "+84987654321",
			role: UserRole.HOST,
		});
		usersRepository.findByEmailOrPhone.mockResolvedValue(null);
		transactionalUsersRepository.createUser.mockResolvedValue(createdUser);

		const result = await authService.register(dto);

		expect(usersRepository.findByEmailOrPhone).toHaveBeenCalledTimes(1);
		expect(usersRepository.findByEmailOrPhone).toHaveBeenCalledWith(
			"host@example.com",
			"+84987654321"
		);
		expect(dataSource.transaction).toHaveBeenCalledTimes(1);
		expect(manager.withRepository).toHaveBeenCalledTimes(1);
		expect(manager.withRepository).toHaveBeenCalledWith(usersRepository);
		expect(transactionalUsersRepository.createUser).toHaveBeenCalledTimes(1);
		expect(transactionalUsersRepository.createUser).toHaveBeenCalledWith({
			email: "host@example.com",
			phone: "+84987654321",
			passwordHash: HASHED_PASSWORD,
			role: UserRole.HOST,
		});
		expect(result).toEqual({
			id: createdUser.id,
			email: "host@example.com",
			phone: "+84987654321",
			role: UserRole.HOST,
			status: UserStatus.PENDING_VERIFICATION,
			createdAt: FIXED_DATE,
		});
	});

	// --- Normalized-value propagation (normalization logic itself is
	// RegisterDto's responsibility, covered in Step 2's tests; this verifies
	// AuthService correctly propagates already-normalized values unchanged) --

	it("passes the already-normalized email and phone through unchanged to createUser", async () => {
		const normalizedEmail = "already.normalized@example.com";
		const normalizedPhone = "+84912345678";
		const dto = buildDto({ email: normalizedEmail, phone: normalizedPhone });
		usersRepository.findByEmailOrPhone.mockResolvedValue(null);
		transactionalUsersRepository.createUser.mockResolvedValue(
			buildUser({ email: normalizedEmail, phone: normalizedPhone })
		);

		await authService.register(dto);

		expect(usersRepository.findByEmailOrPhone).toHaveBeenCalledWith(
			normalizedEmail,
			normalizedPhone
		);
		expect(transactionalUsersRepository.createUser).toHaveBeenCalledWith(
			expect.objectContaining({ email: normalizedEmail, phone: normalizedPhone })
		);
	});

	// --- Duplicate detection --------------------------------------------

	it("throws ConflictException when both email and phone are provided but only email is duplicate", async () => {
		const dto = buildDto({ email: "dup@example.com", phone: "+84900000000" });
		usersRepository.findByEmailOrPhone.mockResolvedValue(buildUser({ email: "dup@example.com" }));

		await expect(authService.register(dto)).rejects.toBeInstanceOf(ConflictException);

		expect(usersRepository.findByEmailOrPhone).toHaveBeenCalledTimes(1);
		expect(usersRepository.findByEmailOrPhone).toHaveBeenCalledWith(
			"dup@example.com",
			"+84900000000"
		);
		expect(transactionalUsersRepository.createUser).not.toHaveBeenCalled();
	});

	it("throws ConflictException when both email and phone are provided but only phone is duplicate", async () => {
		const dto = buildDto({ email: "unique@example.com", phone: "+84900000000" });
		usersRepository.findByEmailOrPhone.mockResolvedValue(buildUser({ phone: "+84900000000" }));

		await expect(authService.register(dto)).rejects.toBeInstanceOf(ConflictException);

		expect(usersRepository.findByEmailOrPhone).toHaveBeenCalledWith(
			"unique@example.com",
			"+84900000000"
		);
		expect(transactionalUsersRepository.createUser).not.toHaveBeenCalled();
	});

	// --- Password hashing -------------------------------------------------

	it("hashes the password with bcrypt using cost factor 10 before persisting", async () => {
		const dto = buildDto({ email: "hash@example.com", phone: "+84911111111", password: "s3cret" });
		usersRepository.findByEmailOrPhone.mockResolvedValue(null);
		transactionalUsersRepository.createUser.mockResolvedValue(
			buildUser({ email: "hash@example.com", phone: "+84911111111" })
		);

		await authService.register(dto);

		expect(bcryptHash).toHaveBeenCalledTimes(1);
		expect(bcryptHash).toHaveBeenCalledWith("s3cret", BCRYPT_COST_FACTOR);
		expect(transactionalUsersRepository.createUser).toHaveBeenCalledWith(
			expect.objectContaining({ passwordHash: HASHED_PASSWORD })
		);
	});

	it("never includes passwordHash in the returned profile", async () => {
		const dto = buildDto({ email: "safe@example.com", phone: "+84922222222" });
		usersRepository.findByEmailOrPhone.mockResolvedValue(null);
		transactionalUsersRepository.createUser.mockResolvedValue(
			buildUser({ email: "safe@example.com", phone: "+84922222222", passwordHash: HASHED_PASSWORD })
		);

		const result = await authService.register(dto);

		expect(Object.hasOwn(result, "passwordHash")).toBe(false);
		expect(Object.keys(result).sort()).toEqual(
			["createdAt", "email", "id", "phone", "role", "status"].sort()
		);
	});

	// --- Postgres error mapping / race condition --------------------------

	it("maps a Postgres unique_violation (23505) thrown during insert to ConflictException", async () => {
		const dto = buildDto({ email: "race@example.com", phone: "+84933333333" });
		usersRepository.findByEmailOrPhone.mockResolvedValue(null);
		const uniqueViolationError = new QueryFailedError(
			'INSERT INTO "users" ...',
			undefined,
			Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" })
		);
		transactionalUsersRepository.createUser.mockRejectedValue(uniqueViolationError);

		const error = await authService.register(dto).catch((e) => e);

		expect(error).toBeInstanceOf(ConflictException);
		expect((error as ConflictException).getStatus()).toBe(409);
		expect(transactionalUsersRepository.createUser).toHaveBeenCalledTimes(1);
		expect(loggerLogSpy).not.toHaveBeenCalled();
	});

	it("propagates a non-unique-violation error from createUser without converting it to ConflictException", async () => {
		const dto = buildDto({ email: "dberror@example.com", phone: "+84944444444" });
		usersRepository.findByEmailOrPhone.mockResolvedValue(null);
		const connectionError = new Error("connection terminated unexpectedly");
		transactionalUsersRepository.createUser.mockRejectedValue(connectionError);

		const error = await authService.register(dto).catch((e) => e);

		expect(error).toBe(connectionError);
		expect(error).not.toBeInstanceOf(ConflictException);
		expect(loggerLogSpy).not.toHaveBeenCalled();
	});

	// --- Transaction rollback contract -------------------------------------

	it("propagates rejection when the transaction callback throws (rollback contract honored)", async () => {
		const dto = buildDto({ email: "rollback@example.com", phone: "+84955555555" });
		usersRepository.findByEmailOrPhone.mockResolvedValue(null);
		const txError = new Error("simulated transaction failure");
		transactionalUsersRepository.createUser.mockRejectedValue(txError);

		await expect(authService.register(dto)).rejects.toBe(txError);
		expect(dataSource.transaction).toHaveBeenCalledTimes(1);
		expect(loggerLogSpy).not.toHaveBeenCalled();
	});

	it("does not open a transaction or hash the password when a duplicate is found by the pre-check", async () => {
		const dto = buildDto({
			email: "skip@example.com",
			phone: "+84966666666",
			password: "should-not-be-hashed",
		});
		usersRepository.findByEmailOrPhone.mockResolvedValue(buildUser({ email: "skip@example.com" }));

		await expect(authService.register(dto)).rejects.toBeInstanceOf(ConflictException);

		expect(bcryptHash).not.toHaveBeenCalled();
		expect(dataSource.transaction).not.toHaveBeenCalled();
		expect(manager.withRepository).not.toHaveBeenCalled();
		expect(transactionalUsersRepository.createUser).not.toHaveBeenCalled();
	});
});
