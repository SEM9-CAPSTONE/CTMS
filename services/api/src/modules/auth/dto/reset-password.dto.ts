import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { normalizeEmail, normalizeVietnamPhone } from "../../../shared/utils/normalize.util";

function normalizeIdentifier(value: unknown): unknown {
	if (typeof value !== "string") return value;
	const trimmed = value.trim();
	return normalizeVietnamPhone(normalizeEmail(trimmed));
}

export class ResetPasswordDto {
	@ApiProperty({ example: "camper@example.com" })
	@Transform(({ value }) => normalizeIdentifier(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(254)
	identifier!: string;

	@ApiProperty({ example: "123456" })
	@IsString()
	@IsNotEmpty()
	code!: string;

	@ApiProperty({ minLength: 8, example: "NewStrongPassword1!" })
	@IsString()
	@IsNotEmpty()
	@MinLength(8)
	@MaxLength(128)
	@Matches(/[A-Za-z]/, { message: "newPassword must contain at least one letter" })
	@Matches(/[0-9]/, { message: "newPassword must contain at least one number" })
	newPassword!: string;
}
