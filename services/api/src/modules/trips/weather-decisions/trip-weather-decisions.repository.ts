import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource, type EntityManager } from "typeorm";
import type {
	WeatherAlertMilestone,
	WeatherAlertUrgency,
	WeatherDeciderRole,
	WeatherDecision,
} from "./trip-weather-decision.policy";

export type WeatherRiskLevelValue = "green" | "yellow" | "red";

export interface WeatherDecisionTrip {
	id: string;
	hostId: string;
	title: string;
	status: string;
	startsAt: Date;
	weatherPausedAt: Date | null;
	weatherPauseReason: string | null;
}

export interface LatestTripForecast {
	id: string;
	status: string;
	riskLevel: WeatherRiskLevelValue | null;
}

export interface TripWeatherDecisionRow {
	id: string;
	tripId: string;
	forecastId: string | null;
	riskLevel: WeatherRiskLevelValue | null;
	decidedBy: string | null;
	deciderName: string | null;
	deciderRole: WeatherDeciderRole;
	decision: WeatherDecision;
	reason: string;
	safetyPlan: string | null;
	late: boolean;
	tripStartsAt: Date;
	createdAt: Date;
}

export interface TripWeatherDecisionAlertRow {
	id: string;
	recipientId: string;
	tripId: string;
	milestone: WeatherAlertMilestone;
	urgency: WeatherAlertUrgency;
	tripTitle: string;
	tripStartsAt: Date;
	forecastId: string | null;
	readAt: Date | null;
	createdAt: Date;
}

/** A published Trip inside the reminder window whose newest forecast is Red. */
export interface RedTripCandidate {
	tripId: string;
	hostId: string;
	title: string;
	startsAt: Date;
	forecastId: string;
	weatherPausedAt: Date | null;
	hostDecision: WeatherDecision | null;
	hostDecisionReason: string | null;
	hostSafetyPlan: string | null;
	hostDecidedAt: Date | null;
	adminDecided: boolean;
}

const DECISION_COLUMNS = `decision."id", decision."trip_id" AS "tripId", decision."forecast_id" AS "forecastId",
	decision."risk_level" AS "riskLevel", decision."decided_by" AS "decidedBy",
	decider."full_name" AS "deciderName", decision."decider_role" AS "deciderRole",
	decision."decision", decision."reason", decision."safety_plan" AS "safetyPlan", decision."late",
	decision."trip_starts_at" AS "tripStartsAt", decision."created_at" AS "createdAt"`;

const ALERT_COLUMNS = `"id", "recipient_id" AS "recipientId", "trip_id" AS "tripId", "milestone", "urgency",
	"trip_title" AS "tripTitle", "trip_starts_at" AS "tripStartsAt", "forecast_id" AS "forecastId",
	"read_at" AS "readAt", "created_at" AS "createdAt"`;

/** UPDATE ... RETURNING comes back as [rows, count] from the pg driver; SELECT/INSERT as rows. */
function returnedRows<T>(result: unknown): T[] {
	const rows = result as unknown[];
	return (Array.isArray(rows[0]) ? rows[0] : rows) as T[];
}

/** Weather decision near departure (policy §5): decisions, Admin pause and reminders. */
@Injectable()
export class TripWeatherDecisionsRepository {
	constructor(private readonly dataSource: DataSource) {}

	private run(manager?: EntityManager) {
		return manager ?? this.dataSource.manager;
	}

	async findTrip(
		tripId: string,
		options: { manager?: EntityManager; lock?: boolean } = {}
	): Promise<WeatherDecisionTrip | null> {
		const rows = (await this.run(options.manager).query(
			`SELECT "id", "host_id" AS "hostId", "title", "status", "starts_at" AS "startsAt",
			        "weather_paused_at" AS "weatherPausedAt", "weather_pause_reason" AS "weatherPauseReason"
			 FROM "trips" WHERE "id" = $1${options.lock ? " FOR UPDATE" : ""}`,
			[tripId]
		)) as WeatherDecisionTrip[];
		return rows[0] ?? null;
	}

	/** Newest stored forecast of the Trip (policy §1: the latest one is the one that counts). */
	async findLatestForecast(
		tripId: string,
		manager?: EntityManager
	): Promise<LatestTripForecast | null> {
		const rows = (await this.run(manager).query(
			`SELECT "id", "status", "risk_level" AS "riskLevel" FROM "trip_weather_forecasts"
			 WHERE "trip_id" = $1 ORDER BY "created_at" DESC, "id" DESC LIMIT 1`,
			[tripId]
		)) as LatestTripForecast[];
		return rows[0] ?? null;
	}

