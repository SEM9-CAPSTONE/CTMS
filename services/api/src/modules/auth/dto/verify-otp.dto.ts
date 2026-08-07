import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsUUID } from "class-validator";

export class VerifyOtpDto {
	/** Assumption (Decision Gate v2 #5): identify the account by the `id` already returned by POST /auth/register. */
	@ApiProperty({ format: "uuid" })
	@IsNotEmpty()
	@IsUUID("4")
	userId!: string;

	/**
	 * Deliberately format-agnostic (required + string only): the spec does not
	 * define an OTP format, so the API contract must not encode one. The
	 * concrete format (currently 6 digits) is an implementation assumption
	 * defined once at the OTP-generation source (auth.service.ts, Step 4) and
	 * reused by the verify comparison — not duplicated here. See Step 3 review
	 * ("Contract-shaping Assumption" analysis) for why this was moved out of
	 * the DTO.
	 */
	@ApiProperty({ example: "123456" })
	@IsString()
	@IsNotEmpty()
	code!: string;
}
