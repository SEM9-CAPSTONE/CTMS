import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
	ArrayMaxSize,
	IsArray,
	IsEmail,
	IsEnum,
	IsISO8601,
	IsNotEmpty,
	IsOptional,
	IsString,
	Matches,
	MaxLength,
	MinLength,
	ValidateNested,
} from "class-validator";
import {
	VN_MOBILE_E164_REGEX,
	normalizeEmail,
	normalizeVietnamPhone,
} from "../../../shared/utils/normalize.util";
import { UserGender } from "../../users/entities/user.entity";

export class UpdateEmergencyContactDto {
	@ApiPropertyOptional({ example: "Nguyen Van A" })
	@IsString()
	@IsNotEmpty()
	@MinLength(2)
	@MaxLength(80)
	name!: string;

	@ApiPropertyOptional({ example: "father" })
	@IsString()
	@IsNotEmpty()
	@MinLength(2)
	@MaxLength(40)
	relationship!: string;

	@ApiPropertyOptional({ example: "0912345678" })
	@Transform(({ value }) => (typeof value === "string" ? normalizeVietnamPhone(value) : value))
	@Matches(VN_MOBILE_E164_REGEX, {
		message: "phone must be a valid Vietnamese mobile number",
	})
	phone!: string;

	@ApiPropertyOptional({ example: "relative@example.com" })
	@IsOptional()
	@Transform(({ value }) => {
		if (typeof value !== "string") {
			return value;
		}
		const normalized = normalizeEmail(value);
		return normalized === "" ? undefined : normalized;
	})
	@IsEmail()
	@MaxLength(254)
	email?: string;
}

export class UpdateProfileDto {
	@ApiPropertyOptional({ example: "Nguyen Van B" })
	@IsOptional()
	@IsString()
	@MinLength(2)
	@MaxLength(50)
	fullName?: string;

	@ApiPropertyOptional({ example: "1995-04-12" })
	@IsOptional()
	@IsISO8601({ strict: true })
	dateOfBirth?: string;

	@ApiPropertyOptional({ enum: UserGender })
	@IsOptional()
	@IsEnum(UserGender)
	gender?: UserGender;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MinLength(5)
	@MaxLength(200)
	address?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(500)
	bio?: string;

	@ApiPropertyOptional({ type: [UpdateEmergencyContactDto] })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(2)
	@ValidateNested({ each: true })
	@Type(() => UpdateEmergencyContactDto)
	emergencyContacts?: UpdateEmergencyContactDto[];
}
