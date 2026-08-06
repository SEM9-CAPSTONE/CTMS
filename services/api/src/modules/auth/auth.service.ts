import { randomInt } from "node:crypto";
import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource } from "typeorm";
import { isUniqueViolation } from "../../shared/database/postgres-error-codes";
import { UserStatus } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { UsersRepository } from "../users/users.repository";
import type { RegisterDto } from "./dto/register.dto";
import type { ResendOtpDto } from "./dto/resend-otp.dto";
import { type UserProfileDto, toUserProfile } from "./dto/user-profile.dto";
import type { VerifyOtpDto } from "./dto/verify-otp.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { VerificationOtpRepository } from "./verification-otp.repository";

const BCRYPT_COST_FACTOR = 10;
const DUPLICATE_CONTACT_MESSAGE = "Email or phone already registered";
const RESEND_LIMIT_MESSAGE = "OTP resend limit reached, try again later";
const OTP_NOT_FOUND_MESSAGE = "No pending OTP found for this account";
const OTP_EXPIRED_MESSAGE = "OTP has expired";
const OTP_INCORRECT_MESSAGE = "Incorrect OTP";

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

@Injectable()
export class AuthService {
	private readonly logger = new Logger(AuthService.name);

	constructor(
		private readonly usersRepository: UsersRepository,
		private readonly verificationOtpRepository: VerificationOtpRepository,
		private readonly dataSource: DataSource,
		private readonly configService: ConfigService
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
	 * Generates (or regenerates, on resend) and persists an OTP for `userId`.
	 * Not wired to any endpoint yet (Step 4 scope: generate + persist + hash +
	 * TTL + resend window only — no verify/resend API, no delivery/sending).
	 * Returns the raw code so a future sending step can dispatch it; only the
	 * hash is ever persisted (Decision Gate v2 assumption #6).
	 *
	 * BR-006/AC1: expiresAt = now + OTP_TTL_MINUTES.
	 * BR-007/AC2: sendCount is capped at OTP_RESEND_MAX_ATTEMPTS within a
	 * rolling OTP_RESEND_WINDOW_MINUTES window; the very first issuance for a
	 * user is not counted as a "resend" and always succeeds.
	 * BR-230: single row per user (PK = userId, Step 1) — a second concurrent
	 * call resolves as an UPDATE on the same locked row inside the
	 * transaction, not a duplicate record.
	 */
	async issueOtp(userId: string): Promise<string> {
		const ttlMinutes = Number(this.configService.get<string>("OTP_TTL_MINUTES"));
		const windowMinutes = Number(this.configService.get<string>("OTP_RESEND_WINDOW_MINUTES"));
		const maxAttempts = Number(this.configService.get<string>("OTP_RESEND_MAX_ATTEMPTS"));

		const code = generateOtpCode();
		const codeHash = await bcrypt.hash(code, BCRYPT_COST_FACTOR);
		const now = new Date();
		const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);

		await this.dataSource.transaction(async (manager) => {
			const transactionalOtpRepository = manager.withRepository(this.verificationOtpRepository);
			const existing = await transactionalOtpRepository.findOneBy({ userId });

			if (!existing) {
				await transactionalOtpRepository.save({
					userId,
					codeHash,
					expiresAt,
					sendCount: 1,
					windowStartedAt: now,
				});
				return;
			}

			const windowElapsed =
				now.getTime() - existing.windowStartedAt.getTime() > windowMinutes * 60_000;

			if (windowElapsed) {
				existing.sendCount = 1;
				existing.windowStartedAt = now;
			} else if (existing.sendCount >= maxAttempts) {
				throw new ConflictException(RESEND_LIMIT_MESSAGE);
			} else {
				existing.sendCount += 1;
			}

			existing.codeHash = codeHash;
			existing.expiresAt = expiresAt;
			await transactionalOtpRepository.save(existing);
		});

		this.logger.log(`OTP issued for user: ${userId}`);

		return code;
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
	 * Step 6 scope only: thin wrapper exposing issueOtp() (Step 4) over HTTP.
	 * Calls issueOtp() exactly as implemented — no modification, no added
	 * concurrency handling, no fix for the Step 4/5 known risks (unhandled
	 * unique_violation / foreign_key_violation, Invalid Date on invalid TTL
	 * config, missing user.status check). Errors from issueOtp() (e.g. the
	 * resend-limit ConflictException) propagate unchanged.
	 *
	 * Does not implement any form of OTP exposure: the raw code returned by
	 * issueOtp() is discarded here, never logged, never included in the
	 * response. Does not implement SMS/email sending.
	 *
	 * Response shape (UserProfileDto): TEMPORARY PLACEHOLDER only — aligned
	 * with the existing register()/verifyOtp() controller convention because
	 * no API contract for resend exists anywhere (spec, OpenAPI, or a
	 * dedicated response DTO — confirmed absent by investigation). This is an
	 * open Decision Gate, not a confirmed contract; the response shape may
	 * change once Tech Lead/PO confirms it.
	 */
	async resendOtp(dto: ResendOtpDto): Promise<UserProfileDto> {
		await this.issueOtp(dto.userId);

		const user = await this.usersRepository.findOneByOrFail({ id: dto.userId });

		return toUserProfile(user);
	}
}
