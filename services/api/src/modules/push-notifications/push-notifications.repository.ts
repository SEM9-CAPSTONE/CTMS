import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { DataSource } from "typeorm";
import {
	type PushDevice,
	type PushIntent,
	type PushNotificationRow,
	type PushPlatform,
	type PushSkipReason,
	PushStatus,
} from "./push-notifications.types";

/** A pass that crashed while sending leaves rows in `sending`; they are retried after this. */
export const STALE_SENDING_MS = 10 * 60 * 1000;

/**
 * TypeORM returns `[rows, affectedCount]` for UPDATE/DELETE … RETURNING but plain rows for SELECT
 * and INSERT; normalise both.
 */
function returnedRows<T>(result: unknown): T[] {
	if (Array.isArray(result) && result.length === 2 && Array.isArray(result[0])) {
		return result[0] as T[];
	}
	return (result as T[]) ?? [];
}

const ROW_COLUMNS = `"id", "event_key" AS "eventKey", "recipient_id" AS "recipientId", "category",
 "mandatory", "trip_id" AS "tripId", "trip_scoped" AS "tripScoped", "title", "body", "data",
 "status", "attempts"`;

@Injectable()
export class PushNotificationsRepository {
	constructor(private readonly db: DataSource) {}

	/**
	 * Registers the token for the user. A token that was registered by another account on the same
	 * phone moves to the current user, so a signed-out account stops receiving its pushes.
	 */
	async upsertDevice(userId: string, token: string, platform: PushPlatform): Promise<PushDevice> {
		const result = await this.db.query(
			`INSERT INTO "push_devices" ("user_id", "token", "platform")
			 VALUES ($1, $2, $3)
			 ON CONFLICT ("token") DO UPDATE
			 SET "user_id" = EXCLUDED."user_id", "platform" = EXCLUDED."platform",
			     "last_seen_at" = now(), "disabled_at" = NULL
			 RETURNING "id", "user_id" AS "userId", "token", "platform"`,
			[userId, token, platform]
		);
		return returnedRows<PushDevice>(result)[0];
	}

	/** Removes the token of this user (sign-out); returns false when it is not theirs. */
	async deleteDevice(userId: string, token: string): Promise<boolean> {
		const rows = returnedRows<{ id: string }>(
			await this.db.query(
				`DELETE FROM "push_devices" WHERE "user_id" = $1 AND "token" = $2 RETURNING "id"`,
				[userId, token]
			)
		);
		return rows.length > 0;
	}

	async activeDevices(userId: string): Promise<PushDevice[]> {
		return this.db.query<PushDevice[]>(
			`SELECT "id", "user_id" AS "userId", "token", "platform" FROM "push_devices"
			 WHERE "user_id" = $1 AND "disabled_at" IS NULL ORDER BY "last_seen_at" DESC`,
			[userId]
		);
	}

	async disableDevice(deviceId: string): Promise<void> {
		await this.db.query(
			`UPDATE "push_devices" SET "disabled_at" = now() WHERE "id" = $1 AND "disabled_at" IS NULL`,
			[deviceId]
		);
	}

	/**
	 * BR-195 / BR-273: one row per (event, recipient). Re-processing the same event inserts nothing;
	 * returns how many new pushes were queued.
	 */
	async enqueue(intents: PushIntent[]): Promise<number> {
		if (intents.length === 0) return 0;
		const result = await this.db.query(
			`INSERT INTO "push_notifications" (
				"event_key", "recipient_id", "category", "mandatory", "trip_id", "trip_scoped",
				"title", "body", "data"
			)
			SELECT i."event_key", i."recipient_id", i."category", i."mandatory", i."trip_id",
			       i."trip_scoped", i."title", i."body", i."data"
			FROM jsonb_to_recordset($1::jsonb) AS i(
				"event_key" varchar, "recipient_id" uuid, "category" varchar, "mandatory" boolean,
				"trip_id" uuid, "trip_scoped" boolean, "title" varchar, "body" varchar, "data" jsonb
			)
			JOIN "users" u ON u."id" = i."recipient_id"
			ON CONFLICT ("event_key", "recipient_id") DO NOTHING
			RETURNING "id"`,
			[
				JSON.stringify(
					intents.map((item) => ({
						event_key: item.eventKey,
						recipient_id: item.recipientId,
						category: item.category,
						mandatory: item.mandatory,
						trip_id: item.tripId,
						trip_scoped: item.tripScoped,
						title: item.title,
						body: item.body,
						data: item.data,
					}))
				),
			]
		);
		return returnedRows<{ id: string }>(result).length;
	}

	/**
	 * Claims due pushes for one delivery pass (concurrent passes skip each other's rows). New rows
	 * are stamped by the database clock, so "due" uses the later of the app and database clocks.
	 */
	async claimDue(now: Date, limit: number): Promise<PushNotificationRow[]> {
		const result = await this.db.query(
			`UPDATE "push_notifications" SET "status" = 'sending', "attempts" = "attempts" + 1, "updated_at" = $1
			 WHERE "id" IN (
				SELECT "id" FROM "push_notifications"
				WHERE ("status" = 'pending' AND "next_attempt_at" <= GREATEST($1::timestamptz, now()))
				   OR ("status" = 'sending' AND "updated_at" < $2)
				ORDER BY "mandatory" DESC, "created_at" ASC
				LIMIT $3
				FOR UPDATE SKIP LOCKED
			 )
			 RETURNING ${ROW_COLUMNS}`,
			[now, new Date(now.getTime() - STALE_SENDING_MS), limit]
		);
		return returnedRows<PushNotificationRow>(result);
	}

	async markSent(id: string, now: Date): Promise<void> {
		await this.db.query(
			`UPDATE "push_notifications" SET "status" = 'sent', "sent_at" = $2, "last_error" = NULL, "updated_at" = $2
			 WHERE "id" = $1`,
			[id, now]
		);
	}

	async markSkipped(id: string, reason: PushSkipReason, now: Date): Promise<void> {
		await this.db.query(
			`UPDATE "push_notifications" SET "status" = 'skipped', "skip_reason" = $2, "updated_at" = $3
			 WHERE "id" = $1`,
			[id, reason, now]
		);
	}

	/** Back to `pending` for a later attempt, or `failed` when no attempt is left. */
	async markAttemptFailed(
		id: string,
		error: string,
		retryAt: Date | null,
		now: Date
	): Promise<void> {
		await this.db.query(
			`UPDATE "push_notifications"
			 SET "status" = $2, "last_error" = $3, "next_attempt_at" = COALESCE($4, "next_attempt_at"), "updated_at" = $5
			 WHERE "id" = $1`,
			[id, retryAt ? PushStatus.PENDING : PushStatus.FAILED, error.slice(0, 500), retryAt, now]
		);
	}
}
