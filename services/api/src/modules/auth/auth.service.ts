import { createHash, randomBytes, randomInt } from "node:crypto";
import {
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
	UnauthorizedException,
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import ms from "ms";
import type { DataSource, EntityManager } from "typeorm";
import { isUniqueViolation } from "../../shared/database/postgres-error-codes";
import { normalizeEmail, normalizeVietnamPhone } from "../../shared/utils/normalize.util";
import { type User, UserStatus } from "../users/entities/user.entity";
import type { UsersRepository } from "../users/users.repository";
import type { ForgotPasswordResponseDto } from "./dto/forgot-password-response.dto";
import type { ForgotPasswordDto } from "./dto/forgot-password.dto";
import type { LoginResponseDto } from "./dto/login-response.dto";
import type { LoginDto } from "./dto/login.dto";
import type { LogoutResponseDto } from "./dto/logout-response.dto";
import type { LogoutDto } from "./dto/logout.dto";
import type { RefreshTokenResponseDto } from "./dto/refresh-token-response.dto";
import type { RefreshTokenDto } from "./dto/refresh-token.dto";
import type { RegisterDto } from "./dto/register.dto";
import type { ResetPasswordResponseDto } from "./dto/reset-password-response.dto";
import type { ResetPasswordDto } from "./dto/reset-password.dto";
import type { SendOtpDto } from "./dto/send-otp.dto";
import { type UserProfileDto, toUserProfile } from "./dto/user-profile.dto";
import type { VerifyOtpDto } from "./dto/verify-otp.dto";
import { AuditLog } from "./entities/audit-log.entity";
import type { OtpDeliveryService } from "./otp-delivery.service";
import type { RefreshTokenRepository } from "./refresh-token.repository";
import type { VerificationOtpRepository } from "./verification-otp.repository";

export const BCRYPT_COST_FACTOR = 10;
const DUPLICATE_CONTACT_MESSAGE = "Email or phone already registered";
const RESEND_LIMIT_MESSAGE = "OTP resend limit reached, try again later";
const OTP_NOT_FOUND_MESSAGE = "No pending OTP found for this account";
const OTP_EXPIRED_MESSAGE = "OTP has expired";
const OTP_INCORRECT_MESSAGE = "Incorrect OTP";
const RESET_CREDENTIAL_NOT_FOUND_MESSAGE = "No pending reset credential found";
const RESET_CREDENTIAL_EXPIRED_MESSAGE = "Reset credential has expired";
const RESET_CREDENTIAL_INCORRECT_MESSAGE = "Incorrect reset credential";
const INVALID_CREDENTIALS_MESSAGE = "Invalid credentials";
const ACCOUNT_NOT_ACTIVE_MESSAGE = "Account is not active";
const INVALID_REFRESH_TOKEN_MESSAGE = "Invalid refresh token";
function generateOtpCode(): string {
	return randomInt(100000, 1000000).toString();
}

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
			const auditLogRepository = manager.getRepository(AuditLog);

			let createdUser: User;
			try {
				createdUser = await transactionalUsersRepository.createUser({
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

			await auditLogRepository.save({
				actorId: createdUser.id,
				action: "auth.register",
				targetType: "user",
				targetId: createdUser.id,
				before: null,
				after: { role: createdUser.role },
				reason: null,
			});

			return createdUser;
		});

		this.logger.log(`User registered: ${user.id}`);

		return toUserProfile(user);
	}
	private async planOtp(
		transactionalOtpRepository: VerificationOtpRepository,
		userId: string
	): Promise<OtpPlan> {
		const ttlMinutes = Number(this.configService.get<string>("OTP_TTL_MINUTES") ?? "10");
		const windowMinutes = Number(
			this.configService.get<string>("OTP_RESEND_WINDOW_MINUTES") ?? "1440"
		);
		const maxAttempts = Number(this.configService.get<string>("OTP_RESEND_MAX_ATTEMPTS") ?? "5");

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
			const auditLogRepository = manager.getRepository(AuditLog);

			await transactionalUsersRepository.update(dto.userId, { status: UserStatus.ACTIVE });
			await transactionalOtpRepository.delete({ userId: dto.userId });

			const updatedUser = await transactionalUsersRepository.findOneByOrFail({ id: dto.userId });

			await auditLogRepository.save({
				actorId: dto.userId,
				action: "auth.verify_otp",
				targetType: "user",
				targetId: dto.userId,
				before: { status: UserStatus.PENDING_VERIFICATION },
				after: { status: UserStatus.ACTIVE },
				reason: null,
			});

			return updatedUser;
		});

		this.logger.log(`OTP verified, user activated: ${user.id}`);

		return toUserProfile(user);
	}

	async sendOtp(dto: SendOtpDto): Promise<UserProfileDto> {
		const user = await this.usersRepository.findOneByOrFail({ id: dto.userId });

		await this.dataSource.transaction(async (manager: EntityManager) => {
			const transactionalOtpRepository = manager.withRepository(this.verificationOtpRepository);

			const plan = await this.planOtp(transactionalOtpRepository, dto.userId);

			await this.otpDeliveryService.send(
				dto.channel,
				{ email: user.email, phone: user.phone },
				plan.code
			);

			await this.persistOtp(transactionalOtpRepository, dto.userId, plan);
		});

		this.logger.log(`OTP sent for user: ${dto.userId} via ${dto.channel}`);

		return toUserProfile(user);
	}

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
			const auditLogRepository = manager.getRepository(AuditLog);

			await transactionalRefreshTokenRepository.save({
				userId: user.id,
				tokenHash,
				expiresAt,
				revokedAt: null,
			});

			await auditLogRepository.save({
				actorId: user.id,
				action: "auth.login",
				targetType: "user",
				targetId: user.id,
				before: null,
				after: null,
				reason: null,
			});
		});

		// Signing happens after the transaction commits -- nothing here
		// touches the database, so there is nothing to roll back.
		const roles = await this.usersRepository.getGrantedRolesById(user.id);
		const accessToken = this.jwtService.sign({ sub: user.id, roles });

		this.logger.log(`User logged in: ${user.id}`);

		return { accessToken, refreshToken: rawRefreshToken, user: toUserProfile(user) };
	}

	async refresh(dto: RefreshTokenDto): Promise<RefreshTokenResponseDto> {
		const tokenHash = createHash("sha256").update(dto.refreshToken).digest("hex");
		const existing = await this.refreshTokenRepository.findOneBy({ tokenHash });

		const now = new Date();
		if (!existing || existing.revokedAt !== null || existing.expiresAt.getTime() <= now.getTime()) {
			throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
		}

		const user = await this.usersRepository.findOneBy({ id: existing.userId });
		if (!user || user.status !== UserStatus.ACTIVE) {
			throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
		}

		const rawRefreshToken = randomBytes(32).toString("hex");
		const newTokenHash = createHash("sha256").update(rawRefreshToken).digest("hex");
		const refreshTtlConfig = (this.configService.get<string>("JWT_REFRESH_TOKEN_TTL") ??
			"7d") as ms.StringValue;
		const expiresAt = new Date(now.getTime() + ms(refreshTtlConfig));

		const rotated = await this.dataSource.transaction(async (manager) => {
			const transactionalRefreshTokenRepository = manager.withRepository(
				this.refreshTokenRepository
			);

			const affected = await transactionalRefreshTokenRepository.revokeIfActive(existing.id, now);
			if (affected === 0) {
				return false;
			}

			const newToken = await transactionalRefreshTokenRepository.save({
				userId: user.id,
				tokenHash: newTokenHash,
				expiresAt,
				revokedAt: null,
			});

			const auditLogRepository = manager.getRepository(AuditLog);
			await auditLogRepository.save({
				actorId: user.id,
				action: "auth.token_refreshed",
				targetType: "user",
				targetId: user.id,
				before: { refreshTokenId: existing.id },
				after: { refreshTokenId: newToken.id },
				reason: null,
			});

			return true;
		});

		if (!rotated) {
			throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
		}

		// Signing happens after the transaction commits -- nothing here
		// touches the database, same reasoning as login().
		const roles = await this.usersRepository.getGrantedRolesById(user.id);
		const accessToken = this.jwtService.sign({ sub: user.id, roles });

		this.logger.log(`Refresh token rotated for user: ${user.id}`);

		return { accessToken, refreshToken: rawRefreshToken };
	}

	async logout(authenticatedUserId: string, dto: LogoutDto): Promise<LogoutResponseDto> {
		const tokenHash = createHash("sha256").update(dto.refreshToken).digest("hex");
		const existing = await this.refreshTokenRepository.findOneBy({ tokenHash });

		if (!existing || existing.userId !== authenticatedUserId) {
			throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
		}

		const revokedAt = new Date();
		await this.dataSource.transaction(async (manager: EntityManager) => {
			const transactionalRefreshTokenRepository = manager.withRepository(
				this.refreshTokenRepository
			);
			const auditLogRepository = manager.getRepository(AuditLog);

			const revokedCount =
				dto.allDevices === true
					? await transactionalRefreshTokenRepository.revokeActiveTokensForUser(
							authenticatedUserId,
							revokedAt
						)
					: await transactionalRefreshTokenRepository.revokeIfActive(existing.id, revokedAt);

			if (revokedCount === 0) {
				return;
			}

			await auditLogRepository.save({
				actorId: authenticatedUserId,
				action: dto.allDevices === true ? "auth.logout_all_devices" : "auth.logout",
				targetType: "user",
				targetId: authenticatedUserId,
				before: { refreshTokenId: existing.id },
				after: { refreshTokensRevoked: dto.allDevices === true ? "all_active" : "current" },
				reason: null,
			});
		});

		this.logger.log(`User logged out: ${authenticatedUserId}`);

		return { loggedOut: true };
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
