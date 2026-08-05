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
}

export enum UserStatus {
	PENDING_VERIFICATION = "pending_verification",
	ACTIVE = "active",
	SUSPENDED = "suspended",
	DELETED = "deleted",
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

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
