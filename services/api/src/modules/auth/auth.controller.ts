import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { AuthService } from "./auth.service";
// biome-ignore lint/style/useImportType: used as a @Body() parameter type, needs design:paramtypes metadata for NestJS's validation/transform pipeline
import { RegisterDto } from "./dto/register.dto";
import { UserProfileDto } from "./dto/user-profile.dto";

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
}
