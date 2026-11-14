import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";
import type { TrekkingRouteDifficulty } from "../../trekking-routes/entities/trekking-route.entity";
import type { TripType } from "../../trips/entities/trip.entity";
import type { TripRegionCode } from "../trip-regions";

/** CTMS-106. One row per Camper; empty arrays and null prices mean "not chosen". */
@Entity({ name: "camper_trip_preferences" })
export class CamperTripPreference {
	@PrimaryColumn({ name: "user_id", type: "uuid" })
	userId!: string;

	@Column({ name: "trip_types", type: "text", array: true, default: () => "'{}'" })
	tripTypes!: TripType[];

	@Column({ type: "text", array: true, default: () => "'{}'" })
	difficulties!: TrekkingRouteDifficulty[];

	@Column({ type: "text", array: true, default: () => "'{}'" })
	regions!: TripRegionCode[];

	@Column({ name: "min_price", type: "int", nullable: true })
	minPrice!: number | null;

	@Column({ name: "max_price", type: "int", nullable: true })
	maxPrice!: number | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
