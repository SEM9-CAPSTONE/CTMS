import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEnum, IsNotEmpty, IsString, MaxLength } from "class-validator";
import { normalizeEmail, normalizeVietnamPhone } from "../../../shared/utils/normalize.util";
import { OtpChannel } from "./send-otp.dto";

function normalizeIdentifier(value: unknown): unknown {
	if (typeof value !== "string") return value;
	const trimmed = value.trim();
	return normalizeVietnamPhone(normalizeEmail(trimmed));
}

export class ForgotPasswordDto {
	@ApiProperty({ example: "camper@example.com" })
	@Transform(({ value }) => normalizeIdentifier(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(254)
	identifier!: string;

	@ApiProperty({ enum: OtpChannel })
	@IsEnum(OtpChannel, { message: "channel must be one of phone, email" })
	channel!: OtpChannel;
}