	/** Decisions taken for the Trip's current schedule, newest first. */
	async findDecisionsForSchedule(
		tripId: string,
		startsAt: Date,
		manager?: EntityManager
	): Promise<TripWeatherDecisionRow[]> {
		return (await this.run(manager).query(
			`SELECT ${DECISION_COLUMNS} FROM "trip_weather_decisions" decision
			 LEFT JOIN "users" decider ON decider."id" = decision."decided_by"
			 WHERE decision."trip_id" = $1 AND decision."trip_starts_at" = $2
			 ORDER BY decision."created_at" DESC, decision."id" DESC`,
			[tripId, startsAt]
		)) as TripWeatherDecisionRow[];
	}

	async findDecisions(tripId: string, limit: number): Promise<TripWeatherDecisionRow[]> {
		return (await this.dataSource.query(
			`SELECT ${DECISION_COLUMNS} FROM "trip_weather_decisions" decision
			 LEFT JOIN "users" decider ON decider."id" = decision."decided_by"
			 WHERE decision."trip_id" = $1
			 ORDER BY decision."created_at" DESC, decision."id" DESC LIMIT $2`,
			[tripId, limit]
		)) as TripWeatherDecisionRow[];
	}

	async insertDecision(
		manager: EntityManager,
		input: {
			tripId: string;
			forecastId: string | null;
			riskLevel: WeatherRiskLevelValue | null;
			/** NULL for a decision taken by the system itself (T-6h auto-cancel). */
			decidedBy: string | null;
			deciderRole: WeatherDeciderRole;
			decision: WeatherDecision;
			reason: string;
			safetyPlan: string | null;
			late: boolean;
			tripStartsAt: Date;
			createdAt: Date;
		}
	): Promise<TripWeatherDecisionRow> {
		const [row] = (await manager.query(
			`INSERT INTO "trip_weather_decisions"
			   ("trip_id", "forecast_id", "risk_level", "decided_by", "decider_role", "decision",
			    "reason", "safety_plan", "late", "trip_starts_at", "created_at")
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			 RETURNING "id", "trip_id" AS "tripId", "forecast_id" AS "forecastId", "risk_level" AS "riskLevel",
			   "decided_by" AS "decidedBy", NULL AS "deciderName", "decider_role" AS "deciderRole", "decision",
			   "reason", "safety_plan" AS "safetyPlan", "late", "trip_starts_at" AS "tripStartsAt",
			   "created_at" AS "createdAt"`,
			[
				input.tripId,
				input.forecastId,
				input.riskLevel,
				input.decidedBy,
				input.deciderRole,
				input.decision,
				input.reason,
				input.safetyPlan,
				input.late,
				input.tripStartsAt,
				input.createdAt,
			]
		)) as TripWeatherDecisionRow[];
		return row;
	}

	async setPause(
		manager: EntityManager,
		tripId: string,
		pausedAt: Date | null,
		reason: string | null
	): Promise<void> {
		await manager.query(
			`UPDATE "trips" SET "weather_paused_at" = $2, "weather_pause_reason" = $3, "updated_at" = now()
			 WHERE "id" = $1`,
			[tripId, pausedAt, reason]
		);
	}

	async findActiveAdminIds(): Promise<string[]> {
		const rows = (await this.dataSource.query(
			`SELECT account."id" FROM "users" account
			 WHERE account."status" = 'active'
			   AND (account."role" = 'admin'
			        OR EXISTS (SELECT 1 FROM "user_roles" granted
			                   WHERE granted."user_id" = account."id" AND granted."role" = 'admin'))`
		)) as Array<{ id: string }>;
		return rows.map((row) => row.id);
	}

