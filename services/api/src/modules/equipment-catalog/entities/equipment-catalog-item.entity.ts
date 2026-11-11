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
import { EquipmentCatalogStatus } from "../equipment-catalog-status.enum";

const trimmedString = {
	to: (value: string): string => (typeof value === "string" ? value.trim() : value),
	from: (value: string): string => value,
};

// Postgres numeric columns round-trip as strings through node-pg; this keeps
// the entity's own type honest as `number` (matching every other DTO/service
// use of this field) instead of leaking the driver's string representation.
const numericColumn = {
	to: (value: number): number => value,
	from: (value: string | null): number | null => (value === null ? null : Number(value)),
};

/**
 * CTMS-039-T01. MVP quantity-based catalog: `quantityTotal` is the whole
 * inventory count for this item, not a per-asset ledger -- avoids
 * introducing a per-asset maintenance/repair lifecycle, per the Jira task's
 * own explicit scope boundary. `equipment_reservations`/availability math
 * (CTMS-40/41) reads this table but is not built here.
 */
@Entity({ name: "equipment_catalog_items" })
@Check("CHK_equipment_catalog_items_name", `"name" <> '' AND "name" !~ '^[[:space:]]|[[:space:]]$'`)
@Check(
	"CHK_equipment_catalog_items_category",
	`"category" <> '' AND "category" !~ '^[[:space:]]|[[:space:]]$'`
)
@Check("CHK_equipment_catalog_items_quantity_total", `"quantity_total" >= 0`)
@Check("CHK_equipment_catalog_items_rental_price_per_day", `"rental_price_per_day" >= 0`)
export class EquipmentCatalogItem {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "host_id", type: "uuid" })
	hostId!: string;

	@ManyToOne(() => User, { nullable: false, onDelete: "RESTRICT" })
	@JoinColumn({ name: "host_id", foreignKeyConstraintName: "FK_equipment_catalog_items_host_id" })
	host!: User;

	@Column({ type: "varchar", length: 150, transformer: trimmedString })
	name!: string;

	@Column({ type: "varchar", length: 100, transformer: trimmedString })
	category!: string;

	@Column({ name: "quantity_total", type: "int" })
	quantityTotal!: number;

	@Column({
		name: "rental_price_per_day",
		type: "numeric",
		precision: 12,
		scale: 2,
		transformer: numericColumn,
	})
	rentalPricePerDay!: number;

	@Column({
		type: "enum",
		enum: EquipmentCatalogStatus,
		enumName: "equipment_catalog_status_enum",
		default: EquipmentCatalogStatus.ACTIVE,
	})
	status!: EquipmentCatalogStatus;

	@Column({ name: "maintenance_schedule", type: "varchar", length: 500, nullable: true })
	maintenanceSchedule!: string | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
