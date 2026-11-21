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

/** Accepted tour-guide card types; site-only ("tại điểm") cards are not accepted. */
export enum GuideCardType {
	DOMESTIC = "noi_dia",
	INTERNATIONAL = "quoc_te",
}

/** Automatic check of the card photo against the declared data (see guide-card-check.ts). */
export interface GuideCardCheckResult {
	labels: string[];
	reading: {
		fullName: string | null;
		cardNumber: string | null;
		cardType: string | null;
		expiresOn: string | null;
		confidence: number | null;
		documentId: string | null;
	} | null;
	autoRejected: boolean;
}

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

	@Column({ name: "guide_card_type", type: "varchar", length: 16, nullable: true })
	guideCardType!: GuideCardType | null;

	@Column({ name: "guide_card_number", type: "varchar", length: 9, nullable: true })
	guideCardNumber!: string | null;

	/** `YYYY-MM-DD`; the card is valid through this date. */
	@Column({ name: "guide_card_expires_on", type: "date", nullable: true })
	guideCardExpiresOn!: string | null;

	@Column({ name: "card_check", type: "jsonb", nullable: true })
	cardCheck!: GuideCardCheckResult | null;

	@Column({ name: "card_checked_at", type: "timestamptz", nullable: true })
	cardCheckedAt!: Date | null;

	/** The Admin who confirmed the card on the official registry (huongdanvien.vn). */
	@Column({ name: "registry_checked_by", type: "uuid", nullable: true })
	registryCheckedBy!: string | null;

	@Column({ name: "registry_checked_at", type: "timestamptz", nullable: true })
	registryCheckedAt!: Date | null;

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
