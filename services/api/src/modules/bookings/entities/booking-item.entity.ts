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
import { Booking } from "../../profiles/entities/booking.entity";
import { BookingItemType } from "../booking-item-type.enum";

/**
 * CTMS-040-T01. One line item added to a Booking (currently always an
 * `equipment` rental). `unitPrice`/`rentalDays`/`totalPrice` are
 * authoritative server-computed snapshots taken at add-time (BR-128) --
 * they do not track the live EquipmentCatalogItem price going forward.
 */
@Entity({ name: "booking_items" })
@Check("CHK_booking_items_quantity", `"quantity" > 0`)
@Check("CHK_booking_items_unit_price", `"unit_price" >= 0`)
@Check("CHK_booking_items_rental_days", `"rental_days" > 0`)
@Check("CHK_booking_items_total_price", `"total_price" >= 0`)
export class BookingItem {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "booking_id", type: "uuid" })
	bookingId!: string;

	@ManyToOne(() => Booking, { nullable: false, onDelete: "CASCADE" })
	@JoinColumn({ name: "booking_id", foreignKeyConstraintName: "FK_booking_items_booking_id" })
	booking!: Booking;

	@Column({ name: "item_type", type: "enum", enum: BookingItemType, enumName: "booking_item_type" })
	itemType!: BookingItemType;

	@Column({ name: "equipment_catalog_item_id", type: "uuid" })
	equipmentCatalogItemId!: string;

	@ManyToOne(() => EquipmentCatalogItem, { nullable: false, onDelete: "RESTRICT" })
	@JoinColumn({
		name: "equipment_catalog_item_id",
		foreignKeyConstraintName: "FK_booking_items_equipment_catalog_item_id",
	})
	equipmentCatalogItem!: EquipmentCatalogItem;

	@Column({ type: "int" })
	quantity!: number;

	@Column({ name: "unit_price", type: "numeric", precision: 12, scale: 2 })
	unitPrice!: string;

	@Column({ name: "rental_days", type: "int" })
	rentalDays!: number;

	@Column({ name: "total_price", type: "numeric", precision: 12, scale: 2 })
	totalPrice!: string;

	@Column({ name: "idempotency_key", type: "varchar", length: 128, nullable: true })
	idempotencyKey!: string | null;

	@Column({ name: "request_fingerprint", type: "varchar", length: 64, nullable: true })
	requestFingerprint!: string | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}
