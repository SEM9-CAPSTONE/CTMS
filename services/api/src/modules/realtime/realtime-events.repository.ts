import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { DataSource } from "typeorm";

/** Who may receive a protected event; frozen when it is published (CTMS-082). */
export interface RealtimeAudience {
	userIds: string[];
	roles: string[];
	tripId: string | null;
}

export interface NewRealtimeEvent extends RealtimeAudience {
	id: string;
	name: string;
	payload: unknown;
	/** Same instant as `meta.emittedAt` of the live copy. */
	createdAt: Date;
}

export interface StoredRealtimeEvent {
	id: string;
	sequence: number;
	name: string;
	payload: unknown;
	createdAt: Date;
}

interface RawStoredEvent {
	id: string;
	sequence: string;
	name: string;
	payload: unknown;
	createdAt: Date;
}

export interface RecoveryFilter {
	afterSequence: number;
	since: Date;
	userId: string;
	roles: string[];
	/** Trips the caller is a member of right now. */
	tripIds: string[];
	limit: number;
}

function toStored(row: RawStoredEvent): StoredRealtimeEvent {
	return { ...row, sequence: Number(row.sequence) };
}

@Injectable()
export class RealtimeEventsRepository {
	constructor(private readonly db: DataSource) {}

	/**
	 * Stores the event and returns its cursor. A retried publish with the same id keeps the first
	 * row and returns its sequence, so one event never gets two cursors.
	 */
	async append(event: NewRealtimeEvent): Promise<number> {
		const rows = await this.db.query<Array<{ sequence: string }>>(
			`WITH inserted AS (
				INSERT INTO "realtime_events" ("id", "event_name", "payload", "user_ids", "roles", "trip_id", "created_at")
				VALUES ($1, $2, $3::jsonb, $4::uuid[], $5::varchar[], $6, $7)
				ON CONFLICT ("id") DO NOTHING
				RETURNING "sequence"
			)
			SELECT "sequence" FROM inserted
			UNION ALL
			SELECT "sequence" FROM "realtime_events" WHERE "id" = $1
			LIMIT 1`,
			[
				event.id,
				event.name,
				JSON.stringify(event.payload ?? null),
				event.userIds,
				event.roles,
				event.tripId,
				event.createdAt,
			]
		);
		return Number(rows[0].sequence);
	}

	async latestSequence(): Promise<number> {
		const rows = await this.db.query<Array<{ latest: string }>>(
			`SELECT COALESCE(MAX("sequence"), 0) AS "latest" FROM "realtime_events"`
		);
		return Number(rows[0].latest);
	}

	/** Smallest cursor still stored (expired or not), or null when the table is empty. */
	async oldestSequence(): Promise<number | null> {
		const rows = await this.db.query<Array<{ oldest: string | null }>>(
			`SELECT MIN("sequence") AS "oldest" FROM "realtime_events"`
		);
		return rows[0].oldest === null ? null : Number(rows[0].oldest);
	}

	/** True when an event after the cursor is already past the retention window. */
	async hasExpiredAfter(afterSequence: number, since: Date): Promise<boolean> {
		const rows = await this.db.query<Array<{ expired: boolean }>>(
			`SELECT EXISTS (
				SELECT 1 FROM "realtime_events" WHERE "sequence" > $1 AND "created_at" < $2
			) AS "expired"`,
			[afterSequence, since]
		);
		return rows[0].expired === true;
	}

	/** Trips that have events after the cursor; the caller's membership is checked for each. */
	async tripIdsAfter(afterSequence: number, since: Date): Promise<string[]> {
		const rows = await this.db.query<Array<{ tripId: string }>>(
			`SELECT DISTINCT "trip_id" AS "tripId" FROM "realtime_events"
			 WHERE "sequence" > $1 AND "created_at" >= $2 AND "trip_id" IS NOT NULL`,
			[afterSequence, since]
		);
		return rows.map((row) => row.tripId);
	}

	/** Events after the cursor addressed to the user, one of their current roles or a current Trip. */
	async findForRecipient(filter: RecoveryFilter): Promise<StoredRealtimeEvent[]> {
		const rows = await this.db.query<RawStoredEvent[]>(
			`SELECT "id", "sequence", "event_name" AS "name", "payload", "created_at" AS "createdAt"
			 FROM "realtime_events"
			 WHERE "sequence" > $1 AND "created_at" >= $2
			   AND ($3::uuid = ANY("user_ids") OR "roles" && $4::varchar[] OR "trip_id" = ANY($5::uuid[]))
			 ORDER BY "sequence" ASC
			 LIMIT $6`,
			[
				filter.afterSequence,
				filter.since,
				filter.userId,
				filter.roles,
				filter.tripIds,
				filter.limit,
			]
		);
		return rows.map(toStored);
	}

	async deleteOlderThan(before: Date): Promise<number> {
		const result = await this.db.query<[unknown[], number]>(
			`DELETE FROM "realtime_events" WHERE "created_at" < $1`,
			[before]
		);
		return Array.isArray(result) && typeof result[1] === "number" ? result[1] : 0;
	}
}
