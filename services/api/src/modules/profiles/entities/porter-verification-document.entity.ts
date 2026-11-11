import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from "typeorm";
import { PorterVerification } from "./porter-verification.entity";

@Entity({ name: "porter_verification_documents" })
export class PorterVerificationDocument {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "porter_id", type: "uuid" })
	porterId!: string;

	@ManyToOne(
		() => PorterVerification,
		(verification) => verification.documents,
		{ onDelete: "CASCADE" }
	)
	@JoinColumn({ name: "porter_id" })
	verification?: PorterVerification;

	@Column({ name: "file_url", type: "varchar", length: 1000 })
	fileUrl!: string;

	@Column({ name: "file_key", type: "varchar", length: 500, nullable: true })
	fileKey!: string | null;

	@Column({ name: "original_name", type: "varchar", length: 255 })
	originalName!: string;

	@Column({ name: "mime_type", type: "varchar", length: 100 })
	mimeType!: string;

	@Column({ name: "size_bytes", type: "integer" })
	sizeBytes!: number;

	@CreateDateColumn({ name: "uploaded_at", type: "timestamptz" })
	uploadedAt!: Date;
}
