import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { AuthService } from "./auth.service";
import { ForgotPasswordResponseDto } from "./dto/forgot-password-response.dto";
// biome-ignore lint/style/useImportType: used as a @Body() parameter type, needs design:paramtypes metadata for NestJS's validation/transform pipeline
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginResponseDto } from "./dto/login-response.dto";
// biome-ignore lint/style/useImportType: used as a @Body() parameter type, needs design:paramtypes metadata for NestJS's validation/transform pipeline
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenResponseDto } from "./dto/refresh-token-response.dto";
// biome-ignore lint/style/useImportType: used as a @Body() parameter type, needs design:paramtypes metadata for NestJS's validation/transform pipeline
import { RefreshTokenDto } from "./dto/refresh-token.dto";
// biome-ignore lint/style/useImportType: used as a @Body() parameter type, needs design:paramtypes metadata for NestJS's validation/transform pipeline
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordResponseDto } from "./dto/reset-password-response.dto";
// biome-ignore lint/style/useImportType: used as a @Body() parameter type, needs design:paramtypes metadata for NestJS's validation/transform pipeline
import { ResetPasswordDto } from "./dto/reset-password.dto";
// biome-ignore lint/style/useImportType: used as a @Body() parameter type, needs design:paramtypes metadata for NestJS's validation/transform pipeline
import { SendOtpDto } from "./dto/send-otp.dto";
import { UserProfileDto } from "./dto/user-profile.dto";
// biome-ignore lint/style/useImportType: used as a @Body() parameter type, needs design:paramtypes metadata for NestJS's validation/transform pipeline
import { VerifyOtpDto } from "./dto/verify-otp.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Post("register")
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({ summary: "Register a new account with email or phone" })
	@ApiResponse({ status: 201, description: "Account created", type: UserProfileDto })
	@ApiResponse({ status: 409, description: "Email or phone already registered" })
	@ApiResponse({ status: 422, description: "Invalid input" })
	register(@Body() dto: RegisterDto): Promise<UserProfileDto> {
		return this.authService.register(dto);
	}

	@Post("verify")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Verify account with OTP" })
	@ApiResponse({ status: 200, description: "Account verified", type: UserProfileDto })
	@ApiResponse({ status: 404, description: "No pending OTP found for this account" })
	@ApiResponse({ status: 409, description: "Incorrect or expired OTP" })
	@ApiResponse({ status: 422, description: "Invalid input" })
	verify(@Body() dto: VerifyOtpDto): Promise<UserProfileDto> {
		return this.authService.verifyOtp(dto);
	}

	/**
	 * First OTP issuance for an account — distinct route from /resend for REST
	 * clarity to API consumers, even though both call the same AuthService
	 * method (see SendOtpDto's docstring for why: the underlying business
	 * rule genuinely does not distinguish "first send" from "resend").
	 */
	@Post("send-otp")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: "Send an OTP to verify an account via the chosen channel (phone or email)",
	})
	@ApiResponse({ status: 200, description: "OTP sent", type: UserProfileDto })
	@ApiResponse({ status: 409, description: "Resend limit reached, or delivery failed" })
	@ApiResponse({ status: 422, description: "Invalid input" })
	sendOtp(@Body() dto: SendOtpDto): Promise<UserProfileDto> {
		return this.authService.sendOtp(dto);
	}

	/** Resend an OTP — same body and same underlying operation as /send-otp; see its docstring. */
	@Post("resend")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Resend an OTP for account verification via the chosen channel" })
	@ApiResponse({ status: 200, description: "OTP resent", type: UserProfileDto })
	@ApiResponse({ status: 409, description: "Resend limit reached, or delivery failed" })
	@ApiResponse({ status: 422, description: "Invalid input" })
	resend(@Body() dto: SendOtpDto): Promise<UserProfileDto> {
		return this.authService.sendOtp(dto);
	}

	@Post("login")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Log in with email/phone and password" })
	@ApiResponse({ status: 200, description: "Login successful", type: LoginResponseDto })
	@ApiResponse({ status: 401, description: "Invalid credentials, or account is not active" })
	@ApiResponse({ status: 422, description: "Invalid input" })
	login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
		return this.authService.login(dto);
	}

	/**
	 * CTMS-04-T01, Decision Gate DG-01: refresh token travels in the request
	 * body, not a header/cookie. Every failure (not found, expired, revoked,
	 * reused after rotation, or account no longer active) maps to the same
	 * 401 -- see AuthService.refresh()'s docstring.
	 */
	@Post("refresh")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Exchange a valid refresh token for a new access/refresh token pair" })
	@ApiResponse({ status: 200, description: "Token refreshed", type: RefreshTokenResponseDto })
	@ApiResponse({ status: 401, description: "Invalid, expired, revoked, or reused refresh token" })
	@ApiResponse({ status: 422, description: "Invalid input" })
	refresh(@Body() dto: RefreshTokenDto): Promise<RefreshTokenResponseDto> {
		return this.authService.refresh(dto);
	}

	@Post("forgot-password")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Request an OTP for forgotten-password reset" })
	@ApiResponse({
		status: 200,
		description: "Password reset request accepted",
		type: ForgotPasswordResponseDto,
	})
	@ApiResponse({ status: 422, description: "Invalid input" })
	forgotPassword(@Body() dto: ForgotPasswordDto): Promise<ForgotPasswordResponseDto> {
		return this.authService.forgotPassword(dto);
	}

	@Post("reset-password")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Reset password with a valid OTP" })
	@ApiResponse({
		status: 200,
		description: "Password reset successfully",
		type: ResetPasswordResponseDto,
	})
	@ApiResponse({ status: 404, description: "No pending reset credential found" })
	@ApiResponse({ status: 409, description: "Expired or incorrect reset credential" })
	@ApiResponse({ status: 422, description: "Invalid input" })
	resetPassword(@Body() dto: ResetPasswordDto): Promise<ResetPasswordResponseDto> {
		return this.authService.resetPassword(dto);
	}
}
