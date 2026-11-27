import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import type { TermsSection } from "../terms-content";

@Entity({ name: "terms_versions" })
export class TermsVersion {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ type: "varchar", length: 32, unique: true })
	version!: string;

	@Column({ type: "varchar", length: 200 })
	title!: string;

	@Column({ type: "text", nullable: true })
	summary!: string | null;

	@Column({ name: "effective_date", type: "date" })
	effectiveDate!: string;

	@Column({ type: "jsonb" })
	sections!: TermsSection[];

	@Column({ name: "is_active", type: "boolean", default: false })
	isActive!: boolean;

	@Column({ name: "requires_reconsent", type: "boolean", default: true })
	requiresReconsent!: boolean;

	@Column({ name: "published_at", type: "timestamptz" })
	publishedAt!: Date;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
