import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsUUID } from "class-validator";

/**
 * Shared by both POST /auth/send-otp and POST /auth/resend. The two routes
 * exist for REST-client clarity (which button the user pressed); the body
 * they accept — and the AuthService method they both call — is identical,
 * because issueOtp() itself has never distinguished "first issuance" from
 * "resend" (see its docstring: the first call for a user always succeeds
 * and isn't counted as a resend).
 */
export enum OtpChannel {
	PHONE = "phone",
	EMAIL = "email",
}

export class SendOtpDto {
	/** Assumption (Decision Gate v2 #5): identify the account by the `id` already returned by POST /auth/register. */
	@ApiProperty({ format: "uuid" })
	@IsNotEmpty()
	@IsUUID("4")
	userId!: string;

	/** Which contact method to deliver the OTP through — chosen by the user on the Verify page, never inferred. */
	@ApiProperty({ enum: OtpChannel })
	@IsEnum(OtpChannel, { message: "channel must be one of phone, email" })
	channel!: OtpChannel;
}
