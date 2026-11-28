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

export enum BookingMemberInvitationStatus {
	PENDING = "pending",
	ACCEPTED = "accepted",
	DECLINED = "declined",
	REVOKED = "revoked",
	EXPIRED = "expired",
}

@Entity({ name: "booking_member_invitations" })
export class BookingMemberInvitation {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "booking_id", type: "uuid" })
	bookingId!: string;

	@ManyToOne(() => Booking, { nullable: false, onDelete: "CASCADE" })
	@JoinColumn({
		name: "booking_id",
		foreignKeyConstraintName: "FK_booking_member_invitations_booking_id",
	})
	booking!: Booking;

	@Column({ name: "invited_by_user_id", type: "uuid" })
	invitedByUserId!: string;

	@ManyToOne(() => User, { nullable: false, onDelete: "RESTRICT" })
	@JoinColumn({
		name: "invited_by_user_id",
		foreignKeyConstraintName: "FK_booking_member_invitations_invited_by_user_id",
	})
	invitedByUser!: User;

	@Column({ name: "invited_email", type: "varchar", length: 254 })
	invitedEmail!: string;

	@Column({ name: "invited_user_id", type: "uuid", nullable: true })
	invitedUserId!: string | null;

	@ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
	@JoinColumn({
		name: "invited_user_id",
		foreignKeyConstraintName: "FK_booking_member_invitations_invited_user_id",
	})
	invitedUser!: User | null;

	@Column({ name: "token", type: "varchar", length: 128, unique: true })
	token!: string;

	@Column({
		name: "status",
		type: "enum",
		enum: BookingMemberInvitationStatus,
		enumName: "booking_member_invitation_status",
		default: BookingMemberInvitationStatus.PENDING,
	})
	status!: BookingMemberInvitationStatus;

	@Column({ name: "expires_at", type: "timestamptz" })
	expiresAt!: Date;

	@Column({ name: "responded_at", type: "timestamptz", nullable: true })
	respondedAt!: Date | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
