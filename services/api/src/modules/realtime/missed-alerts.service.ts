import { createHmac } from "node:crypto";
import { Injectable, UnprocessableEntityException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { ConfigService } from "@nestjs/config";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { JwtService } from "@nestjs/jwt";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { DataSource } from "typeorm";
import { broadcastRecoveryScope } from "./broadcast-recovery-scope";

const WINDOW = 24 * 60 * 60 * 1000;
const LIMIT = 200;
const SOURCES = ["broadcast", "notification", "sos"] as const;
type Source = (typeof SOURCES)[number];
interface Position {
	occurredAt: string;
	dedupKey: string;
}
interface PageCursor extends Position {
	sub: string;
	until: string;
	kind: "missed-alerts";
}
interface SourceRow {
	sourceId: string;
	occurredAt: Date;
	details: Record<string, unknown>;
	readAt?: Date | null;
}

const QUERIES: Record<Source, string> = {
	broadcast: `SELECT b.id AS "sourceId", b.created_at AS "occurredAt",
		jsonb_build_object('tripId',b.trip_id,'alertType',b.alert_type,'content',b.content) AS details
		FROM emergency_broadcasts b WHERE b.created_at BETWEEN $2 AND $3 AND
		${broadcastRecoveryScope("b", "$1")}`,
	notification: `SELECT n.id AS "sourceId", n.occurred_at AS "occurredAt", n.read_at AS "readAt",
		jsonb_build_object('eventType',n.event_type) AS details
		FROM in_app_notifications n WHERE n.recipient_id=$1 AND n.occurred_at BETWEEN $2 AND $3`,
	sos: `SELECT a.id AS "sourceId", a.created_at AS "occurredAt",
		jsonb_build_object('sosId',s.id,'transition',a.action) AS details
		FROM sos_alerts s JOIN audit_logs a ON a.target_id=s.id AND a.target_type='sos_alert'
		WHERE s.sender_id=$1 AND a.created_at BETWEEN $2 AND $3
		AND a.action IN ('SOS_CANCELLED','SOS_ACKNOWLEDGED','SOS_CLOSED')`,
};

@Injectable()
export class MissedAlertsService {
	private readonly cursorSecret: Buffer;

	constructor(
		private readonly db: DataSource,
		private readonly jwt: JwtService,
		config: ConfigService
	) {
		this.cursorSecret = createHmac("sha256", config.getOrThrow<string>("JWT_SECRET"))
			.update("ctms:missed-alerts:cursor:v1")
			.digest();
	}

	async list(userId: string, token?: string, now = new Date()) {
		const cursor = token === undefined ? undefined : this.decode(userId, token, now);
		const until = cursor?.until ?? now.toISOString();
		const since = new Date(Date.parse(until) - WINDOW).toISOString();
		const results = await Promise.allSettled(
			SOURCES.map(async (source) => {
				const rows = await this.db.query<SourceRow[]>(
					`SELECT * FROM (${QUERIES[source]}) result
					 WHERE ($4::timestamptz IS NULL
					   OR date_trunc('milliseconds', "occurredAt") < $4
					   OR (date_trunc('milliseconds', "occurredAt") = $4
					     AND ($5::text || ':' || "sourceId"::text) COLLATE "C" > $6::text))
					 ORDER BY date_trunc('milliseconds', "occurredAt") DESC, "sourceId" ASC LIMIT $7`,
					[
						userId,
						since,
						until,
						cursor?.occurredAt ?? null,
						source,
						cursor?.dedupKey ?? null,
						LIMIT + 1,
					]
				);
				return rows.map((row) => ({
					source,
					sourceId: row.sourceId,
					dedupKey: `${source}:${row.sourceId}`,
					occurredAt: row.occurredAt.toISOString(),
					details: row.details,
					...(source === "notification" ? { readAt: row.readAt?.toISOString() ?? null } : {}),
				}));
			})
		);
		const failedSources = SOURCES.filter((_, index) => results[index].status === "rejected");
		const merged = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
		merged.sort(
			(a, b) =>
				Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
				(a.dedupKey < b.dedupKey ? -1 : a.dedupKey === b.dedupKey ? 0 : 1)
		);
		const items = merged.slice(0, LIMIT);
		const last = items.at(-1);
		// Retry the same page after partial failure to avoid skipping items from the failed source.
		const nextCursor =
			failedSources.length === 0 && merged.length > LIMIT && last
				? this.jwt.sign(
						{
							kind: "missed-alerts",
							sub: userId,
							until,
							occurredAt: last.occurredAt,
							dedupKey: last.dedupKey,
						},
						{ secret: this.cursorSecret, algorithm: "HS256" }
					)
				: null;
		return { items, nextCursor, failedSources, recoveryMode: "backfill" as const };
	}

	private decode(userId: string, token: string, now: Date): PageCursor {
		try {
			if (token.length > 2048) throw new Error("Cursor too long");
			const value = this.jwt.verify<PageCursor>(token, {
				secret: this.cursorSecret,
				algorithms: ["HS256"],
			});
			const until = Date.parse(value.until);
			const position = Date.parse(value.occurredAt);
			if (
				value.kind !== "missed-alerts" ||
				value.sub !== userId ||
				!Number.isFinite(until) ||
				!Number.isFinite(position) ||
				until > now.getTime() ||
				now.getTime() - until >= WINDOW ||
				position > until ||
				position < until - WINDOW ||
				!/^(broadcast|notification|sos):[a-f0-9-]{36}$/.test(value.dedupKey)
			) {
				throw new Error("Invalid cursor");
			}
			return value;
		} catch {
			throw new UnprocessableEntityException("Mốc khôi phục không hợp lệ hoặc đã hết hạn.");
		}
	}
}
