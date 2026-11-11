import { ApiProperty } from "@nestjs/swagger";
import { UserStatus } from "../../users/entities/user.entity";
import {
	type AllergyItem,
	BloodType,
	FitnessLevel,
	type HealthProfile,
	type MedicalConditionItem,
} from "../entities/health-profile.entity";

export class HealthSharingConsentDto {
	@ApiProperty()
	isConsentGranted!: boolean;

	@ApiProperty({ required: false })
	grantedAt?: string;

	@ApiProperty({ required: false })
	revokedAt?: string;

	@ApiProperty({ type: [String] })
	allowedRoles!: string[];

	@ApiProperty({ required: false })
	activeTripScope?: string;
}

export class HealthProfileResponseDto {
	@ApiProperty()
	id!: string;

	@ApiProperty()
	camperId!: string;

	@ApiProperty()
	camperName!: string;

	@ApiProperty({ enum: BloodType })
	bloodType!: BloodType;

	@ApiProperty({ enum: FitnessLevel })
	physicalFitnessLevel!: FitnessLevel;

	@ApiProperty()
	dietaryRestrictions!: string;

	@ApiProperty()
	emergencyNotes!: string;

	@ApiProperty()
	allergies!: AllergyItem[];

	@ApiProperty()
	medicalConditions!: MedicalConditionItem[];

	@ApiProperty({ type: HealthSharingConsentDto })
	consent!: HealthSharingConsentDto;

	@ApiProperty({ enum: ["ACTIVE", "PENDING_VERIFICATION", "SUSPENDED", "DELETED"] })
	accountStatus!: "ACTIVE" | "PENDING_VERIFICATION" | "SUSPENDED" | "DELETED";

	@ApiProperty()
	updatedAt!: string;

	@ApiProperty()
	version!: number;
}

export function toHealthProfileResponse(
	entity: HealthProfile,
	activeTripTitle?: string
): HealthProfileResponseDto {
	// Map database enum UserStatus to response accountStatus format
	let statusMapping: "ACTIVE" | "PENDING_VERIFICATION" | "SUSPENDED" | "DELETED" = "ACTIVE";
	if (entity.user.status === UserStatus.PENDING_VERIFICATION) {
		statusMapping = "PENDING_VERIFICATION";
	} else if (entity.user.status === UserStatus.SUSPENDED) {
		statusMapping = "SUSPENDED";
	} else if (entity.user.status === UserStatus.DELETED) {
		statusMapping = "DELETED";
	}

	return {
		id: entity.id,
		camperId: entity.userId,
		camperName: entity.user.fullName || "",
		bloodType: entity.bloodType,
		physicalFitnessLevel: entity.physicalFitnessLevel,
		dietaryRestrictions: entity.dietaryRestrictions || "",
		emergencyNotes: entity.emergencyNotes || "",
		allergies: entity.allergies,
		medicalConditions: entity.medicalConditions,
		consent: {
			isConsentGranted: entity.isConsentGranted,
			grantedAt: entity.consentGrantedAt?.toISOString(),
			revokedAt: entity.consentRevokedAt?.toISOString(),
			allowedRoles: ["HOST", "PORTER"],
			activeTripScope: activeTripTitle,
		},
		accountStatus: statusMapping,
		updatedAt: entity.updatedAt.toISOString(),
		version: entity.version,
	};
}
