import { createHash, randomBytes, randomInt } from "node:crypto";
import {
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
	UnauthorizedException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { ConfigService } from "@nestjs/config";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import ms from "ms";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource, type EntityManager } from "typeorm";
import { isUniqueViolation } from "../../shared/database/postgres-error-codes";
import { normalizeEmail, normalizeVietnamPhone } from "../../shared/utils/normalize.util";
import { UserStatus } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { UsersRepository } from "../users/users.repository";
import type { ForgotPasswordResponseDto } from "./dto/forgot-password-response.dto";
import type { ForgotPasswordDto } from "./dto/forgot-password.dto";
import type { LoginResponseDto } from "./dto/login-response.dto";
import type { LoginDto } from "./dto/login.dto";
import type { RegisterDto } from "./dto/register.dto";
import type { ResetPasswordResponseDto } from "./dto/reset-password-response.dto";
import type { ResetPasswordDto } from "./dto/reset-password.dto";
import type { SendOtpDto } from "./dto/send-otp.dto";
import { type UserProfileDto, toUserProfile } from "./dto/user-profile.dto";
import type { VerifyOtpDto } from "./dto/verify-otp.dto";
import { AuditLog } from "./entities/audit-log.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { OtpDeliveryService } from "./otp-delivery.service";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { RefreshTokenRepository } from "./refresh-token.repository";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { VerificationOtpRepository } from "./verification-otp.repository";

/** Exported so the dev-only admin seed script (src/seeds/dev-admin.seed.ts)
 * hashes with the exact same cost factor as Register, per its requirement
 * to reuse Register's hashing flow rather than duplicate the constant. */
export const BCRYPT_COST_FACTOR = 10;
const DUPLICATE_CONTACT_MESSAGE = "Email or phone already registered";
const RESEND_LIMIT_MESSAGE = "OTP resend limit reached, try again later";
const OTP_NOT_FOUND_MESSAGE = "No pending OTP found for this account";
const OTP_EXPIRED_MESSAGE = "OTP has expired";
const OTP_INCORRECT_MESSAGE = "Incorrect OTP";
const RESET_CREDENTIAL_NOT_FOUND_MESSAGE = "No pending reset credential found";
const RESET_CREDENTIAL_EXPIRED_MESSAGE = "Reset credential has expired";
const RESET_CREDENTIAL_INCORRECT_MESSAGE = "Incorrect reset credential";
/** BR-010: same message for "no such account" and "wrong password" — a
 * different message would let a caller enumerate which identifiers exist. */
const INVALID_CREDENTIALS_MESSAGE = "Invalid credentials";
/** Deliberately one message for all three non-ACTIVE statuses (pending_verification,
 * suspended, deleted) rather than inventing per-status copy the spec never specifies. */
const ACCOUNT_NOT_ACTIVE_MESSAGE = "Account is not active";

/**
 * Implementation Assumption (NOT part of the API/request contract — see Step 3
 * review "Contract-shaping Assumption" analysis): 6-digit numeric OTP. This is
 * the single source of truth for the format; verify (Step 5) must reuse it
 * rather than re-declaring a format anywhere else. Changing it later touches
 * only this function, not any DTO or published contract.
 */
function generateOtpCode(): string {
	return randomInt(100000, 1000000).toString();
}

/** What an OTP row would become on the next issuance — computed but not yet
 * written. Lets "decide the next state" and "write the next state" be two
 * separate, orderable steps instead of one inline computation. */
interface OtpPlan {
	code: string;
	codeHash: string;
	expiresAt: Date;
	sendCount: number;
	windowStartedAt: Date;
}

@Injectable()
export class AuthService {
	private readonly logger = new Logger(AuthService.name);

	constructor(
		private readonly usersRepository: UsersRepository,
		private readonly verificationOtpRepository: VerificationOtpRepository,
		private readonly refreshTokenRepository: RefreshTokenRepository,
		private readonly dataSource: DataSource,
		private readonly configService: ConfigService,
		private readonly otpDeliveryService: OtpDeliveryService,
		private readonly jwtService: JwtService
	) {}

