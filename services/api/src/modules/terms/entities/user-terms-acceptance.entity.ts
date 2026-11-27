import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { User } from "../../users/entities/user.entity";
import type { TermsAcceptanceSource, TermsPlatform } from "../terms-content";
import { TermsVersion } from "./terms-version.entity";

@Entity({ name: "user_terms_acceptances" })
@Unique("UQ_user_terms_acceptances_user_version", ["userId", "termsVersionId"])
export class UserTermsAcceptance {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "user_id", type: "uuid" })
	userId!: string;

	@ManyToOne(() => User, { onDelete: "CASCADE" })
	@JoinColumn({ name: "user_id" })
	user!: User;

	@Column({ name: "terms_version_id", type: "uuid" })
	termsVersionId!: string;

	@ManyToOne(() => TermsVersion, { onDelete: "RESTRICT" })
	@JoinColumn({ name: "terms_version_id" })
	termsVersion!: TermsVersion;

	@Column({ type: "varchar", length: 32 })
	version!: string;

	@Column({ name: "accepted_at", type: "timestamptz" })
	acceptedAt!: Date;

	@Column({ type: "varchar", length: 32, default: "reconsent" })
	source!: TermsAcceptanceSource;

	@Column({ type: "varchar", length: 16, default: "api" })
	platform!: TermsPlatform;
}
