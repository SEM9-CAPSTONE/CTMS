import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { TrekkingRoute } from "../../trekking-routes/entities/trekking-route.entity";
import { User } from "../../users/entities/user.entity";

export enum PorterRouteProficiency {
	LEARNING = "learning",
	PROFICIENT = "proficient",
	EXPERT = "expert",
}

@Entity({ name: "porter_route_qualifications" })
export class PorterRouteQualification {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "porter_id", type: "uuid" })
	porterId!: string;

	@ManyToOne(() => User, { onDelete: "CASCADE" })
	@JoinColumn({ name: "porter_id" })
	porter!: User;

	@Column({ name: "route_id", type: "uuid" })
	routeId!: string;

	@ManyToOne(() => TrekkingRoute, { onDelete: "RESTRICT" })
	@JoinColumn({ name: "route_id" })
	route!: TrekkingRoute;

	@Column({
		type: "enum",
		enum: PorterRouteProficiency,
		enumName: "porter_route_proficiency",
	})
	proficiency!: PorterRouteProficiency;

	@Column({ name: "times_led", type: "integer", default: 0 })
	timesLed!: number;

	@Column({ name: "verified_by", type: "uuid", nullable: true })
	verifiedBy!: string | null;

	@ManyToOne(() => User, { nullable: true, onDelete: "RESTRICT" })
	@JoinColumn({ name: "verified_by" })
	verifier!: User | null;

	@Column({ name: "verified_at", type: "timestamptz", nullable: true })
	verifiedAt!: Date | null;

	@Column({ type: "integer", default: 1 })
	version!: number;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
