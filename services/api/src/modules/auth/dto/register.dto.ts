import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, IsEnum, IsNotEmpty, IsString, Matches, MaxLength } from "class-validator";
import {
	VN_MOBILE_E164_REGEX,
	normalizeEmail,
	normalizeVietnamPhone,
} from "../../../shared/utils/normalize.util";
import { AtLeastOneContactMethod } from "../../../shared/validators/at-least-one-contact-method.validator";
import { UserRole } from "../../users/entities/user.entity";

export class RegisterDto {
	@ApiProperty({ example: "camper@example.com" })
	@IsNotEmpty()
	@Transform(({ value }) => (typeof value === "string" ? normalizeEmail(value) : value))
	@IsEmail()
	@MaxLength(254)
	email!: string;

	@ApiProperty({ example: "0912345678" })
	@IsNotEmpty()
	@Transform(({ value }) => (typeof value === "string" ? normalizeVietnamPhone(value) : value))
	@Matches(VN_MOBILE_E164_REGEX, {
		message: "phone must be a valid Vietnamese mobile number",
	})
	phone!: string;

	@ApiProperty()
	@AtLeastOneContactMethod()
	@IsString()
	@IsNotEmpty()
	password!: string;

	@ApiProperty({ enum: UserRole })
	@IsEnum(UserRole, { message: "role must be one of camper, host, porter" })
	role!: UserRole;
}
