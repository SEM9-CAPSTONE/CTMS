import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";
import type { RiskLevel } from "../../weather/entities/weather-risk-assessment.entity";

/** BR-137: the authoritative inputs a packing list was generated from. No health details are stored. */
export interface PackingListGeneratedFrom {
	rulesVersion: string;
	tripId: string;
	durationNights: number;
	tripType: "day_trip" | "overnight";
	difficulty: string | null;
	memberCount: number;
	weatherAssessment: { id: string; riskLevel: RiskLevel } | null;
	rentedEquipment: Array<{ equipmentCatalogItemId: string; quantity: number }>;
	healthProfile: { considered: boolean; updatedAt: string | null };
}

/** One row per distinct input set of a Booking's packing list (BR-137, BR-219). */
@Entity({ name: "packing_list_generations" })
export class PackingListGeneration {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "booking_id", type: "uuid" })
	bookingId!: string;

	@Column({ name: "generated_from", type: "jsonb" })
	generatedFrom!: PackingListGeneratedFrom;

	/** sha256 of `generatedFrom`; unique per Booking so unchanged inputs never create a second row. */
	@Column({ name: "input_fingerprint", type: "varchar", length: 64 })
	inputFingerprint!: string;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}
