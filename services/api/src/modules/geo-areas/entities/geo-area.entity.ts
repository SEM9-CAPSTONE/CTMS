import { Column, CreateDateColumn, Entity, PrimaryColumn } from "typeorm";

/**
 * CTMS-110. Reporting area reference list (Đà Nẵng former districts in the MVP). Trips copy the
 * code and names into their own snapshot columns, so editing a row here never rewrites reports.
 */
@Entity({ name: "geo_areas" })
export class GeoArea {
	@PrimaryColumn({ type: "varchar", length: 32 })
	code!: string;

	@Column({ name: "province_code", type: "varchar", length: 16 })
	provinceCode!: string;

	@Column({ name: "province_name", type: "varchar", length: 100 })
	provinceName!: string;

	@Column({ type: "varchar", length: 100 })
	name!: string;

	@Column({ name: "sort_order", type: "smallint", default: 0 })
	sortOrder!: number;

	@Column({ type: "boolean", default: true })
	active!: boolean;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}
