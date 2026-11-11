import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { DataSource, type EntityManager } from "typeorm";
import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import { BookingStatus } from "../profiles/entities/booking.entity";
import { TripPorterStatus } from "../profiles/entities/trip-porter.entity";
import {
	type BroadcastRecipient,
	type BroadcastTrip,
	type EmergencyAlertType,
	type EmergencyBroadcast,
	EmergencyBroadcastRecipientRole,
} from "./emergency-broadcasts.types";

/** Same Trip-team rule as the CTMS-078 `trip.subscribe` authorization. */
const RECIPIENT_MEMBER_STATUSES = [BookingMemberStatus.REGISTERED, BookingMemberStatus.JOINED];
const PARTICIPATING_BOOKING_STATUSES = [BookingStatus.CONFIRMED, BookingStatus.COMPLETED];

const BROADCAST_COLUMNS = `b."id", b."trip_id" AS "tripId", b."host_id" AS "hostId", b."alert_type" AS "alertType",
 b."content", b."recipient_count" AS "recipientCount", b."created_at" AS "createdAt"`;

export interface NewEmergencyBroadcast {
	id: string;
	tripId: string;
	hostId: string;
	alertType: EmergencyAlertType;
	content: string;
}

export type CreateBroadcastResult =
	| { created: true; broadcast: EmergencyBroadcast; recipients: BroadcastRecipient[] }
	| { created: false; broadcast: EmergencyBroadcast };

@Injectable()
export class EmergencyBroadcastsRepository {
	constructor(private readonly db: DataSource) {}

	async findTrip(tripId: string): Promise<BroadcastTrip | null> {
		const rows = await this.db.query<BroadcastTrip[]>(
			`SELECT "id", "host_id" AS "hostId", "status"::text AS "status", "title" FROM "trips" WHERE "id" = $1`,
			[tripId]
		);
		return rows[0] ?? null;
	}

	async findById(id: string): Promise<EmergencyBroadcast | null> {
		const rows = await this.db.query<EmergencyBroadcast[]>(
			`SELECT ${BROADCAST_COLUMNS} FROM "emergency_broadcasts" b WHERE b."id" = $1`,
			[id]
		);
		return rows[0] ?? null;
	}

	/**
	 * Persists the broadcast, its frozen recipient list and the audit record in one transaction.
	 * A concurrent or retried request with the same ID hits the primary key and gets the stored row.
	 */
	async create(input: NewEmergencyBroadcast): Promise<CreateBroadcastResult> {
		const result = await this.db.transaction(async (manager) => {
			const recipients = await this.resolveRecipients(manager, input.tripId);
			const inserted = await manager.query<EmergencyBroadcast[]>(
				`INSERT INTO "emergency_broadcasts" AS b ("id", "trip_id", "host_id", "alert_type", "content", "recipient_count")
				 VALUES ($1, $2, $3, $4, $5, $6)
				 ON CONFLICT ("id") DO NOTHING
				 RETURNING ${BROADCAST_COLUMNS}`,
				[input.id, input.tripId, input.hostId, input.alertType, input.content, recipients.length]
			);
			const broadcast = inserted[0];
			if (!broadcast) return null;
			if (recipients.length > 0) {
				await manager.query(
					`INSERT INTO "emergency_broadcast_recipients" ("broadcast_id", "user_id", "role")
					 SELECT $1, r."user_id", r."role"::"emergency_broadcast_recipient_role"
					 FROM unnest($2::uuid[], $3::text[]) AS r("user_id", "role")`,
					[broadcast.id, recipients.map((r) => r.userId), recipients.map((r) => r.role)]
				);
			}
			await manager.query(
				`INSERT INTO "audit_logs" ("actor_id", "action", "target_type", "target_id", "before", "after", "reason")
				 VALUES ($1, 'EMERGENCY_BROADCAST_CREATED', 'emergency_broadcast', $2, NULL, $3, NULL)`,
				[
					input.hostId,
					broadcast.id,
					JSON.stringify({
						tripId: broadcast.tripId,
						alertType: broadcast.alertType,
						recipientCount: broadcast.recipientCount,
					}),
				]
			);
			return { created: true as const, broadcast, recipients };
		});
		if (result) return result;
		const existing = await this.findById(input.id);
		if (!existing) throw new Error("Emergency broadcast conflict without a stored row");
		return { created: false, broadcast: existing };
	}

	/** Host view: every broadcast of the Trip, newest first. */
	async listForTrip(tripId: string): Promise<EmergencyBroadcast[]> {
		return this.db.query<EmergencyBroadcast[]>(
			`SELECT ${BROADCAST_COLUMNS} FROM "emergency_broadcasts" b
			 WHERE b."trip_id" = $1 ORDER BY b."created_at" DESC, b."id" DESC`,
			[tripId]
		);
	}

	/** Recipient view: only broadcasts that addressed this user (missed-while-offline recovery). */
	async listForRecipient(tripId: string, userId: string): Promise<EmergencyBroadcast[]> {
		return this.db.query<EmergencyBroadcast[]>(
			`SELECT ${BROADCAST_COLUMNS} FROM "emergency_broadcasts" b
			 JOIN "emergency_broadcast_recipients" r ON r."broadcast_id" = b."id" AND r."user_id" = $2
			 WHERE b."trip_id" = $1 ORDER BY b."created_at" DESC, b."id" DESC`,
			[tripId, userId]
		);
	}

	async isTripParticipant(tripId: string, userId: string): Promise<boolean> {
		const rows = await this.db.query<unknown[]>(
			`SELECT 1 FROM "booking_members" m JOIN "bookings" bk ON bk."id" = m."booking_id"
			 WHERE bk."trip_id" = $1 AND m."user_id" = $2
			 UNION ALL
			 SELECT 1 FROM "trip_porters" tp WHERE tp."trip_id" = $1 AND tp."porter_id" = $2
			 LIMIT 1`,
			[tripId, userId]
		);
		return rows.length > 0;
	}

	/** Eligible Campers (registered/joined, participating Booking, linked account) and assigned Porters. */
	private async resolveRecipients(
		manager: EntityManager,
		tripId: string
	): Promise<BroadcastRecipient[]> {
		return manager.query<BroadcastRecipient[]>(
			`SELECT DISTINCT ON (eligible."userId") eligible."userId", eligible."role" FROM (
			   SELECT tp."porter_id" AS "userId", $5::text AS "role", 0 AS "priority"
			   FROM "trip_porters" tp WHERE tp."trip_id" = $1 AND tp."status" = $4
			   UNION ALL
			   SELECT m."user_id", $6::text, 1
			   FROM "booking_members" m JOIN "bookings" bk ON bk."id" = m."booking_id"
			   WHERE bk."trip_id" = $1 AND m."user_id" IS NOT NULL
			     AND bk."status" = ANY($2::booking_status[])
			     AND m."member_status" = ANY($3::booking_member_status[])
			 ) eligible
			 JOIN "users" u ON u."id" = eligible."userId" AND u."status" = 'active'
			 ORDER BY eligible."userId", eligible."priority"`,
			[
				tripId,
				PARTICIPATING_BOOKING_STATUSES,
				RECIPIENT_MEMBER_STATUSES,
				TripPorterStatus.ASSIGNED,
				EmergencyBroadcastRecipientRole.PORTER,
				EmergencyBroadcastRecipientRole.CAMPER,
			]
		);
	}
}
