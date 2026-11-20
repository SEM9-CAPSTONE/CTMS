import {
	Column,
	CreateDateColumn,
	DeleteDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";

export enum PorterCertificateType {
	WFA = "wfa",
	RESCUE = "rescue",
	GUIDE_CARD = "guide_card",
	OTHER = "other",
}

export enum PorterCertificateStatus {
	PENDING = "pending",
	VERIFIED = "verified",
	REJECTED = "rejected",
}

@Entity({ name: "porter_certificates" })
export class PorterCertificate {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "porter_id", type: "uuid" })
	porterId!: string;

	@ManyToOne(() => User, { onDelete: "CASCADE" })
	@JoinColumn({ name: "porter_id" })
	porter!: User;

	@Column({
		type: "enum",
		enum: PorterCertificateType,
		enumName: "porter_certificate_type",
	})
	type!: PorterCertificateType;

	@Column({ type: "varchar", length: 255 })
	name!: string;

	@Column({ name: "certificate_number", type: "varchar", length: 100, nullable: true })
	certificateNumber!: string | null;

	@Column({ name: "issued_by", type: "varchar", length: 255, nullable: true })
	issuedBy!: string | null;

	@Column({ name: "issued_date", type: "date", nullable: true })
	issuedDate!: string | null;

	@Column({ name: "expiry_date", type: "date", nullable: true })
	expiryDate!: string | null;

	@Column({ name: "file_url", type: "varchar", length: 1000, nullable: true })
	fileUrl!: string | null;

	@Column({
		type: "enum",
		enum: PorterCertificateStatus,
		enumName: "porter_certificate_status",
		default: PorterCertificateStatus.PENDING,
	})
	status!: PorterCertificateStatus;

	@Column({ name: "rejection_reason", type: "varchar", length: 1000, nullable: true })
	rejectionReason!: string | null;

	@Column({ name: "verified_by", type: "uuid", nullable: true })
	verifiedBy!: string | null;

	@ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
	@JoinColumn({ name: "verified_by" })
	verifier?: User | null;

	@Column({ name: "verified_at", type: "timestamptz", nullable: true })
	verifiedAt!: Date | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;

	@DeleteDateColumn({ name: "deleted_at", type: "timestamptz", nullable: true })
	deletedAt!: Date | null;

	/**
	 * Dynamic calculation on read: Checks if the certificate has expired based on current time.
	 * Never persisted as a static DB status.
	 */
	get isExpired(): boolean {
		if (!this.expiryDate) return false;
		const today = new Date().toISOString().split("T")[0];
		return this.expiryDate < today;
	}
}
