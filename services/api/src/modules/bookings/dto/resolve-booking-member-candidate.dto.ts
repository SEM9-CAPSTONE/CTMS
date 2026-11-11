import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, IsNotEmpty, IsString, MaxLength } from "class-validator";
import { normalizeEmail } from "../../../shared/utils/normalize.util";

export class ResolveBookingMemberCandidateDto {
	@ApiProperty({ example: "participant@example.com", maxLength: 254 })
	@Transform(({ value }) => (typeof value === "string" ? normalizeEmail(value) : value))
	@IsString()
	@IsNotEmpty()
	@IsEmail()
	@MaxLength(254)
	email!: string;
}

export class ResolveBookingMemberCandidateResponseDto {
	@ApiProperty({ format: "uuid" })
	userId!: string;

	@ApiProperty({ example: "participant@example.com" })
	email!: string;
}
