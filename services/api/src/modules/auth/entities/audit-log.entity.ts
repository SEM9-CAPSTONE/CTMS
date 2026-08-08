import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "audit_logs" })
export class AuditLog {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "actor_id", type: "uuid", nullable: true })
	actorId!: string | null;

	@Column({ type: "varchar", length: 80 })
	action!: string;

	@Column({ name: "target_type", type: "varchar", length: 80 })
	targetType!: string;

	@Column({ name: "target_id", type: "uuid" })
	targetId!: string;

	@Column({ type: "jsonb", nullable: true })
	before!: Record<string, unknown> | null;

	@Column({ type: "jsonb", nullable: true })
	after!: Record<string, unknown> | null;

	@Column({ type: "varchar", length: 255, nullable: true })
	reason!: string | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}