	/**
	 * Published Trips starting within `windowMs` whose newest forecast is Red, with the latest Host
	 * decision and whether an Admin acted for the current schedule. Paused Trips stay included so
	 * the Admin list keeps showing them until resumed, rescheduled or cancelled.
	 */
	async findRedTripsStartingWithin(
		now: Date,
		windowMs: number,
		limit: number
	): Promise<RedTripCandidate[]> {
		return (await this.dataSource.query(
			`SELECT trip."id" AS "tripId", trip."host_id" AS "hostId", trip."title", trip."starts_at" AS "startsAt",
			        latest."id" AS "forecastId", trip."weather_paused_at" AS "weatherPausedAt",
			        host_decision."decision" AS "hostDecision", host_decision."reason" AS "hostDecisionReason",
			        host_decision."safety_plan" AS "hostSafetyPlan", host_decision."created_at" AS "hostDecidedAt",
			        EXISTS (
			          SELECT 1 FROM "trip_weather_decisions" admin_decision
			          WHERE admin_decision."trip_id" = trip."id" AND admin_decision."decider_role" = 'admin'
			            AND admin_decision."trip_starts_at" = trip."starts_at"
			        ) AS "adminDecided"
			 FROM "trips" trip
			 JOIN LATERAL (
			   SELECT f."id", f."risk_level" FROM "trip_weather_forecasts" f
			   WHERE f."trip_id" = trip."id" ORDER BY f."created_at" DESC, f."id" DESC LIMIT 1
			 ) latest ON true
			 LEFT JOIN LATERAL (
			   SELECT d."decision", d."reason", d."safety_plan", d."created_at" FROM "trip_weather_decisions" d
			   WHERE d."trip_id" = trip."id" AND d."decider_role" = 'host' AND d."trip_starts_at" = trip."starts_at"
			   ORDER BY d."created_at" DESC, d."id" DESC LIMIT 1
			 ) host_decision ON true
			 WHERE trip."status" = 'published'
			   AND trip."starts_at" > $1::timestamptz
			   AND trip."starts_at" <= $1::timestamptz + ($2::bigint * interval '1 millisecond')
			   AND latest."risk_level" = 'red'
			 ORDER BY trip."starts_at" ASC, trip."id" ASC
			 LIMIT $3::int`,
			[now, windowMs, limit]
		)) as RedTripCandidate[];
	}

	/**
	 * Published Trips starting within `windowMs` whose newest forecast is Red and that nobody kept,
	 * rescheduled, cancelled or resumed for the current schedule (a pause alone does not count).
	 * The service re-checks each one under a lock before cancelling.
	 */
	async findAutoCancelCandidateIds(now: Date, windowMs: number, limit: number): Promise<string[]> {
		const rows = (await this.dataSource.query(
			`SELECT trip."id" FROM "trips" trip
			 JOIN LATERAL (
			   SELECT f."risk_level" FROM "trip_weather_forecasts" f
			   WHERE f."trip_id" = trip."id" ORDER BY f."created_at" DESC, f."id" DESC LIMIT 1
			 ) latest ON true
			 WHERE trip."status" = 'published'
			   AND trip."starts_at" > $1::timestamptz
			   AND trip."starts_at" <= $1::timestamptz + ($2::bigint * interval '1 millisecond')
			   AND latest."risk_level" = 'red'
			   AND NOT EXISTS (
			     SELECT 1 FROM "trip_weather_decisions" d
			     WHERE d."trip_id" = trip."id" AND d."trip_starts_at" = trip."starts_at"
			       AND d."decision" IN ('keep', 'reschedule', 'cancel', 'resume')
			   )
			 ORDER BY trip."starts_at" ASC, trip."id" ASC
			 LIMIT $3::int`,
			[now, windowMs, limit]
		)) as Array<{ id: string }>;
		return rows.map((row) => row.id);
	}

	/** Stores reminders; one per (Trip, schedule, recipient, milestone). Returns only new ones. */
	async insertAlerts(
		input: Array<{
			recipientId: string;
			tripId: string;
			milestone: WeatherAlertMilestone;
			urgency: WeatherAlertUrgency;
			tripTitle: string;
			tripStartsAt: Date;
			forecastId: string | null;
		}>
	): Promise<TripWeatherDecisionAlertRow[]> {
		if (input.length === 0) return [];
		return (await this.dataSource.query(
			`INSERT INTO "trip_weather_decision_alerts"
			   ("recipient_id", "trip_id", "milestone", "urgency", "trip_title", "trip_starts_at", "forecast_id")
			 SELECT * FROM unnest($1::uuid[], $2::uuid[], $3::varchar[], $4::varchar[], $5::varchar[],
			                      $6::timestamptz[], $7::uuid[])
			 ON CONFLICT ("trip_id", "trip_starts_at", "recipient_id", "milestone") DO NOTHING
			 RETURNING ${ALERT_COLUMNS}`,
			[
				input.map((row) => row.recipientId),
				input.map((row) => row.tripId),
				input.map((row) => row.milestone),
				input.map((row) => row.urgency),
				input.map((row) => row.tripTitle),
				input.map((row) => row.tripStartsAt),
				input.map((row) => row.forecastId),
			]
		)) as TripWeatherDecisionAlertRow[];
	}

