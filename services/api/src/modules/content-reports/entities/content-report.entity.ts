import {
	Check,
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { ContentReportStatus } from "../content-report-status.enum";

// Normalizes ORM writes from the owning reporting workflow; no creation API in T01.
const trimmedString = {
	to: (value: string): string => (typeof value === "string" ? value.trim() : value),
	from: (value: string): string => value,
};

@Entity({ name: "content_reports" })
@Check(
	"CHK_content_reports_target_type",
	`"target_type" <> '' AND "target_type" !~ '^[[:space:]]|[[:space:]]$'`
)
@Check("CHK_content_reports_reason", `"reason" <> '' AND "reason" !~ '^[[:space:]]|[[:space:]]$'`)
export class ContentReport {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "reporter_id", type: "uuid" })
	reporterId!: string;

	@ManyToOne(() => User, { nullable: false, onDelete: "NO ACTION" })
	@JoinColumn({ name: "reporter_id", foreignKeyConstraintName: "FK_content_reports_reporter_id" })
	reporter!: User;

	@Column({ name: "target_type", type: "varchar", length: 100, transformer: trimmedString })
	targetType!: string;

	@Column({ name: "target_id", type: "uuid" })
	targetId!: string;

	@Column({ type: "varchar", length: 1000, transformer: trimmedString })
	reason!: string;

	@Column({
		type: "enum",
		enum: ContentReportStatus,
		enumName: "content_reports_status_enum",
		default: ContentReportStatus.PENDING,
	})
	status!: ContentReportStatus;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
