import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

/**
 * Deliberately no email/phone format validation and no @Transform
 * normalization here (unlike RegisterDto) — `identifier` accepts either,
 * and AuthService.login() normalizes it as both an email and a phone
 * candidate before the lookup (see login()'s docstring). Rejecting on
 * format here would leak a signal about which kind of identifier was
 * attempted, which register.dto.ts doesn't need to avoid (it already knows
 * the field is an email) but login intentionally does (Decision Gate D6:
 * generic failure, no user enumeration).
 */
export class LoginDto {
	@ApiProperty({ example: "camper@example.com", description: "Email or phone number" })
	@IsNotEmpty()
	@IsString()
	identifier!: string;

	@ApiProperty()
	@IsNotEmpty()
	@IsString()
	password!: string;
}
