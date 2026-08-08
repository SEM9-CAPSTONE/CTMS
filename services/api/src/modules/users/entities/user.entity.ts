import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";

export enum UserRole {
	CAMPER = "camper",
	HOST = "host",
	PORTER = "porter",
	ADMIN = "admin",
}

export enum UserStatus {
	PENDING_VERIFICATION = "pending_verification",
	ACTIVE = "active",
	SUSPENDED = "suspended",
	DELETED = "deleted",
}

export enum UserGender {
	MALE = "male",
	FEMALE = "female",
	OTHER = "other",
}

@Entity({ name: "users" })
export class User {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ type: "varchar", length: 254, unique: true, nullable: true })
	email!: string | null;

	@Column({ type: "varchar", length: 16, unique: true, nullable: true })
	phone!: string | null;

	@Column({ name: "password_hash", type: "varchar" })
	passwordHash!: string;

	@Column({ type: "enum", enum: UserRole })
	role!: UserRole;

	@Column({
		type: "enum",
		enum: UserStatus,
		default: UserStatus.PENDING_VERIFICATION,
	})
	status!: UserStatus;

	@Column({ name: "full_name", type: "varchar", length: 50, nullable: true })
	fullName!: string | null;

	@Column({ name: "date_of_birth", type: "date", nullable: true })
	dateOfBirth!: string | null;

	@Column({ type: "enum", enum: UserGender, nullable: true })
	gender!: UserGender | null;

	@Column({ type: "varchar", length: 200, nullable: true })
	address!: string | null;

	@Column({ type: "varchar", length: 500, nullable: true })
	bio!: string | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
