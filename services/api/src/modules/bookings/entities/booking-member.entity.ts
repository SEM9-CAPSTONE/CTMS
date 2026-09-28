import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { Booking } from "../../profiles/entities/booking.entity";
import { User } from "../../users/entities/user.entity";
import { BookingMemberStatus } from "../booking-member-status.enum";

@Entity({ name: "booking_members" })
export class BookingMember {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "booking_id", type: "uuid" })
	bookingId!: string;

	@ManyToOne(() => Booking, { nullable: false, onDelete: "CASCADE" })
	@JoinColumn({ name: "booking_id", foreignKeyConstraintName: "FK_booking_members_booking_id" })
	booking!: Booking;

	@Column({ name: "user_id", type: "uuid", nullable: true })
	userId!: string | null;

	@ManyToOne(() => User, { nullable: true, onDelete: "RESTRICT" })
	@JoinColumn({ name: "user_id", foreignKeyConstraintName: "FK_booking_members_user_id" })
	user!: User | null;

	@Column({ name: "is_primary", type: "boolean", default: false })
	isPrimary!: boolean;

	@Column({
		name: "member_status",
		type: "enum",
		enum: BookingMemberStatus,
		enumName: "booking_member_status",
		default: BookingMemberStatus.REGISTERED,
	})
	memberStatus!: BookingMemberStatus;

	@Column({ name: "checked_in_at", type: "timestamptz", nullable: true })
	checkedInAt!: Date | null;

	@Column({ name: "no_show_at", type: "timestamptz", nullable: true })
	noShowAt!: Date | null;

	@Column({ name: "left_at", type: "timestamptz", nullable: true })
	leftAt!: Date | null;

	@Column({ name: "status_updated_by", type: "uuid", nullable: true })
	statusUpdatedBy!: string | null;

	@ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
	@JoinColumn({
		name: "status_updated_by",
		foreignKeyConstraintName: "FK_booking_members_status_updated_by",
	})
	statusUpdater!: User | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
