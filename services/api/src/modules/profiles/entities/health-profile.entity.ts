import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	OneToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
// biome-ignore lint/style/useImportType: constructor-injected or referenced by TypeORM
import { User } from "../../users/entities/user.entity";

export enum BloodType {
	A_PLUS = "A+",
	A_MINUS = "A-",
	B_PLUS = "B+",
	B_MINUS = "B-",
	AB_PLUS = "AB+",
	AB_MINUS = "AB-",
	O_PLUS = "O+",
	O_MINUS = "O-",
	UNKNOWN = "UNKNOWN",
}

export enum FitnessLevel {
	BEGINNER = "BEGINNER",
	INTERMEDIATE = "INTERMEDIATE",
	ADVANCED = "ADVANCED",
	EXPERT = "EXPERT",
}

export interface AllergyItem {
	id: string;
	name: string;
	severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
	reaction?: string;
}

export interface MedicalConditionItem {
	id: string;
	name: string;
	medication?: string;
	notes?: string;
}

@Entity({ name: "health_profiles" })
export class HealthProfile {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "user_id", type: "uuid", unique: true })
	userId!: string;

	@OneToOne(() => User, { onDelete: "CASCADE" })
	@JoinColumn({ name: "user_id" })
	user!: User;

	@Column({
		name: "blood_type",
		type: "enum",
		enum: BloodType,
		default: BloodType.UNKNOWN,
	})
	bloodType!: BloodType;

	@Column({
		name: "physical_fitness_level",
		type: "enum",
		enum: FitnessLevel,
		default: FitnessLevel.BEGINNER,
	})
	physicalFitnessLevel!: FitnessLevel;

	@Column({ name: "dietary_restrictions", type: "varchar", length: 300, nullable: true })
	dietaryRestrictions!: string | null;

	@Column({ name: "emergency_notes", type: "varchar", length: 500, nullable: true })
	emergencyNotes!: string | null;

	@Column({ type: "jsonb", default: "[]" })
	allergies!: AllergyItem[];

	@Column({ name: "medical_conditions", type: "jsonb", default: "[]" })
	medicalConditions!: MedicalConditionItem[];

	@Column({ name: "is_consent_granted", type: "boolean", default: false })
	isConsentGranted!: boolean;

	@Column({ name: "consent_granted_at", type: "timestamptz", nullable: true })
	consentGrantedAt!: Date | null;

	@Column({ name: "consent_revoked_at", type: "timestamptz", nullable: true })
	consentRevokedAt!: Date | null;

	@Column({ type: "integer", default: 1 })
	version!: number;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