	async listAlerts(
		recipientId: string,
		limit: number
	): Promise<{ items: TripWeatherDecisionAlertRow[]; unreadCount: number }> {
		const items = (await this.dataSource.query(
			`SELECT ${ALERT_COLUMNS} FROM "trip_weather_decision_alerts"
			 WHERE "recipient_id" = $1 ORDER BY "created_at" DESC, "id" DESC LIMIT $2`,
			[recipientId, limit]
		)) as TripWeatherDecisionAlertRow[];
		const [{ count }] = (await this.dataSource.query(
			`SELECT count(*)::int AS "count" FROM "trip_weather_decision_alerts"
			 WHERE "recipient_id" = $1 AND "read_at" IS NULL`,
			[recipientId]
		)) as Array<{ count: number }>;
		return { items, unreadCount: count };
	}

	async markAlertRead(
		recipientId: string,
		id: string
	): Promise<TripWeatherDecisionAlertRow | null> {
		const rows = returnedRows<TripWeatherDecisionAlertRow>(
			await this.dataSource.query(
				`UPDATE "trip_weather_decision_alerts" SET "read_at" = COALESCE("read_at", now())
				 WHERE "id" = $1 AND "recipient_id" = $2 RETURNING ${ALERT_COLUMNS}`,
				[id, recipientId]
			)
		);
		return rows[0] ?? null;
	}

	/** Booking awaiting reconfirmation after a reschedule, locked with its Trip. */
	async findBookingForRescheduleResponse(
		manager: EntityManager,
		bookingId: string
	): Promise<{
		id: string;
		userId: string;
		tripId: string;
		status: string;
		totalAmount: string | null;
		tripStatus: string;
		tripStartsAt: Date;
	} | null> {
		const rows = (await manager.query(
			`SELECT booking."id", booking."user_id" AS "userId", booking."trip_id" AS "tripId", booking."status",
			        booking."total_amount"::text AS "totalAmount", trip."status" AS "tripStatus",
			        trip."starts_at" AS "tripStartsAt"
			 FROM "bookings" booking JOIN "trips" trip ON trip."id" = booking."trip_id"
			 WHERE booking."id" = $1
			 FOR UPDATE OF booking, trip`,
			[bookingId]
		)) as Array<{
			id: string;
			userId: string;
			tripId: string;
			status: string;
			totalAmount: string | null;
			tripStatus: string;
			tripStartsAt: Date;
		}>;
		return rows[0] ?? null;
	}

	/** True when the Trip's most recent reschedule came from a weather decision. */
	async lastRescheduleWasForWeather(manager: EntityManager, tripId: string): Promise<boolean> {
		const rows = (await manager.query(
			`SELECT "reason" FROM "audit_logs"
			 WHERE "target_type" = 'trip' AND "target_id" = $1 AND "action" = 'trip.rescheduled'
			 ORDER BY "created_at" DESC LIMIT 1`,
			[tripId]
		)) as Array<{ reason: string | null }>;
		return rows[0]?.reason === WEATHER_RESCHEDULE_AUDIT_REASON;
	}

	async reconfirmBooking(manager: EntityManager, bookingId: string, at: Date): Promise<void> {
		await manager.query(
			`UPDATE "bookings" SET "status" = 'confirmed', "reconfirmed_at" = $2 WHERE "id" = $1`,
			[bookingId, at]
		);
	}

	/** Cancels the booking and its active equipment rentals; seats and refund are handled by the caller. */
	async cancelBookingAfterDecline(
		manager: EntityManager,
		bookingId: string,
		at: Date,
		reason: string
	): Promise<number> {
		await manager.query(
			`UPDATE "bookings"
			 SET "status" = 'cancelled', "cancelled_at" = $2, "cancellation_reason" = $3, "declined_at" = $2
			 WHERE "id" = $1`,
			[bookingId, at, reason]
		);
		const rows = returnedRows<{ id: string }>(
			await manager.query(
				`UPDATE "equipment_reservations"
				 SET "status" = 'cancelled', "cancelled_at" = $2, "cancellation_reason" = $3
				 WHERE "status" = 'active'
				   AND "booking_item_id" IN (SELECT item."id" FROM "booking_items" item WHERE item."booking_id" = $1)
				 RETURNING "id"`,
				[bookingId, at, reason]
			)
		);
		return rows.length;
	}
}

/** Audit reason of a reschedule decided for weather; marks bookings that may decline with a full refund. */
export const WEATHER_RESCHEDULE_AUDIT_REASON = "weather_reschedule";
