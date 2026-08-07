import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/**
 * One row per issued refresh token (not one row per user — a user can be
 * logged in on multiple devices at once, unlike verification_otps which is
 * intentionally 1-row-per-user). Only the SHA-256 hash of the token is ever
 * persisted, never the raw value (same "never store the raw secret"
 * principle already applied to OTPs and passwords).
 *
 * Minimal field set per Tech Lead review: no device/ip/userAgent — not
 * required by the current spec (CTMS-03). `revokedAt` is included even
 * though this story never sets it, so CTMS-08 (logout current/all devices)
 * doesn't need a schema migration to add revocation support later.
 */
@Entity({ name: "refresh_tokens" })
export class RefreshToken {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	/** BR-214 (FK to an existing, valid users row). */
	@Column({ name: "user_id", type: "uuid" })
	userId!: string;

	/** SHA-256 hex digest of the raw refresh token — never the raw value.
	 * Unique so CTMS-04's refresh-exchange lookup can index directly on it. */
	@Index({ unique: true })
	@Column({ name: "token_hash", type: "varchar" })
	tokenHash!: string;

	@Column({ name: "expires_at", type: "timestamptz" })
	expiresAt!: Date;

	/** Not set by CTMS-03 — reserved for CTMS-08 (logout) to mark a token
	 * revoked without a future migration. */
	@Column({ name: "revoked_at", type: "timestamptz", nullable: true })
	revokedAt!: Date | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}