	async register(dto: RegisterDto): Promise<UserProfileDto> {
		const email = dto.email ?? null;
		const phone = dto.phone ?? null;

		const existing = await this.usersRepository.findByEmailOrPhone(email, phone);
		if (existing) {
			throw new ConflictException(DUPLICATE_CONTACT_MESSAGE);
		}

		const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST_FACTOR);

		const user = await this.dataSource.transaction(async (manager) => {
			const transactionalUsersRepository = manager.withRepository(this.usersRepository);

			try {
				return await transactionalUsersRepository.createUser({
					email,
					phone,
					passwordHash,
					role: dto.role,
				});
			} catch (error) {
				if (isUniqueViolation(error)) {
					throw new ConflictException(DUPLICATE_CONTACT_MESSAGE);
				}
				throw error;
			}
		});

		this.logger.log(`User registered: ${user.id}`);

		return toUserProfile(user);
	}

	/**
	 * Decides what the next OTP issuance for `userId` would look like, without
	 * writing anything — a pure computation against the transactional
	 * snapshot, read-only except for the in-memory bcrypt hash. Shared by
	 * issueOtp() (immediate persist, used directly by tests) and sendOtp()
	 * (persist only after a successful delivery).
	 *
	 * BR-006/AC1: expiresAt = now + OTP_TTL_MINUTES.
	 * BR-007/AC2: sendCount is capped at OTP_RESEND_MAX_ATTEMPTS within a
	 * rolling OTP_RESEND_WINDOW_MINUTES window; the very first issuance for a
	 * user is not counted as a "resend" and always succeeds. Throws
	 * ConflictException *before* any delivery is attempted if the limit was
	 * already reached — no point paying for an SMS/email that can't count.
	 */
	private async planOtp(
		transactionalOtpRepository: VerificationOtpRepository,
		userId: string
	): Promise<OtpPlan> {
		const ttlMinutes = Number(this.configService.get<string>("OTP_TTL_MINUTES"));
		const windowMinutes = Number(this.configService.get<string>("OTP_RESEND_WINDOW_MINUTES"));
		const maxAttempts = Number(this.configService.get<string>("OTP_RESEND_MAX_ATTEMPTS"));

		const code = generateOtpCode();
		const codeHash = await bcrypt.hash(code, BCRYPT_COST_FACTOR);
		const now = new Date();
		const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);

		const existing = await transactionalOtpRepository.findOneBy({ userId });

		if (!existing) {
			return { code, codeHash, expiresAt, sendCount: 1, windowStartedAt: now };
		}

		const windowElapsed =
			now.getTime() - existing.windowStartedAt.getTime() > windowMinutes * 60_000;

		if (windowElapsed) {
			return { code, codeHash, expiresAt, sendCount: 1, windowStartedAt: now };
		}
		if (existing.sendCount >= maxAttempts) {
			throw new ConflictException(RESEND_LIMIT_MESSAGE);
		}
		return {
			code,
			codeHash,
			expiresAt,
			sendCount: existing.sendCount + 1,
			windowStartedAt: existing.windowStartedAt,
		};
	}

	/** Writes a planned OTP state (BR-230: single row per user — an UPSERT via save(), not a duplicate insert). */
	private async persistOtp(
		transactionalOtpRepository: VerificationOtpRepository,
		userId: string,
		plan: OtpPlan
	): Promise<void> {
		await transactionalOtpRepository.save({
			userId,
			codeHash: plan.codeHash,
			expiresAt: plan.expiresAt,
			sendCount: plan.sendCount,
			windowStartedAt: plan.windowStartedAt,
		});
	}

	/**
	 * Generates (or regenerates, on resend) and persists an OTP for `userId`,
	 * with no delivery step — kept for direct use by tests that need a raw
	 * code without triggering a real SMS/email send (e.g. building verify-flow
	 * fixtures). Public behavior is unchanged from before the Generate ->
	 * Deliver -> Persist split (sendOtp()) was introduced: both steps still
	 * happen, just always together, immediately.
	 */
	async issueOtp(userId: string): Promise<string> {
		let issuedCode = "";

		await this.dataSource.transaction(async (manager) => {
			const transactionalOtpRepository = manager.withRepository(this.verificationOtpRepository);
			const plan = await this.planOtp(transactionalOtpRepository, userId);
			await this.persistOtp(transactionalOtpRepository, userId, plan);
			issuedCode = plan.code;
		});

		this.logger.log(`OTP issued for user: ${userId}`);

		return issuedCode;
	}

	/**
	 * Step 5 scope only: verify a submitted OTP and activate the account.
	 * Does not touch issueOtp()/generateOtpCode() (Step 4) and does not add any
	 * concurrency-safety mechanism beyond what Step 4 already has (no
	 * pessimistic_write / ON CONFLICT / advisory lock — out of scope here).
	 *
	 * AC3 / BR-231: not found -> 404, incorrect or expired -> 409, matching the
	 * existing ConflictException/NotFoundException usage pattern in this file.
	 * BR-243: no side effect (no user status change, no OTP row deleted) on any
	 * failure path — the transaction only wraps the two writes on success.
	 * BR-207: user status update and OTP row deletion happen together in one
	 * transaction (multi-record change).
	 *
	 * "users.isVerified = true" from the story flow maps to the actual schema:
	 * User has no isVerified column, only `status` (UserStatus enum, Step 1 of
	 * CTMS-01/CTMS-02). Verification success is expressed as
	 * `status: PENDING_VERIFICATION -> ACTIVE`, consistent with every prior
	 * Decision Gate / review round for this story. No new column added (would
	 * be a feature/schema change outside this Step's scope).
	 * "invalidate/xóa OTP" maps to deleting the `verification_otps` row — the
	 * entity has no consumedAt/used flag (removed at Step 1 review), so delete
	 * is the only spec-consistent way to invalidate it without touching the
	 * Step 4 entity.
	 *
	 * Channel-agnostic by design (does not take a `channel`, does not change
	 * for this feature): comparing a submitted code against its hash has
	 * nothing to do with which delivery method produced that code.
	 */
	async verifyOtp(dto: VerifyOtpDto): Promise<UserProfileDto> {
		const otp = await this.verificationOtpRepository.findOneBy({ userId: dto.userId });
		if (!otp) {
			throw new NotFoundException(OTP_NOT_FOUND_MESSAGE);
		}

		if (otp.expiresAt.getTime() <= Date.now()) {
			throw new ConflictException(OTP_EXPIRED_MESSAGE);
		}

		const isMatch = await bcrypt.compare(dto.code, otp.codeHash);
		if (!isMatch) {
			throw new ConflictException(OTP_INCORRECT_MESSAGE);
		}

		const user = await this.dataSource.transaction(async (manager) => {
			const transactionalUsersRepository = manager.withRepository(this.usersRepository);
			const transactionalOtpRepository = manager.withRepository(this.verificationOtpRepository);

			await transactionalUsersRepository.update(dto.userId, { status: UserStatus.ACTIVE });
			await transactionalOtpRepository.delete({ userId: dto.userId });

			return transactionalUsersRepository.findOneByOrFail({ id: dto.userId });
		});

		this.logger.log(`OTP verified, user activated: ${user.id}`);

		return toUserProfile(user);
	}

	/**
	 * Backs both POST /auth/send-otp and POST /auth/resend (see SendOtpDto's
	 * docstring for why one method serves two routes). Three explicit,
	 * sequential phases — no callback parameter, reads top-to-bottom:
	 *
	 *   1. Generate — plan the next OTP state (BR-007 limit check happens
	 *      here; a limit-exceeded user never reaches step 2).
	 *   2. Deliver  — send the code via the chosen channel. If this throws,
	 *      execution never reaches step 3.
	 *   3. Persist  — write the planned state. Only reached after a
	 *      successful delivery.
	 *
	 * All three run inside one DB transaction. If Deliver throws, the
	 * transaction is never committed — Generate's read is discarded and
	 * Persist never runs, so send_count is not incremented and no user
	 * loses a resend attempt to a provider outage (Twilio/SMTP down,
	 * timeout, invalid destination, etc.). The user can retry immediately.
	 *
	 * Known trade-off, accepted for this project's scale (documented, not
	 * hidden): this holds a DB row lock for the duration of a real network
	 * call to the delivery provider. Under real concurrent load that's a
	 * recognized anti-pattern (external I/O inside a transaction); a fully
	 * production-grade version would use an outbox/async-confirmation
	 * pattern instead. Not justified at this project's scale.
	 */
	async sendOtp(dto: SendOtpDto): Promise<UserProfileDto> {
		const user = await this.usersRepository.findOneByOrFail({ id: dto.userId });

		await this.dataSource.transaction(async (manager: EntityManager) => {
			const transactionalOtpRepository = manager.withRepository(this.verificationOtpRepository);

			// 1. Generate
			const plan = await this.planOtp(transactionalOtpRepository, dto.userId);

			// 2. Deliver
			await this.otpDeliveryService.send(
				dto.channel,
				{ email: user.email, phone: user.phone },
				plan.code
			);

			// 3. Persist
			await this.persistOtp(transactionalOtpRepository, dto.userId, plan);
		});

		this.logger.log(`OTP sent for user: ${dto.userId} via ${dto.channel}`);

		return toUserProfile(user);
	}

	/**
	 * CTMS-03 scope only. AC1/BR-009: valid credentials return an access
	 * token and a refresh token. AC2/BR-010: invalid credentials return an
	 * appropriate message and create no session (no refresh_tokens row).
	 * AC3: non-active accounts (pending_verification, suspended, deleted —
	 * BR-202's "locked" is modeled as any non-ACTIVE status, no separate
	 * lockout-counter feature exists or is specified) cannot log in.
	 *
	 * Order matters (Tech Lead review): the refresh token is only generated
	 * *after* the password is confirmed correct — a rejected login should
	 * not spend random bytes on a token that will never be used. The DB
	 * transaction wraps only the refresh_tokens insert (BR-207); the access
	 * JWT is signed after that transaction commits, since signing is pure
	 * in-memory work with nothing to roll back.
	 *
	 * Identifier lookup reuses UsersRepository.findByEmailOrPhone() as-is —
	 * normalizing the same raw identifier through both normalizeEmail() and
	 * normalizeVietnamPhone() is safe even when the identifier is the "wrong"
	 * kind for one of them (each normalizer is a no-op on input it doesn't
	 * recognize), so both candidates can always be passed together without a
	 * branch to decide which kind the caller sent (BR-215).
	 */
	async login(dto: LoginDto): Promise<LoginResponseDto> {
		const normalizedEmail = normalizeEmail(dto.identifier);
		const normalizedPhone = normalizeVietnamPhone(dto.identifier);

		const user = await this.usersRepository.findByEmailOrPhone(normalizedEmail, normalizedPhone);
		if (!user) {
			throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
		}

		if (user.status !== UserStatus.ACTIVE) {
			throw new UnauthorizedException(ACCOUNT_NOT_ACTIVE_MESSAGE);
		}

		const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
		if (!passwordMatches) {
			throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
		}

		// Only reached once the password is confirmed correct.
		const rawRefreshToken = randomBytes(32).toString("hex");
		const tokenHash = createHash("sha256").update(rawRefreshToken).digest("hex");
		// Cast: the duration string is runtime-configured (env), so it can't be
		// checked against ms's compile-time-only template-literal StringValue type.
		const refreshTtlConfig = (this.configService.get<string>("JWT_REFRESH_TOKEN_TTL") ??
			"7d") as ms.StringValue;
		const refreshTtlMs = ms(refreshTtlConfig);
		const expiresAt = new Date(Date.now() + refreshTtlMs);

		await this.dataSource.transaction(async (manager) => {
			const transactionalRefreshTokenRepository = manager.withRepository(
				this.refreshTokenRepository
			);
			await transactionalRefreshTokenRepository.save({
				userId: user.id,
				tokenHash,
				expiresAt,
				revokedAt: null,
			});
		});

		// Signing happens after the transaction commits -- nothing here
		// touches the database, so there is nothing to roll back.
		const accessToken = this.jwtService.sign({ sub: user.id, roles: [user.role] });

		this.logger.log(`User logged in: ${user.id}`);

		return { accessToken, refreshToken: rawRefreshToken, user: toUserProfile(user) };
	}

	async forgotPassword(dto: ForgotPasswordDto): Promise<ForgotPasswordResponseDto> {
		const normalizedEmail = normalizeEmail(dto.identifier);
		const normalizedPhone = normalizeVietnamPhone(dto.identifier);
		const user = await this.usersRepository.findByEmailOrPhone(normalizedEmail, normalizedPhone);

		if (!user || user.status !== UserStatus.ACTIVE) {
			return { requestAccepted: true };
		}

		await this.dataSource.transaction(async (manager: EntityManager) => {
			const transactionalOtpRepository = manager.withRepository(this.verificationOtpRepository);
			const plan = await this.planOtp(transactionalOtpRepository, user.id);

			await this.otpDeliveryService.send(
				dto.channel,
				{ email: user.email, phone: user.phone },
				plan.code
			);

			await this.persistOtp(transactionalOtpRepository, user.id, plan);
		});

		this.logger.log(`Password reset OTP requested for user: ${user.id}`);

		return { requestAccepted: true };
	}

	async resetPassword(dto: ResetPasswordDto): Promise<ResetPasswordResponseDto> {
		const normalizedEmail = normalizeEmail(dto.identifier);
		const normalizedPhone = normalizeVietnamPhone(dto.identifier);
		const user = await this.usersRepository.findByEmailOrPhone(normalizedEmail, normalizedPhone);

		if (!user || user.status !== UserStatus.ACTIVE) {
			throw new NotFoundException(RESET_CREDENTIAL_NOT_FOUND_MESSAGE);
		}

		const otp = await this.verificationOtpRepository.findOneBy({ userId: user.id });
		if (!otp) {
			throw new NotFoundException(RESET_CREDENTIAL_NOT_FOUND_MESSAGE);
		}

		if (otp.expiresAt.getTime() <= Date.now()) {
			throw new ConflictException(RESET_CREDENTIAL_EXPIRED_MESSAGE);
		}

		const isMatch = await bcrypt.compare(dto.code, otp.codeHash);
		if (!isMatch) {
			throw new ConflictException(RESET_CREDENTIAL_INCORRECT_MESSAGE);
		}

		const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_COST_FACTOR);
		const revokedAt = new Date();

		await this.dataSource.transaction(async (manager: EntityManager) => {
			const transactionalUsersRepository = manager.withRepository(this.usersRepository);
			const transactionalOtpRepository = manager.withRepository(this.verificationOtpRepository);
			const transactionalRefreshTokenRepository = manager.withRepository(
				this.refreshTokenRepository
			);
			const auditLogRepository = manager.getRepository(AuditLog);

			await transactionalUsersRepository.update(user.id, { passwordHash });
			await transactionalOtpRepository.delete({ userId: user.id });
			await transactionalRefreshTokenRepository.revokeActiveTokensForUser(user.id, revokedAt);
			await auditLogRepository.save({
				actorId: user.id,
				action: "auth.password_reset",
				targetType: "user",
				targetId: user.id,
				before: { refreshTokensRevoked: false },
				after: { refreshTokensRevoked: true },
				reason: "forgot_password_otp_verified",
			});
		});

		this.logger.log(`Password reset completed for user: ${user.id}`);

		return { passwordReset: true };
	}
}
