import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, IsIn, IsNotEmpty, IsString, Matches, MaxLength } from "class-validator";
import {
	VN_MOBILE_E164_REGEX,
	normalizeEmail,
	normalizeVietnamPhone,
} from "../../../shared/utils/normalize.util";
import { AtLeastOneContactMethod } from "../../../shared/validators/at-least-one-contact-method.validator";
import { UserRole } from "../../users/entities/user.entity";

/**
 * Deliberately NOT `Object.values(UserRole)` / @IsEnum(UserRole, ...). The
 * full UserRole enum now includes ADMIN (added for a dev-only seed
 * account — see UserRole's own comment), but public self-registration must
 * never be able to create an admin account. This explicit allow-list is the
 * single place that enforces that boundary, independent of whatever gets
 * added to UserRole in the future (e.g. CTMS-06 adding more values).
 */
export const PUBLIC_REGISTER_ROLES = [UserRole.CAMPER, UserRole.HOST, UserRole.PORTER] as const;

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

	@ApiProperty({ enum: PUBLIC_REGISTER_ROLES })
	@IsIn(PUBLIC_REGISTER_ROLES, { message: "role must be one of camper, host, porter" })
	role!: (typeof PUBLIC_REGISTER_ROLES)[number];
}
