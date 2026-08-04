import { ApiProperty } from "@nestjs/swagger";
import type { User } from "../../users/entities/user.entity";
import { UserRole, UserStatus } from "../../users/entities/user.entity";

export class UserProfileDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ type: String, nullable: true })
	email!: string | null;

	@ApiProperty({ type: String, nullable: true })
	phone!: string | null;

	@ApiProperty({ enum: UserRole })
	role!: UserRole;

	@ApiProperty({ enum: UserStatus })
	status!: UserStatus;

	@ApiProperty()
	createdAt!: Date;
}

/**
 * Explicit whitelist mapping so passwordHash (or any future sensitive
 * column added to User) can never leak into an API response by default.
 */
export function toUserProfile(user: User): UserProfileDto {
	return {
		id: user.id,
		email: user.email,
		phone: user.phone,
		role: user.role,
		status: user.status,
		createdAt: user.createdAt,
	};
}
