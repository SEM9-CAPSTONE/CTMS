import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { DataSource } from "typeorm";
import type { MemberSyncHealthDto } from "./dto/device-sync-status-response.dto";

export interface ParticipantSyncStats {
	gpsCount: number;
	safetyCount: number;
	lastReceivedAt: Date | null;
	packageVersion: string | null;
}

@Injectable()
export class DeviceSyncRepository {
	constructor(private readonly dataSource: DataSource) {}

	async getParticipantSyncStats(tripId: string, userId: string): Promise<ParticipantSyncStats> {
		const [gpsResult, safetyResult] = await Promise.all([
			this.dataSource.query(
				`SELECT 
					COUNT(*)::int AS count,
					MAX("received_at") AS "lastReceivedAt",
					(SELECT "package_version" FROM "gps_logs" 
					 WHERE "trip_id" = $1 AND "user_id" = $2 AND "package_version" IS NOT NULL
					 ORDER BY "event_time" DESC LIMIT 1) AS "packageVersion"
				 FROM "gps_logs"
				 WHERE "trip_id" = $1 AND "user_id" = $2`,
				[tripId, userId]
			),
			this.dataSource.query(
				`SELECT 
					COUNT(*)::int AS count,
					MAX("received_at") AS "lastReceivedAt"
				 FROM (
					SELECT "received_at" FROM "trip_incidents"
					WHERE "trip_id" = $1 AND "reporter_id" = $2
					UNION ALL
					SELECT "received_at" FROM "safety_events"
					WHERE "trip_id" = $1 AND "user_id" = $2
				 ) safety`,
				[tripId, userId]
			),
		]);

		const gpsCount = Number(gpsResult[0]?.count ?? 0);
		const safetyCount = Number(safetyResult[0]?.count ?? 0);
		const gpsLast = gpsResult[0]?.lastReceivedAt ? new Date(gpsResult[0].lastReceivedAt) : null;
		const safetyLast = safetyResult[0]?.lastReceivedAt
			? new Date(safetyResult[0].lastReceivedAt)
			: null;

		let lastReceivedAt: Date | null = null;
		if (gpsLast && safetyLast) {
			lastReceivedAt = gpsLast > safetyLast ? gpsLast : safetyLast;
		} else {
			lastReceivedAt = gpsLast ?? safetyLast;
		}

		const packageVersion = (gpsResult[0]?.packageVersion as string | undefined) ?? null;

		return {
			gpsCount,
			safetyCount,
			lastReceivedAt,
			packageVersion,
		};
	}

	async getTripHostId(tripId: string): Promise<string | null> {
		const rows = (await this.dataSource.query(
			`SELECT "host_id" AS "hostId" FROM "trips" WHERE "id" = $1`,
			[tripId]
		)) as Array<{ hostId: string }>;
		return rows[0]?.hostId ?? null;
	}

	async getTripParticipantsSyncHealth(
		tripId: string,
		staleThresholdMinutes = 15
	): Promise<MemberSyncHealthDto[]> {
		const now = Date.now();
		const staleThresholdMs = staleThresholdMinutes * 60 * 1000;

		const rows = (await this.dataSource.query(
			`WITH trip_participants AS (
				-- Campers who joined
				SELECT 
					u."id" AS "userId",
					COALESCE(u."display_name", u."email") AS "displayName",
					'camper' AS "role"
				FROM "booking_members" bm
				INNER JOIN "bookings" b ON b."id" = bm."booking_id"
				INNER JOIN "users" u ON u."id" = bm."user_id"
				WHERE b."trip_id" = $1 
				  AND bm."member_status" IN ('joined', 'left')
				  AND b."status" IN ('confirmed', 'completed')

				UNION

				-- Porters assigned
				SELECT 
					u."id" AS "userId",
					COALESCE(u."display_name", u."email") AS "displayName",
					'porter' AS "role"
				FROM "trip_porters" tp
				INNER JOIN "users" u ON u."id" = tp."porter_id"
				WHERE tp."trip_id" = $1 AND tp."status" = 'assigned'
			),
			user_gps AS (
				SELECT "user_id", COUNT(*)::int AS count, MAX("received_at") AS "last_recv"
				FROM "gps_logs"
				WHERE "trip_id" = $1
				GROUP BY "user_id"
			),
			user_safety AS (
				SELECT "reporter_id", COUNT(*)::int AS count, MAX("received_at") AS "last_recv"
				FROM (
					SELECT "reporter_id", "received_at" FROM "trip_incidents" WHERE "trip_id" = $1
					UNION ALL
					SELECT "user_id", "received_at" FROM "safety_events" WHERE "trip_id" = $1
				) safety
				GROUP BY "reporter_id"
			)
			SELECT 
				p."userId",
				p."displayName",
				p."role",
				COALESCE(g.count, 0) AS "gpsCount",
				COALESCE(i.count, 0) AS "safetyCount",
				GREATEST(g."last_recv", i."last_recv") AS "lastReceivedAt"
			FROM trip_participants p
			LEFT JOIN user_gps g ON g."user_id" = p."userId"
			LEFT JOIN user_safety i ON i."reporter_id" = p."userId"
			ORDER BY p."role" DESC, p."displayName" ASC`,
			[tripId]
		)) as Array<{
			userId: string;
			displayName: string;
			role: string;
			gpsCount: number;
			safetyCount: number;
			lastReceivedAt: string | null;
		}>;

		return rows.map((row) => {
			let status: "connected" | "syncing" | "stale" = "stale";
			if (row.lastReceivedAt) {
				const lastTime = new Date(row.lastReceivedAt).getTime();
				if (now - lastTime <= staleThresholdMs) {
					status = "connected";
				} else {
					status = "stale";
				}
			}

			return {
				userId: row.userId,
				displayName: row.displayName,
				role: row.role,
				gpsCount: Number(row.gpsCount),
				safetyCount: Number(row.safetyCount),
				lastReceivedAt: row.lastReceivedAt ? new Date(row.lastReceivedAt).toISOString() : null,
				status,
			};
		});
	}
}
