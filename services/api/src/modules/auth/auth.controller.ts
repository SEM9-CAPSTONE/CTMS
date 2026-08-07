import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { AuthService } from "./auth.service";
import { LoginResponseDto } from "./dto/login-response.dto";
// biome-ignore lint/style/useImportType: used as a @Body() parameter type, needs design:paramtypes metadata for NestJS's validation/transform pipeline
import { LoginDto } from "./dto/login.dto";
// biome-ignore lint/style/useImportType: used as a @Body() parameter type, needs design:paramtypes metadata for NestJS's validation/transform pipeline
import { RegisterDto } from "./dto/register.dto";
// biome-ignore lint/style/useImportType: used as a @Body() parameter type, needs design:paramtypes metadata for NestJS's validation/transform pipeline
import { ResendOtpDto } from "./dto/resend-otp.dto";
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
	 * Response shape is a TEMPORARY PLACEHOLDER (aligned with register/verify's
	 * UserProfileDto convention) — no API contract for resend has been
	 * confirmed. Open Decision Gate, see AuthService.resendOtp() docstring.
	 */
	@Post("resend")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: "Resend OTP for account verification (response shape not yet confirmed)",
	})
	@ApiResponse({
		status: 200,
		description: "OTP resent — placeholder response, pending contract confirmation",
		type: UserProfileDto,
	})
	@ApiResponse({ status: 409, description: "Resend limit reached" })
	@ApiResponse({ status: 422, description: "Invalid input" })
	resend(@Body() dto: ResendOtpDto): Promise<UserProfileDto> {
		return this.authService.resendOtp(dto);
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
}
