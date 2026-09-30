import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
// biome-ignore lint/style/useImportType: constructor-injected or referenced by TypeORM
import { Trip } from "../../trips/entities/trip.entity";
// biome-ignore lint/style/useImportType: constructor-injected or referenced by TypeORM
import { User } from "../../users/entities/user.entity";

export enum TripPorterStatus {
	ASSIGNED = "assigned",
	PENDING_RECONFIRMATION = "pending_reconfirmation",
	UNASSIGNED = "unassigned",
}

@Entity({ name: "trip_porters" })
export class TripPorter {
	@PrimaryColumn({ name: "trip_id", type: "uuid" })
	tripId!: string;

	@ManyToOne(() => Trip, { onDelete: "CASCADE" })
	@JoinColumn({ name: "trip_id" })
	trip!: Trip;

	@PrimaryColumn({ name: "porter_id", type: "uuid" })
	porterId!: string;

	@ManyToOne(() => User, { onDelete: "CASCADE" })
	@JoinColumn({ name: "porter_id" })
	porter!: User;

	@Column({
		type: "enum",
		enum: TripPorterStatus,
		enumName: "trip_porter_status",
		default: TripPorterStatus.ASSIGNED,
	})
	status!: TripPorterStatus;

	@Column({ name: "reconfirmation_deadline", type: "timestamptz", nullable: true })
	reconfirmationDeadline!: Date | null;

	@Column({ name: "reconfirmed_at", type: "timestamptz", nullable: true })
	reconfirmedAt!: Date | null;

	@Column({ name: "declined_at", type: "timestamptz", nullable: true })
	declinedAt!: Date | null;
}
