import {
	Check,
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from "typeorm";
import { EquipmentCatalogItem } from "../../equipment-catalog/entities/equipment-catalog-item.entity";
import { BookingItem } from "./booking-item.entity";

export enum EquipmentReservationStatus {
	ACTIVE = "active",
	CANCELLED = "cancelled",
}

/**
 * CTMS-040-T01. The authoritative inventory-holding record for one
 * equipment rental (BR-123/127/129): overlap/availability checks sum
 * `quantity` across reservations of the same EquipmentCatalogItem whose
 * date range intersects the requested range, guarded by a pessimistic
 * lock on the EquipmentCatalogItem row so concurrent adds cannot exceed
 * `quantity_total`.
 */
@Entity({ name: "equipment_reservations" })
@Check("CHK_equipment_reservations_quantity", `"quantity" > 0`)
@Check("CHK_equipment_reservations_date_range", `"rental_end_date" >= "rental_start_date"`)
export class EquipmentReservation {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "booking_item_id", type: "uuid" })
	bookingItemId!: string;

	@ManyToOne(() => BookingItem, { nullable: false, onDelete: "CASCADE" })
	@JoinColumn({
		name: "booking_item_id",
		foreignKeyConstraintName: "FK_equipment_reservations_booking_item_id",
	})
	bookingItem!: BookingItem;

	@Column({ name: "equipment_catalog_item_id", type: "uuid" })
	equipmentCatalogItemId!: string;

	@ManyToOne(() => EquipmentCatalogItem, { nullable: false, onDelete: "RESTRICT" })
	@JoinColumn({
		name: "equipment_catalog_item_id",
		foreignKeyConstraintName: "FK_equipment_reservations_equipment_catalog_item_id",
	})
	equipmentCatalogItem!: EquipmentCatalogItem;

	@Column({ type: "int" })
	quantity!: number;

	@Column({ name: "rental_start_date", type: "date" })
	rentalStartDate!: string;

	@Column({ name: "rental_end_date", type: "date" })
	rentalEndDate!: string;

	@Column({
		type: "enum",
		enum: EquipmentReservationStatus,
		enumName: "equipment_reservation_status",
		default: EquipmentReservationStatus.ACTIVE,
	})
	status!: EquipmentReservationStatus;

	@Column({ name: "cancelled_at", type: "timestamptz", nullable: true })
	cancelledAt!: Date | null;

	@Column({ name: "cancellation_reason", type: "varchar", length: 500, nullable: true })
	cancellationReason!: string | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}
