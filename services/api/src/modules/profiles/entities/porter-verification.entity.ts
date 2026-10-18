import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	OneToMany,
	OneToOne,
	PrimaryColumn,
	UpdateDateColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { PorterVerificationDocument } from "./porter-verification-document.entity";

export enum PorterVerificationStatus {
	PENDING_DOCUMENTS = "pending_documents",
	PENDING_REVIEW = "pending_review",
	APPROVED = "approved",
	REJECTED = "rejected",
}

@Entity({ name: "porter_verifications" })
export class PorterVerification {
	@PrimaryColumn({ name: "porter_id", type: "uuid" })
	porterId!: string;

	@OneToOne(() => User, { onDelete: "CASCADE" })
	@JoinColumn({ name: "porter_id" })
	porter!: User;

	@Column({
		type: "enum",
		enum: PorterVerificationStatus,
		enumName: "porter_verification_status",
		default: PorterVerificationStatus.PENDING_DOCUMENTS,
	})
	status!: PorterVerificationStatus;

	@Column({ name: "submitted_at", type: "timestamptz", nullable: true })
	submittedAt!: Date | null;

	@Column({ name: "reviewed_by", type: "uuid", nullable: true })
	reviewedBy!: string | null;

	@Column({ name: "reviewed_at", type: "timestamptz", nullable: true })
	reviewedAt!: Date | null;

	@Column({ name: "rejection_reason", type: "varchar", length: 500, nullable: true })
	rejectionReason!: string | null;

	@Column({ type: "integer", default: 1 })
	version!: number;

	@OneToMany(
		() => PorterVerificationDocument,
		(document) => document.verification
	)
	documents?: PorterVerificationDocument[];

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
