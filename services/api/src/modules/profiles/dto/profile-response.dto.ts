import { ApiProperty } from "@nestjs/swagger";
import type { User } from "../../users/entities/user.entity";
import { UserGender, UserRole, UserStatus } from "../../users/entities/user.entity";
import type { EmergencyContact } from "../entities/emergency-contact.entity";

export class EmergencyContactResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty()
	name!: string;

	@ApiProperty()
	relationship!: string;

	@ApiProperty()
	phone!: string;

	@ApiProperty({ type: String, nullable: true })
	email!: string | null;
}

export class ProfileResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ type: String, nullable: true })
	email!: string | null;

	@ApiProperty({ type: String, nullable: true })
	phone!: string | null;

	@ApiProperty({ enum: UserRole })
	role!: UserRole;

	@ApiProperty({ enum: UserRole, isArray: true })
	roles!: UserRole[];

	@ApiProperty({ enum: UserStatus })
	status!: UserStatus;

	@ApiProperty({ type: String, nullable: true })
	fullName!: string | null;

	@ApiProperty({ type: String, nullable: true, example: "1995-04-12" })
	dateOfBirth!: string | null;

	@ApiProperty({ enum: UserGender, nullable: true })
	gender!: UserGender | null;

	@ApiProperty({ type: String, nullable: true })
	address!: string | null;

	@ApiProperty({ type: String, nullable: true })
	bio!: string | null;

	@ApiProperty({ type: [EmergencyContactResponseDto] })
	emergencyContacts!: EmergencyContactResponseDto[];

	@ApiProperty()
	createdAt!: Date;

	@ApiProperty()
	updatedAt!: Date;
}

export function toEmergencyContactResponse(contact: EmergencyContact): EmergencyContactResponseDto {
	return {
		id: contact.id,
		name: contact.name,
		relationship: contact.relationship,
		phone: contact.phone,
		email: contact.email,
	};
}

export function toProfileResponse(
	user: User,
	emergencyContacts: EmergencyContact[]
): ProfileResponseDto {
	const roles = user.roleAssignments?.map((assignment) => assignment.role) ?? [user.role];
	return {
		id: user.id,
		email: user.email,
		phone: user.phone,
		role: user.role,
		roles,
		status: user.status,
		fullName: user.fullName,
		dateOfBirth: user.dateOfBirth,
		gender: user.gender,
		address: user.address,
		bio: user.bio,
		emergencyContacts: emergencyContacts.map(toEmergencyContactResponse),
		createdAt: user.createdAt,
		updatedAt: user.updatedAt,
	};
}
