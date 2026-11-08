import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource } from "typeorm";
import type { RiskLevel } from "../entities/weather-risk-assessment.entity";

export interface TripWeatherChangeNoticeRow {
	id: string;
	recipientId: string;
	tripId: string;
	forecastId: string;
	tripTitle: string;
	tripStartsAt: Date;
	previousRiskLevel: RiskLevel;
	riskLevel: RiskLevel;
	readAt: Date | null;
	createdAt: Date;
}

const NOTICE_COLUMNS = `"id", "recipient_id" AS "recipientId", "trip_id" AS "tripId",
	"forecast_id" AS "forecastId", "trip_title" AS "tripTitle", "trip_starts_at" AS "tripStartsAt",
	"previous_risk_level" AS "previousRiskLevel", "risk_level" AS "riskLevel",
	"read_at" AS "readAt", "created_at" AS "createdAt"`;

/** CTMS-93 monitoring: per-recipient notices when a Trip's forecast risk level changes. */
@Injectable()
export class TripWeatherChangeNoticesRepository {
	constructor(private readonly dataSource: DataSource) {}

	async findTripTitle(tripId: string): Promise<string | null> {
		const rows = (await this.dataSource.query(`SELECT "title" FROM "trips" WHERE "id" = $1`, [
			tripId,
		])) as Array<{ title: string }>;
		return rows[0]?.title ?? null;
	}

	/**
	 * Who hears about a level change: the Trip's Host and every Camper on a booking that is
	 * confirmed or awaiting payment (the booker and members with a linked, active account who have
	 * not been removed). Admins are deliberately not included (policy §4).
	 */
	async findRecipientIds(tripId: string): Promise<string[]> {
		const rows = (await this.dataSource.query(
			`SELECT trip."host_id" AS "userId" FROM "trips" trip WHERE trip."id" = $1
			 UNION
			 SELECT booking."user_id" FROM "bookings" booking
			 WHERE booking."trip_id" = $1 AND booking."status" IN ('confirmed', 'pending_payment')
			 UNION
			 SELECT member."user_id" FROM "booking_members" member
			 JOIN "bookings" booking ON booking."id" = member."booking_id"
			 JOIN "users" account ON account."id" = member."user_id" AND account."status" = 'active'
			 WHERE booking."trip_id" = $1 AND booking."status" IN ('confirmed', 'pending_payment')
			   AND member."user_id" IS NOT NULL
			   AND member."member_status" IN ('registered', 'joined')`,
			[tripId]
		)) as Array<{ userId: string | null }>;
		return [...new Set(rows.map((row) => row.userId).filter((id): id is string => Boolean(id)))];
	}

	/**
	 * Inserts one notice per recipient for this forecast change. A recipient that already has a
	 * notice for the same forecast row is skipped, so a retried or concurrent run never notifies twice.
	 * Returns only the notices actually created.
	 */
	async insertMany(input: {
		recipientIds: string[];
		tripId: string;
		forecastId: string;
		tripTitle: string;
		tripStartsAt: Date;
		previousRiskLevel: RiskLevel;
		riskLevel: RiskLevel;
	}): Promise<TripWeatherChangeNoticeRow[]> {
		if (input.recipientIds.length === 0) return [];
		return (await this.dataSource.query(
			`INSERT INTO "trip_weather_change_notices"
			   ("recipient_id", "trip_id", "forecast_id", "trip_title", "trip_starts_at",
			    "previous_risk_level", "risk_level")
			 SELECT recipient, $2, $3, $4, $5, $6, $7 FROM unnest($1::uuid[]) AS recipient
			 ON CONFLICT ("forecast_id", "recipient_id") DO NOTHING
			 RETURNING ${NOTICE_COLUMNS}`,
			[
				input.recipientIds,
				input.tripId,
				input.forecastId,
				input.tripTitle,
				input.tripStartsAt,
				input.previousRiskLevel,
				input.riskLevel,
			]
		)) as TripWeatherChangeNoticeRow[];
	}

	async listForRecipient(
		recipientId: string,
		limit: number
	): Promise<{ items: TripWeatherChangeNoticeRow[]; unreadCount: number }> {
		const items = (await this.dataSource.query(
			`SELECT ${NOTICE_COLUMNS} FROM "trip_weather_change_notices"
			 WHERE "recipient_id" = $1 ORDER BY "created_at" DESC, "id" DESC LIMIT $2`,
			[recipientId, limit]
		)) as TripWeatherChangeNoticeRow[];
		const [{ count }] = (await this.dataSource.query(
			`SELECT count(*)::int AS "count" FROM "trip_weather_change_notices"
			 WHERE "recipient_id" = $1 AND "read_at" IS NULL`,
			[recipientId]
		)) as Array<{ count: number }>;
		return { items, unreadCount: count };
	}

	/** Marks the recipient's own notice read; returns null when it is not theirs or absent. */
	async markRead(recipientId: string, id: string): Promise<TripWeatherChangeNoticeRow | null> {
		const rows = (await this.dataSource.query(
			`UPDATE "trip_weather_change_notices" SET "read_at" = COALESCE("read_at", now())
			 WHERE "id" = $1 AND "recipient_id" = $2
			 RETURNING ${NOTICE_COLUMNS}`,
			[id, recipientId]
		)) as [TripWeatherChangeNoticeRow[], number] | TripWeatherChangeNoticeRow[];
		const list = Array.isArray(rows[0])
			? (rows[0] as TripWeatherChangeNoticeRow[])
			: (rows as TripWeatherChangeNoticeRow[]);
		return list[0] ?? null;
	}
}
