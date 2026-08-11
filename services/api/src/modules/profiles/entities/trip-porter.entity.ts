import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
// biome-ignore lint/style/useImportType: constructor-injected or referenced by TypeORM
import { User } from "../../users/entities/user.entity";
// biome-ignore lint/style/useImportType: constructor-injected or referenced by TypeORM
import { Trip } from "./trip.entity";

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
}
