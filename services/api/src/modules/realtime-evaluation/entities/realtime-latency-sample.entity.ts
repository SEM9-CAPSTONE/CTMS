import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/**
 * CTMS-100 / BR-265: timing of one event delivered to one evaluation client. Only timing metadata
 * is kept; the event payload is never stored here (AC1, spec §8).
 */
@Entity({ name: "realtime_latency_samples" })
@Index("IDX_realtime_latency_samples_report", ["reportId", "eventType"])
export class RealtimeLatencySampleEntity {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "report_id", type: "uuid" })
	reportId!: string;

	@Column({ type: "varchar", length: 32 })
	scenario!: string;

	@Column({ name: "event_type", type: "varchar", length: 64 })
	eventType!: string;

	@Column({ name: "event_id", type: "uuid", nullable: true })
	eventId!: string | null;

	@Column({ type: "bigint", nullable: true })
	sequence!: string | null;

	@Column({ name: "client_index", type: "integer" })
	clientIndex!: number;

	/** Not measured: a warm-up event of the stable-connection rule. */
	@Column({ type: "boolean", default: false })
	warmup!: boolean;

	@Column({ name: "sent_at", type: "timestamptz", nullable: true })
	sentAt!: Date | null;

	/** Null when the event never arrived within the delivery timeout. */
	@Column({ name: "received_at", type: "timestamptz", nullable: true })
	receivedAt!: Date | null;

	@Column({ name: "acknowledged_at", type: "timestamptz", nullable: true })
	acknowledgedAt!: Date | null;

	@Column({ name: "latency_ms", type: "double precision", nullable: true })
	latencyMs!: number | null;
}
