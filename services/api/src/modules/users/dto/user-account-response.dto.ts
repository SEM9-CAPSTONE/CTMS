import { ApiProperty } from "@nestjs/swagger";
import type { User } from "../entities/user.entity";
import { UserGender, UserRole, UserStatus } from "../entities/user.entity";

export class UserAccountSummaryDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ type: String, nullable: true })
	email!: string | null;

	@ApiProperty({ type: String, nullable: true })
	phone!: string | null;

	@ApiProperty({ type: String, nullable: true })
	fullName!: string | null;

	@ApiProperty({ enum: UserRole })
	role!: UserRole;

	@ApiProperty({ enum: UserStatus })
	status!: UserStatus;

	@ApiProperty()
	createdAt!: Date;

	@ApiProperty()
	updatedAt!: Date;
}

export class UserAccountDetailDto extends UserAccountSummaryDto {
	@ApiProperty({ type: String, nullable: true })
	dateOfBirth!: string | null;

	@ApiProperty({ enum: UserGender, nullable: true })
	gender!: UserGender | null;

	@ApiProperty({ type: String, nullable: true })
	address!: string | null;

	@ApiProperty({ type: String, nullable: true })
	bio!: string | null;
}

export class UserAccountsPaginationDto {
	@ApiProperty()
	page!: number;

	@ApiProperty()
	limit!: number;

	@ApiProperty()
	total!: number;

	@ApiProperty()
	totalPages!: number;
}

export class PaginatedUserAccountsResponseDto {
	@ApiProperty({ type: [UserAccountSummaryDto] })
	items!: UserAccountSummaryDto[];

	@ApiProperty({ type: UserAccountsPaginationDto })
	pagination!: UserAccountsPaginationDto;
}

export function toUserAccountSummary(user: User): UserAccountSummaryDto {
	return {
		id: user.id,
		email: user.email,
		phone: user.phone,
		fullName: user.fullName,
		role: user.role,
		status: user.status,
		createdAt: user.createdAt,
		updatedAt: user.updatedAt,
	};
}

export function toUserAccountDetail(user: User): UserAccountDetailDto {
	return {
		...toUserAccountSummary(user),
		dateOfBirth: user.dateOfBirth,
		gender: user.gender,
		address: user.address,
		bio: user.bio,
	};
}
