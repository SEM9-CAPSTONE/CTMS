import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from "typeorm";
// biome-ignore lint/style/useImportType: constructor-injected or referenced by TypeORM
import { TrekkingRoute } from "../../trekking-routes/entities/trekking-route.entity";
// biome-ignore lint/style/useImportType: constructor-injected or referenced by TypeORM
import { User } from "../../users/entities/user.entity";

@Entity({ name: "trips" })
export class Trip {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ type: "varchar", length: 100 })
	title!: string;

	@Column({ name: "host_id", type: "uuid" })
	hostId!: string;

	@ManyToOne(() => User, { onDelete: "CASCADE" })
	@JoinColumn({ name: "host_id" })
	host!: User;

	@Column({ name: "route_id", type: "uuid", nullable: true })
	routeId?: string | null;

	@ManyToOne(() => TrekkingRoute, { onDelete: "SET NULL", nullable: true })
	@JoinColumn({ name: "route_id" })
	route?: TrekkingRoute | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}
