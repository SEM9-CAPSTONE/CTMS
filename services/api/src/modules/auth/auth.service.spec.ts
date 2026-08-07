import { createHash, randomBytes, randomInt } from "node:crypto";
import {
	ConflictException,
	Logger,
	NotFoundException,
	UnauthorizedException,
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import type { DataSource, EntityManager } from "typeorm";
import { QueryFailedError } from "typeorm";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import type { UsersRepository } from "../users/users.repository";
import { AuthService } from "./auth.service";
import type { LoginDto } from "./dto/login.dto";
import type { RegisterDto } from "./dto/register.dto";
import { OtpChannel } from "./dto/send-otp.dto";
import type { SendOtpDto } from "./dto/send-otp.dto";
import type { VerifyOtpDto } from "./dto/verify-otp.dto";
import type { OtpDeliveryService } from "./otp-delivery.service";
import type { RefreshTokenRepository } from "./refresh-token.repository";
import type { VerificationOtpRepository } from "./verification-otp.repository";

jest.mock("bcrypt");
jest.mock("node:crypto");

const BCRYPT_COST_FACTOR = 10;
const HASHED_PASSWORD = "$2b$10$mockedHashValueForTestingPurposesOnly";
const HASHED_OTP = "$2b$10$mockedHashValueForOtpTestingOnly";
const FIXED_DATE = new Date("2026-08-04T00:00:00.000Z");

type MockUsersRepository = {
	findByEmailOrPhone: jest.Mock;
	createUser: jest.Mock;
};

type MockOtpRepository = {
	findOneBy: jest.Mock;
	save: jest.Mock;
};

type MockUsersRepositoryForVerify = {
	update: jest.Mock;
	findOneByOrFail: jest.Mock;
};

type MockOtpRepositoryForVerify = {
	findOneBy: jest.Mock;
	delete: jest.Mock;
};

/** Matches .env.example defaults (Step 2) — string, as ConfigService.get returns raw env strings. */
const OTP_CONFIG: Record<string, string> = {
	OTP_TTL_MINUTES: "10",
	OTP_RESEND_MAX_ATTEMPTS: "5",
	OTP_RESEND_WINDOW_MINUTES: "1440",
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

		// register() never touches the OTP repository, refresh tokens,
		// ConfigService, OtpDeliveryService, or JwtService — passed as empty
		// stubs purely to satisfy AuthService's constructor signature.
		authService = new AuthService(
			usersRepository as unknown as UsersRepository,
			{} as VerificationOtpRepository,
			{} as RefreshTokenRepository,
			dataSource as unknown as DataSource,
			{ get: jest.fn() } as unknown as ConfigService,
			{} as OtpDeliveryService,
			{} as JwtService
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

describe("AuthService.issueOtp", () => {
	let authService: AuthService;
	let usersRepository: MockUsersRepository;
	let otpRepository: MockOtpRepository;
	let transactionalOtpRepository: MockOtpRepository;
	let manager: { withRepository: jest.Mock };
	let dataSource: { transaction: jest.Mock };
	let configService: { get: jest.Mock };
	let loggerLogSpy: jest.SpyInstance;
	const bcryptHash = bcrypt.hash as unknown as jest.Mock;
	const cryptoRandomInt = randomInt as unknown as jest.Mock;

	const USER_ID = "11111111-1111-1111-1111-111111111111";
	const RAW_OTP = "654321";

	function buildOtpRow(overrides: Record<string, unknown> = {}) {
		return {
			userId: USER_ID,
			codeHash: "old-hash",
			expiresAt: new Date(Date.now() + 60_000),
			sendCount: 1,
			windowStartedAt: new Date(),
			...overrides,
		};
	}

	beforeEach(() => {
		jest.clearAllMocks();
		loggerLogSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);

		usersRepository = { findByEmailOrPhone: jest.fn(), createUser: jest.fn() };
		transactionalOtpRepository = { findOneBy: jest.fn(), save: jest.fn() };
		otpRepository = { findOneBy: jest.fn(), save: jest.fn() };
		manager = { withRepository: jest.fn().mockReturnValue(transactionalOtpRepository) };
		dataSource = {
			transaction: jest.fn(async (callback: (manager: EntityManager) => unknown) =>
				callback(manager as unknown as EntityManager)
			),
		};
		configService = { get: jest.fn((key: string) => OTP_CONFIG[key]) };

		bcryptHash.mockResolvedValue(HASHED_OTP);
		cryptoRandomInt.mockReturnValue(Number(RAW_OTP));

		authService = new AuthService(
			usersRepository as unknown as UsersRepository,
			otpRepository as unknown as VerificationOtpRepository,
			{} as RefreshTokenRepository, // issueOtp() never touches refresh tokens or JwtService
			dataSource as unknown as DataSource,
			configService as unknown as ConfigService,
			{} as OtpDeliveryService, // issueOtp() never delivers -- kept for tests only, see its docstring
			{} as JwtService
		);
	});

	afterEach(() => {
		loggerLogSpy.mockRestore();
	});

	// --- First issuance (no existing row) -----------------------------------

	it("creates a new row with sendCount 1 when no OTP exists yet for the user (BR-214, BR-220, AC1)", async () => {
		transactionalOtpRepository.findOneBy.mockResolvedValue(null);

		const before = Date.now();
		const result = await authService.issueOtp(USER_ID);
		const after = Date.now();

		expect(dataSource.transaction).toHaveBeenCalledTimes(1);
		expect(manager.withRepository).toHaveBeenCalledWith(otpRepository);
		expect(transactionalOtpRepository.save).toHaveBeenCalledTimes(1);

		const saved = transactionalOtpRepository.save.mock.calls[0][0];
		expect(saved.userId).toBe(USER_ID);
		expect(saved.sendCount).toBe(1);
		expect(saved.codeHash).toBe(HASHED_OTP);
		// BR-220: expiresAt must be later than the moment the row was created.
		expect(saved.expiresAt.getTime()).toBeGreaterThan(saved.windowStartedAt.getTime());
		// OTP_TTL_MINUTES=10 -> expiresAt ~= now + 10min, bounded to tolerate test execution time.
		const expectedExpiryMs = 10 * 60_000;
		expect(saved.expiresAt.getTime() - before).toBeGreaterThanOrEqual(expectedExpiryMs - 1000);
		expect(saved.expiresAt.getTime() - after).toBeLessThanOrEqual(expectedExpiryMs + 1000);

		expect(result).toBe(RAW_OTP);
	});

	it("never persists the raw OTP, only the bcrypt hash (Decision Gate v2 assumption #6)", async () => {
		transactionalOtpRepository.findOneBy.mockResolvedValue(null);

		await authService.issueOtp(USER_ID);

		const saved = transactionalOtpRepository.save.mock.calls[0][0];
		expect(saved.codeHash).toBe(HASHED_OTP);
		expect(Object.values(saved)).not.toContain(RAW_OTP);
		expect(bcryptHash).toHaveBeenCalledWith(RAW_OTP, BCRYPT_COST_FACTOR);
	});

	// --- Resend within window, under the limit (BR-007, AC2) ----------------

	it("increments sendCount and regenerates the code on resend within the window and under the limit", async () => {
		const existing = buildOtpRow({ sendCount: 2, windowStartedAt: new Date(Date.now() - 60_000) });
		transactionalOtpRepository.findOneBy.mockResolvedValue(existing);

		const result = await authService.issueOtp(USER_ID);

		expect(transactionalOtpRepository.save).toHaveBeenCalledTimes(1);
		const saved = transactionalOtpRepository.save.mock.calls[0][0];
		expect(saved.sendCount).toBe(3);
		expect(saved.codeHash).toBe(HASHED_OTP);
		// windowStartedAt must NOT reset while still inside the window.
		expect(saved.windowStartedAt).toBe(existing.windowStartedAt);
		expect(result).toBe(RAW_OTP);
	});

	// --- Resend limit reached within window (BR-007, AC2, BR-243) -----------

	it("throws ConflictException and does not save when sendCount already reached the limit within the window", async () => {
		const existing = buildOtpRow({
			sendCount: 5,
			windowStartedAt: new Date(Date.now() - 60_000),
		});
		transactionalOtpRepository.findOneBy.mockResolvedValue(existing);

		const error = await authService.issueOtp(USER_ID).catch((e) => e);

		expect(error).toBeInstanceOf(ConflictException);
		expect((error as ConflictException).getStatus()).toBe(409);
		// BR-243: no side effect when the business condition is not met.
		expect(transactionalOtpRepository.save).not.toHaveBeenCalled();
	});

	// --- Window elapsed -> counter resets (BR-007, AC2) ----------------------

	it("resets sendCount to 1 and restarts the window when the previous window has elapsed", async () => {
		const windowMinutes = Number(OTP_CONFIG.OTP_RESEND_WINDOW_MINUTES);
		const elapsedWindowStart = new Date(Date.now() - (windowMinutes * 60_000 + 60_000));
		const existing = buildOtpRow({ sendCount: 5, windowStartedAt: elapsedWindowStart });
		transactionalOtpRepository.findOneBy.mockResolvedValue(existing);

		const result = await authService.issueOtp(USER_ID);

		const saved = transactionalOtpRepository.save.mock.calls[0][0];
		expect(saved.sendCount).toBe(1);
		expect(saved.windowStartedAt).not.toBe(elapsedWindowStart);
		expect(saved.windowStartedAt.getTime()).toBeGreaterThan(elapsedWindowStart.getTime());
		expect(result).toBe(RAW_OTP);
	});

	// --- Transaction usage (BR-230: no duplicate record on concurrent retry) -

	it("performs the read-then-write inside a single transaction", async () => {
		transactionalOtpRepository.findOneBy.mockResolvedValue(null);

		await authService.issueOtp(USER_ID);

		expect(dataSource.transaction).toHaveBeenCalledTimes(1);
		expect(transactionalOtpRepository.findOneBy).toHaveBeenCalledWith({ userId: USER_ID });
	});
});

describe("AuthService.verifyOtp", () => {
	let authService: AuthService;
	let usersRepository: MockUsersRepository;
	let otpRepository: { findOneBy: jest.Mock };
	let transactionalUsersRepository: MockUsersRepositoryForVerify;
	let transactionalOtpRepository: MockOtpRepositoryForVerify;
	let manager: { withRepository: jest.Mock };
	let dataSource: { transaction: jest.Mock };
	let loggerLogSpy: jest.SpyInstance;
	const bcryptCompare = bcrypt.compare as unknown as jest.Mock;

	const USER_ID = "11111111-1111-1111-1111-111111111111";
	const SUBMITTED_CODE = "654321";

	function buildDto(overrides: Partial<VerifyOtpDto> = {}): VerifyOtpDto {
		return { userId: USER_ID, code: SUBMITTED_CODE, ...overrides } as VerifyOtpDto;
	}

	function buildOtpRow(overrides: Record<string, unknown> = {}) {
		return {
			userId: USER_ID,
			codeHash: HASHED_OTP,
			expiresAt: new Date(Date.now() + 60_000),
			sendCount: 1,
			windowStartedAt: new Date(Date.now() - 60_000),
			...overrides,
		};
	}

	beforeEach(() => {
		jest.clearAllMocks();
		loggerLogSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);

		usersRepository = { findByEmailOrPhone: jest.fn(), createUser: jest.fn() };
		otpRepository = { findOneBy: jest.fn() };
		transactionalUsersRepository = { update: jest.fn(), findOneByOrFail: jest.fn() };
		transactionalOtpRepository = { findOneBy: jest.fn(), delete: jest.fn() };
		manager = {
			withRepository: jest.fn((repo: unknown) =>
				repo === usersRepository ? transactionalUsersRepository : transactionalOtpRepository
			),
		};
		dataSource = {
			transaction: jest.fn(async (callback: (manager: EntityManager) => unknown) =>
				callback(manager as unknown as EntityManager)
			),
		};

		bcryptCompare.mockResolvedValue(true);

		authService = new AuthService(
			usersRepository as unknown as UsersRepository,
			otpRepository as unknown as VerificationOtpRepository,
			{} as RefreshTokenRepository, // verifyOtp() never touches refresh tokens or JwtService
			dataSource as unknown as DataSource,
			{ get: jest.fn() } as unknown as ConfigService,
			{} as OtpDeliveryService, // verifyOtp() is channel-agnostic, never delivers
			{} as JwtService
		);
	});

	afterEach(() => {
		loggerLogSpy.mockRestore();
	});

	// --- Success path (AC3, BR-207) ------------------------------------------

	it("activates the user and deletes the OTP row when the code matches and is not expired", async () => {
		const otp = buildOtpRow();
		otpRepository.findOneBy.mockResolvedValue(otp);
		const activatedUser = buildUser({ status: UserStatus.ACTIVE });
		transactionalUsersRepository.findOneByOrFail.mockResolvedValue(activatedUser);

		const result = await authService.verifyOtp(buildDto());

		expect(otpRepository.findOneBy).toHaveBeenCalledWith({ userId: USER_ID });
		expect(bcryptCompare).toHaveBeenCalledWith(SUBMITTED_CODE, otp.codeHash);
		expect(dataSource.transaction).toHaveBeenCalledTimes(1);
		expect(transactionalUsersRepository.update).toHaveBeenCalledWith(USER_ID, {
			status: UserStatus.ACTIVE,
		});
		expect(transactionalOtpRepository.delete).toHaveBeenCalledWith({ userId: USER_ID });
		expect(transactionalUsersRepository.findOneByOrFail).toHaveBeenCalledWith({ id: USER_ID });
		expect(result).toEqual({
			id: activatedUser.id,
			email: activatedUser.email,
			phone: activatedUser.phone,
			role: activatedUser.role,
			status: UserStatus.ACTIVE,
			createdAt: activatedUser.createdAt,
		});
	});

	it("never includes passwordHash in the returned profile", async () => {
		otpRepository.findOneBy.mockResolvedValue(buildOtpRow());
		transactionalUsersRepository.findOneByOrFail.mockResolvedValue(
			buildUser({ status: UserStatus.ACTIVE, passwordHash: HASHED_PASSWORD })
		);

		const result = await authService.verifyOtp(buildDto());

		expect(Object.hasOwn(result, "passwordHash")).toBe(false);
		expect(Object.keys(result).sort()).toEqual(
			["createdAt", "email", "id", "phone", "role", "status"].sort()
		);
	});

	// --- Not found (AC3, BR-231: 404) ----------------------------------------

	it("throws NotFoundException when no OTP row exists for the userId", async () => {
		otpRepository.findOneBy.mockResolvedValue(null);

		const error = await authService.verifyOtp(buildDto()).catch((e) => e);

		expect(error).toBeInstanceOf(NotFoundException);
		expect((error as NotFoundException).getStatus()).toBe(404);
		// BR-243: no side effect.
		expect(bcryptCompare).not.toHaveBeenCalled();
		expect(dataSource.transaction).not.toHaveBeenCalled();
	});

	// --- Expired (AC3, BR-231: 409) ------------------------------------------

	it("throws ConflictException and does not compare the code when the OTP is expired", async () => {
		otpRepository.findOneBy.mockResolvedValue(
			buildOtpRow({ expiresAt: new Date(Date.now() - 1000) })
		);

		const error = await authService.verifyOtp(buildDto()).catch((e) => e);

		expect(error).toBeInstanceOf(ConflictException);
		expect((error as ConflictException).getStatus()).toBe(409);
		// BR-243: no side effect — code comparison and the transaction never run.
		expect(bcryptCompare).not.toHaveBeenCalled();
		expect(dataSource.transaction).not.toHaveBeenCalled();
	});

	// --- Incorrect code (AC3, BR-231: 409, BR-243) ---------------------------

	it("throws ConflictException and does not open a transaction when the OTP code is incorrect", async () => {
		otpRepository.findOneBy.mockResolvedValue(buildOtpRow());
		bcryptCompare.mockResolvedValue(false);

		const error = await authService.verifyOtp(buildDto()).catch((e) => e);

		expect(error).toBeInstanceOf(ConflictException);
		expect((error as ConflictException).getStatus()).toBe(409);
		// BR-243: no side effect.
		expect(dataSource.transaction).not.toHaveBeenCalled();
	});
});

describe("AuthService.sendOtp", () => {
	let authService: AuthService;
	let usersRepository: { findOneByOrFail: jest.Mock };
	let otpRepository: MockOtpRepository;
	let transactionalOtpRepository: MockOtpRepository;
	let manager: { withRepository: jest.Mock };
	let dataSource: { transaction: jest.Mock };
	let configService: { get: jest.Mock };
	let otpDeliveryService: { send: jest.Mock };
	let loggerLogSpy: jest.SpyInstance;
	const bcryptHash = bcrypt.hash as unknown as jest.Mock;
	const cryptoRandomInt = randomInt as unknown as jest.Mock;

	const USER_ID = "11111111-1111-1111-1111-111111111111";
	const RAW_OTP = "654321";

	function buildDto(overrides: Partial<SendOtpDto> = {}): SendOtpDto {
		return { userId: USER_ID, channel: OtpChannel.PHONE, ...overrides } as SendOtpDto;
	}

	beforeEach(() => {
		jest.clearAllMocks();
		loggerLogSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);

		usersRepository = { findOneByOrFail: jest.fn() };
		transactionalOtpRepository = { findOneBy: jest.fn(), save: jest.fn() };
		otpRepository = { findOneBy: jest.fn(), save: jest.fn() };
		manager = { withRepository: jest.fn().mockReturnValue(transactionalOtpRepository) };
		dataSource = {
			transaction: jest.fn(async (callback: (manager: EntityManager) => unknown) =>
				callback(manager as unknown as EntityManager)
			),
		};
		configService = { get: jest.fn((key: string) => OTP_CONFIG[key]) };
		otpDeliveryService = { send: jest.fn().mockResolvedValue(undefined) };

		bcryptHash.mockResolvedValue(HASHED_OTP);
		cryptoRandomInt.mockReturnValue(Number(RAW_OTP));
		transactionalOtpRepository.findOneBy.mockResolvedValue(null); // default: first issuance

		authService = new AuthService(
			usersRepository as unknown as UsersRepository,
			otpRepository as unknown as VerificationOtpRepository,
			{} as RefreshTokenRepository, // sendOtp() never touches refresh tokens or JwtService
			dataSource as unknown as DataSource,
			configService as unknown as ConfigService,
			otpDeliveryService as unknown as OtpDeliveryService,
			{} as JwtService
		);
	});

	afterEach(() => {
		loggerLogSpy.mockRestore();
	});

	// --- Generate -> Deliver -> Persist, success path -----------------------

	it("delivers via the phone channel to the user's phone, then persists, then returns the profile", async () => {
		const user = buildUser({ status: UserStatus.PENDING_VERIFICATION });
		usersRepository.findOneByOrFail.mockResolvedValue(user);

		const result = await authService.sendOtp(buildDto({ channel: OtpChannel.PHONE }));

		expect(usersRepository.findOneByOrFail).toHaveBeenCalledWith({ id: USER_ID });
		expect(otpDeliveryService.send).toHaveBeenCalledWith(
			OtpChannel.PHONE,
			{ email: user.email, phone: user.phone },
			RAW_OTP
		);
		expect(transactionalOtpRepository.save).toHaveBeenCalledTimes(1);
		const saved = transactionalOtpRepository.save.mock.calls[0][0];
		expect(saved.userId).toBe(USER_ID);
		expect(saved.sendCount).toBe(1);
		expect(saved.codeHash).toBe(HASHED_OTP);
		expect(result).toEqual({
			id: user.id,
			email: user.email,
			phone: user.phone,
			role: user.role,
			status: user.status,
			createdAt: user.createdAt,
		});

		// Deliver must happen before Persist, not after.
		const deliverOrder = otpDeliveryService.send.mock.invocationCallOrder[0];
		const persistOrder = transactionalOtpRepository.save.mock.invocationCallOrder[0];
		expect(deliverOrder).toBeLessThan(persistOrder);
	});

	it("delivers via the email channel to the user's email", async () => {
		const user = buildUser({ email: "camper@example.com", phone: "+84900000001" });
		usersRepository.findOneByOrFail.mockResolvedValue(user);

		await authService.sendOtp(buildDto({ channel: OtpChannel.EMAIL }));

		expect(otpDeliveryService.send).toHaveBeenCalledWith(
			OtpChannel.EMAIL,
			{ email: user.email, phone: user.phone },
			RAW_OTP
		);
	});

	it("increments sendCount on a resend within the window and under the limit, same as issueOtp", async () => {
		const existing = {
			userId: USER_ID,
			codeHash: "old-hash",
			expiresAt: new Date(Date.now() + 60_000),
			sendCount: 2,
			windowStartedAt: new Date(Date.now() - 60_000),
		};
		transactionalOtpRepository.findOneBy.mockResolvedValue(existing);
		usersRepository.findOneByOrFail.mockResolvedValue(buildUser());

		await authService.sendOtp(buildDto());

		const saved = transactionalOtpRepository.save.mock.calls[0][0];
		expect(saved.sendCount).toBe(3);
	});

	// --- Resend limit reached: never even attempts delivery (BR-007, BR-243) -

	it("throws before attempting delivery when the resend limit was already reached", async () => {
		const existing = {
			userId: USER_ID,
			codeHash: "old-hash",
			expiresAt: new Date(Date.now() + 60_000),
			sendCount: 5,
			windowStartedAt: new Date(Date.now() - 60_000),
		};
		transactionalOtpRepository.findOneBy.mockResolvedValue(existing);
		usersRepository.findOneByOrFail.mockResolvedValue(buildUser());

		const error = await authService.sendOtp(buildDto()).catch((e) => e);

		expect(error).toBeInstanceOf(ConflictException);
		expect(otpDeliveryService.send).not.toHaveBeenCalled();
		expect(transactionalOtpRepository.save).not.toHaveBeenCalled();
	});

	// --- Dispatch failure: the whole point of the Generate -> Deliver ->
	// Persist ordering (Tech Lead requirement) — send_count must NOT be
	// consumed when the provider fails, so the user doesn't lose an attempt
	// to a Twilio/SMTP outage they never caused. ----------------------------

	it("does not persist (no send_count increment) when delivery fails", async () => {
		const deliveryError = new Error("Twilio: Invalid 'To' Phone Number");
		otpDeliveryService.send.mockRejectedValue(deliveryError);
		usersRepository.findOneByOrFail.mockResolvedValue(buildUser());

		const error = await authService.sendOtp(buildDto()).catch((e) => e);

		expect(error).toBe(deliveryError);
		expect(transactionalOtpRepository.save).not.toHaveBeenCalled();
	});

	it("propagates the delivery error unchanged to the caller", async () => {
		const deliveryError = new Error("Resend: Invalid from address");
		otpDeliveryService.send.mockRejectedValue(deliveryError);
		usersRepository.findOneByOrFail.mockResolvedValue(buildUser());

		await expect(authService.sendOtp(buildDto({ channel: OtpChannel.EMAIL }))).rejects.toBe(
			deliveryError
		);
	});

	// --- No OTP exposure ------------------------------------------------

	it("never exposes the raw OTP anywhere in the returned profile", async () => {
		usersRepository.findOneByOrFail.mockResolvedValue(buildUser());

		const result = await authService.sendOtp(buildDto());

		expect(Object.values(result)).not.toContain(RAW_OTP);
	});
});

