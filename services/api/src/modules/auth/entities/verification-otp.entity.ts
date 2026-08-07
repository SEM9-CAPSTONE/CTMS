import { Column, Entity, PrimaryColumn } from "typeorm";

/**
 * One row per user (`user_id` is the primary key itself, not a separate
 * surrogate id + UNIQUE constraint — see Step 1 review: with the 1-row-per-user
 * design there is nothing left for a separate id to identify).
 *
 * A resend overwrites this same row (regenerates codeHash/expiresAt) instead
 * of inserting a new one — see Step 1 review section 3 for the 1-row-vs-many
 * rows analysis and why this also helps BR-230 (no duplicate records on retry).
 *
 * Every column below must map to at least one AC/BR of CTMS-02 — see the
 * Field -> BR/AC table in the Step 1 review. Fields with no such mapping
 * (consumedAt, createdAt, updatedAt) were removed.
 */
@Entity({ name: "verification_otps" })
export class VerificationOtp {
	/** BR-214 (FK to an existing, valid users row) + identifies which account this OTP verifies (AC3). */
	@PrimaryColumn({ name: "user_id", type: "uuid" })
	userId!: string;

	/** AC3: the value verify-otp must compare the submitted code against. */
	@Column({ name: "code_hash", type: "varchar" })
	codeHash!: string;

	/** BR-006, AC1, AC3: OTP must expire; verify must reject an expired code. */
	@Column({ name: "expires_at", type: "timestamptz" })
	expiresAt!: Date;

	/** BR-007, AC2: resend attempts within the current window (see windowStartedAt). */
	@Column({ name: "send_count", type: "int", default: 1 })
	sendCount!: number;

	/** BR-007, AC2: start of the current resend-limit window; resets sendCount when the window elapses. */
	@Column({ name: "window_started_at", type: "timestamptz" })
	windowStartedAt!: Date;
}