describe("AuthService.login", () => {
	let authService: AuthService;
	let usersRepository: { findByEmailOrPhone: jest.Mock };
	let refreshTokenRepository: { save: jest.Mock };
	let transactionalRefreshTokenRepository: { save: jest.Mock };
	let manager: { withRepository: jest.Mock };
	let dataSource: { transaction: jest.Mock };
	let configService: { get: jest.Mock };
	let jwtService: { sign: jest.Mock };
	let loggerLogSpy: jest.SpyInstance;
	const bcryptCompare = bcrypt.compare as unknown as jest.Mock;
	const cryptoRandomBytes = randomBytes as unknown as jest.Mock;
	const cryptoCreateHash = createHash as unknown as jest.Mock;

	const USER_ID = "11111111-1111-1111-1111-111111111111";
	const RAW_REFRESH_TOKEN = "raw-refresh-token-hex-value";
	const TOKEN_HASH = "sha256-hash-hex-value";
	const ACCESS_TOKEN = "signed.jwt.token";

	function buildDto(overrides: Partial<LoginDto> = {}): LoginDto {
		return {
			identifier: "camper@example.com",
			password: "correct-password",
			...overrides,
		} as LoginDto;
	}

	function buildActiveUser(overrides: Record<string, unknown> = {}) {
		return buildUser({ id: USER_ID, status: UserStatus.ACTIVE, ...overrides });
	}

	beforeEach(() => {
		jest.clearAllMocks();
		loggerLogSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);

		usersRepository = { findByEmailOrPhone: jest.fn() };
		transactionalRefreshTokenRepository = { save: jest.fn() };
		refreshTokenRepository = { save: jest.fn() };
		manager = { withRepository: jest.fn().mockReturnValue(transactionalRefreshTokenRepository) };
		dataSource = {
			transaction: jest.fn(async (callback: (manager: EntityManager) => unknown) =>
				callback(manager as unknown as EntityManager)
			),
		};
		configService = {
			get: jest.fn((key: string) => (key === "JWT_REFRESH_TOKEN_TTL" ? "7d" : undefined)),
		};
		jwtService = { sign: jest.fn().mockReturnValue(ACCESS_TOKEN) };

		bcryptCompare.mockResolvedValue(true);
		cryptoRandomBytes.mockReturnValue({ toString: () => RAW_REFRESH_TOKEN });
		cryptoCreateHash.mockReturnValue({
			update: jest.fn().mockReturnThis(),
			digest: jest.fn().mockReturnValue(TOKEN_HASH),
		});

		authService = new AuthService(
			usersRepository as unknown as UsersRepository,
			{} as VerificationOtpRepository,
			refreshTokenRepository as unknown as RefreshTokenRepository,
			dataSource as unknown as DataSource,
			configService as unknown as ConfigService,
			{} as OtpDeliveryService, // login() never delivers OTP
			jwtService as unknown as JwtService
		);
	});

	afterEach(() => {
		loggerLogSpy.mockRestore();
	});

	// --- Success path (AC1, BR-009) -----------------------------------------

	it("returns access token, raw refresh token, and user profile on correct credentials", async () => {
		const user = buildActiveUser();
		usersRepository.findByEmailOrPhone.mockResolvedValue(user);

		const result = await authService.login(buildDto());

		expect(result).toEqual({
			accessToken: ACCESS_TOKEN,
			refreshToken: RAW_REFRESH_TOKEN,
			user: {
				id: user.id,
				email: user.email,
				phone: user.phone,
				role: user.role,
				status: user.status,
				createdAt: user.createdAt,
			},
		});
	});

	// --- Identifier normalization / findByEmailOrPhone reuse (BR-215) --------

	it("looks up the user with the same normalized value as both email and phone candidates when given an email", async () => {
		usersRepository.findByEmailOrPhone.mockResolvedValue(buildActiveUser());

		await authService.login(buildDto({ identifier: "camper@example.com" }));

		// normalizeVietnamPhone() is a no-op on a non-VN-phone-shaped string,
		// so both candidates end up identical here -- proving the same raw
		// identifier is threaded through both normalizers, not just one.
		expect(usersRepository.findByEmailOrPhone).toHaveBeenCalledWith(
			"camper@example.com",
			"camper@example.com"
		);
	});

	it("normalizes a local-format phone identifier to E.164 before lookup", async () => {
		usersRepository.findByEmailOrPhone.mockResolvedValue(buildActiveUser());

		await authService.login(buildDto({ identifier: "0912345678" }));

		expect(usersRepository.findByEmailOrPhone).toHaveBeenCalledWith(
			"0912345678", // normalizeEmail() is trim+lowercase only, a no-op here
			"+84912345678" // normalizeVietnamPhone() converts local -> E.164
		);
	});

	// --- Unknown identifier (AC2, BR-010) -------------------------------------

	it("throws UnauthorizedException and never compares a password when the identifier matches no user", async () => {
		usersRepository.findByEmailOrPhone.mockResolvedValue(null);

		const error = await authService.login(buildDto()).catch((e) => e);

		expect(error).toBeInstanceOf(UnauthorizedException);
		expect(bcryptCompare).not.toHaveBeenCalled();
		expect(dataSource.transaction).not.toHaveBeenCalled();
	});

	// --- Non-active accounts (AC3, BR-202) ------------------------------------

	it.each([UserStatus.PENDING_VERIFICATION, UserStatus.SUSPENDED, UserStatus.DELETED])(
		"throws UnauthorizedException and never compares a password when account status is %s",
		async (status) => {
			usersRepository.findByEmailOrPhone.mockResolvedValue(buildActiveUser({ status }));

			const error = await authService.login(buildDto()).catch((e) => e);

			expect(error).toBeInstanceOf(UnauthorizedException);
			expect(bcryptCompare).not.toHaveBeenCalled();
			expect(dataSource.transaction).not.toHaveBeenCalled();
		}
	);

	// --- Wrong password (AC2, BR-010, BR-243: no side effect) -----------------

	it("throws UnauthorizedException and creates no refresh token when the password is wrong", async () => {
		usersRepository.findByEmailOrPhone.mockResolvedValue(buildActiveUser());
		bcryptCompare.mockResolvedValue(false);

		const error = await authService.login(buildDto()).catch((e) => e);

		expect(error).toBeInstanceOf(UnauthorizedException);
		expect(dataSource.transaction).not.toHaveBeenCalled();
		// Tech Lead requirement: a rejected login must not spend random bytes
		// generating a refresh token that will never be used.
		expect(cryptoRandomBytes).not.toHaveBeenCalled();
	});

	it("uses the same error message for an unknown identifier and a wrong password (no enumeration)", async () => {
		usersRepository.findByEmailOrPhone.mockResolvedValueOnce(null);
		const notFoundError = await authService.login(buildDto()).catch((e) => e);

		usersRepository.findByEmailOrPhone.mockResolvedValueOnce(buildActiveUser());
		bcryptCompare.mockResolvedValueOnce(false);
		const wrongPasswordError = await authService.login(buildDto()).catch((e) => e);

		expect(notFoundError.message).toBe(wrongPasswordError.message);
	});

	// --- Ordering (Tech Lead review) ------------------------------------------

	it("generates the refresh token only after the password check succeeds", async () => {
		usersRepository.findByEmailOrPhone.mockResolvedValue(buildActiveUser());

		await authService.login(buildDto());

		const compareOrder = bcryptCompare.mock.invocationCallOrder[0];
		const randomBytesOrder = cryptoRandomBytes.mock.invocationCallOrder[0];
		expect(compareOrder).toBeLessThan(randomBytesOrder);
	});

	it("signs the access JWT only after the refresh-token transaction has committed", async () => {
		usersRepository.findByEmailOrPhone.mockResolvedValue(buildActiveUser());

		await authService.login(buildDto());

		const transactionOrder = dataSource.transaction.mock.invocationCallOrder[0];
		const signOrder = jwtService.sign.mock.invocationCallOrder[0];
		expect(transactionOrder).toBeLessThan(signOrder);
	});

	// --- Refresh token never stored raw ---------------------------------------

	it("persists only the hashed refresh token, never the raw value", async () => {
		usersRepository.findByEmailOrPhone.mockResolvedValue(buildActiveUser());

		await authService.login(buildDto());

		expect(transactionalRefreshTokenRepository.save).toHaveBeenCalledWith(
			expect.objectContaining({ tokenHash: TOKEN_HASH })
		);
		const saved = transactionalRefreshTokenRepository.save.mock.calls[0][0];
		expect(Object.values(saved)).not.toContain(RAW_REFRESH_TOKEN);
	});

	// --- JWT claims (Decision Gate D8: minimal, roles as an array) ------------

	it("signs the access token with sub and roles claims", async () => {
		const user = buildActiveUser({ role: UserRole.HOST });
		usersRepository.findByEmailOrPhone.mockResolvedValue(user);

		await authService.login(buildDto());

		expect(jwtService.sign).toHaveBeenCalledWith({ sub: user.id, roles: [UserRole.HOST] });
	});

	// --- No secret exposure in logs -------------------------------------------

	it("never logs the password or any token value", async () => {
		usersRepository.findByEmailOrPhone.mockResolvedValue(buildActiveUser());

		await authService.login(buildDto({ password: "super-secret-password" }));

		for (const call of loggerLogSpy.mock.calls) {
			const serialized = JSON.stringify(call);
			expect(serialized).not.toContain("super-secret-password");
			expect(serialized).not.toContain(RAW_REFRESH_TOKEN);
			expect(serialized).not.toContain(ACCESS_TOKEN);
		}
	});
});
