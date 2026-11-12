import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource, type EntityManager } from "typeorm";
import type { GpsParticipantRole } from "../gps-tracking/gps-tracking.enums";
import { TripStatus } from "../trips/entities/trip.entity";

export interface AnalysisTrip {
	id: string;
	status: TripStatus;
	routeId: string;
	routeVersion: string;
	startsAt: Date;
	endsAt: Date;
	updatedAt: Date;
	/** Offline package version prepared for the Trip at departure, when one exists. */
	offlinePackageVersion: string | null;
}

export interface StoredGpsSample {
	id: string;
	userId: string;
	participantRole: GpsParticipantRole;
	eventTime: Date;
	accuracyMeters: number | null;
	distanceMeters: number;
	lng: number;
	lat: number;
	routeFraction: number;
	packageVersion: string | null;
}

export interface NewTripAnalysis {
	tripId: string;
	analysisVersion: string;
	routeId: string;
	routeVersion: string;
	runtimeContext: Record<string, unknown>;
	participants: number;
	samplesTotal: number;
	samplesUsed: number;
	samplesExcluded: Record<string, number>;
	triggeredBy: string | null;
	analyzedAt: Date;
}

export interface NewRouteDeviationEvent {
	analysisVersion: string;
	configVersion: string;
	tripId: string;
	routeId: string;
	routeVersion: string;
	packageVersion: string | null;
	userId: string;
	participantRole: GpsParticipantRole;
	startedAt: Date;
	confirmedAt: Date;
	endedAt: Date;
	recoveryConfirmedAt: Date | null;
	endReason: string;
	sampleCount: number;
	validSampleCount: number;
	maxDistanceMeters: number;
	avgDistanceMeters: number;
	startLng: number;
	startLat: number;
	maxLng: number;
	maxLat: number;
	startRouteFraction: number;
	startGpsLogId: string;
	endGpsLogId: string;
	deviceSafetyEventIds: string[];
	runtimeContext: Record<string, unknown>;
	authoritative: boolean;
	contextIssues: string[];
}

const EVENT_COLUMNS = `event."id", event."analysis_version" AS "analysisVersion", event."config_version" AS "configVersion",
	event."trip_id" AS "tripId", event."route_id" AS "routeId", event."route_version" AS "routeVersion",
	event."package_version" AS "packageVersion", event."user_id" AS "userId", event."participant_role" AS "participantRole",
	event."started_at" AS "startedAt", event."confirmed_at" AS "confirmedAt", event."ended_at" AS "endedAt",
	event."recovery_confirmed_at" AS "recoveryConfirmedAt", event."end_reason" AS "endReason",
	event."sample_count" AS "sampleCount", event."valid_sample_count" AS "validSampleCount",
	event."max_distance_meters" AS "maxDistanceMeters", event."avg_distance_meters" AS "avgDistanceMeters",
	ST_Y(event."start_location"::geometry) AS "startLat", ST_X(event."start_location"::geometry) AS "startLng",
	ST_Y(event."max_distance_location"::geometry) AS "maxLat", ST_X(event."max_distance_location"::geometry) AS "maxLng",
	event."start_route_fraction" AS "startRouteFraction", event."start_gps_log_id" AS "startGpsLogId",
	event."end_gps_log_id" AS "endGpsLogId", event."device_safety_event_ids" AS "deviceSafetyEventIds",
	event."runtime_context" AS "runtimeContext", event."authoritative", event."context_issues" AS "contextIssues",
	event."created_at" AS "createdAt"`;

export type RouteDeviationEventRow = Omit<
	NewRouteDeviationEvent,
	"startLng" | "startLat" | "maxLng" | "maxLat"
> & {
	id: string;
	startLat: number;
	startLng: number;
	maxLat: number;
	maxLng: number;
	createdAt: Date;
};

export interface TripAnalysisRow extends Omit<NewTripAnalysis, "triggeredBy"> {
	id: string;
	episodes: number;
	triggeredBy: string | null;
}

/** CTMS-115: reads raw evidence (never writes it) and stores the derived episodes. */
@Injectable()
export class RouteDeviationAnalysisRepository {
	constructor(private readonly dataSource: DataSource) {}

	transaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
		return this.dataSource.transaction(work);
	}

	/** Completed Trips without an analysis of this version, oldest first. */
	async findTripsToAnalyze(analysisVersion: string, limit: number): Promise<string[]> {
		const rows = (await this.dataSource.query(
			`SELECT trip."id" FROM "trips" trip
			 WHERE trip."status" = $1
			   AND NOT EXISTS (
			     SELECT 1 FROM "route_deviation_trip_analyses" analysis
			     WHERE analysis."trip_id" = trip."id" AND analysis."analysis_version" = $2
			   )
			 ORDER BY trip."ends_at" ASC, trip."id" ASC
			 LIMIT $3`,
			[TripStatus.COMPLETED, analysisVersion, limit]
		)) as Array<{ id: string }>;
		return rows.map((row) => row.id);
	}

	/**
	 * Locks the Trip row so two runs never analyse it at once; with `skipLocked` a busy Trip is
	 * skipped (worker) instead of waited for (Admin run).
	 */
	async lockTrip(
		manager: EntityManager,
		tripId: string,
		skipLocked: boolean
	): Promise<AnalysisTrip | null> {
		const rows = (await manager.query(
			`SELECT trip."id", trip."status", trip."route_id" AS "routeId",
			        md5(ST_AsBinary(route."route_geom")) AS "routeVersion",
			        trip."starts_at" AS "startsAt", trip."ends_at" AS "endsAt", trip."updated_at" AS "updatedAt",
			        (SELECT package."package_version"::text FROM "offline_packages" package
			         WHERE package."trip_id" = trip."id" AND package."generated_at" <= trip."starts_at"
			         ORDER BY package."package_version" DESC LIMIT 1) AS "offlinePackageVersion"
			 FROM "trips" trip
			 INNER JOIN "trekking_routes" route ON route."id" = trip."route_id"
			 WHERE trip."id" = $1
			 FOR UPDATE OF trip ${skipLocked ? "SKIP LOCKED" : ""}`,
			[tripId]
		)) as AnalysisTrip[];
		return rows[0] ?? null;
	}

	async tripExists(tripId: string): Promise<boolean> {
		const rows = (await this.dataSource.query(`SELECT 1 FROM "trips" WHERE "id" = $1`, [
			tripId,
		])) as unknown[];
		return rows.length > 0;
	}

	/** Every stored log of the Trip with its distance (metres) and position along the Route. */
	async findSamples(manager: EntityManager, tripId: string): Promise<StoredGpsSample[]> {
		const rows = (await manager.query(
			`SELECT log."id", log."user_id" AS "userId", log."participant_role" AS "participantRole",
			        log."event_time" AS "eventTime", log."accuracy_meters" AS "accuracyMeters",
			        ST_Distance(log."location", route."route_geom") AS "distanceMeters",
			        ST_X(log."location"::geometry) AS "lng", ST_Y(log."location"::geometry) AS "lat",
			        ST_LineLocatePoint(route."route_geom"::geometry, log."location"::geometry) AS "routeFraction",
			        log."package_version" AS "packageVersion"
			 FROM "gps_logs" log
			 INNER JOIN "trips" trip ON trip."id" = log."trip_id"
			 INNER JOIN "trekking_routes" route ON route."id" = trip."route_id"
			 WHERE log."trip_id" = $1
			 ORDER BY log."user_id", log."event_time", log."id"`,
			[tripId]
		)) as StoredGpsSample[];
		return rows.map((row) => ({
			...row,
			eventTime: new Date(row.eventTime),
			accuracyMeters: row.accuracyMeters === null ? null : Number(row.accuracyMeters),
			distanceMeters: Number(row.distanceMeters),
			lng: Number(row.lng),
			lat: Number(row.lat),
			routeFraction: Number(row.routeFraction),
		}));
	}

	/** Device-reported OFF_ROUTE / ON_ROUTE_RECOVERED events of one participant in a time range. */
	async findDeviceEvents(
		manager: EntityManager,
		tripId: string,
		userId: string,
		from: Date,
		to: Date
	): Promise<string[]> {
		const rows = (await manager.query(
			`SELECT "id" FROM "safety_events"
			 WHERE "trip_id" = $1 AND "user_id" = $2
			   AND "event_type" IN ('OFF_ROUTE', 'ON_ROUTE_RECOVERED')
			   AND "event_time" BETWEEN $3 AND $4
			 ORDER BY "event_time", "id"`,
			[tripId, userId, from, to]
		)) as Array<{ id: string }>;
		return rows.map((row) => row.id);
	}

	/** Replaces the Trip's analysis of this version and its episodes in one go (idempotent re-run). */
	async replaceAnalysis(
		manager: EntityManager,
		analysis: NewTripAnalysis,
		events: NewRouteDeviationEvent[]
	): Promise<string> {
		await manager.query(
			`DELETE FROM "route_deviation_trip_analyses" WHERE "trip_id" = $1 AND "analysis_version" = $2`,
			[analysis.tripId, analysis.analysisVersion]
		);
		const [{ id }] = (await manager.query(
			`INSERT INTO "route_deviation_trip_analyses"
			   ("trip_id", "analysis_version", "route_id", "route_version", "runtime_context", "participants",
			    "samples_total", "samples_used", "samples_excluded", "episodes", "triggered_by", "analyzed_at")
			 VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9::jsonb, $10, $11, $12)
			 RETURNING "id"`,
			[
				analysis.tripId,
				analysis.analysisVersion,
				analysis.routeId,
				analysis.routeVersion,
				JSON.stringify(analysis.runtimeContext),
				analysis.participants,
				analysis.samplesTotal,
				analysis.samplesUsed,
				JSON.stringify(analysis.samplesExcluded),
				events.length,
				analysis.triggeredBy,
				analysis.analyzedAt,
			]
		)) as Array<{ id: string }>;
		for (const event of events) {
			await manager.query(
				`INSERT INTO "route_deviation_events"
				   ("analysis_id", "analysis_version", "config_version", "trip_id", "route_id", "route_version",
				    "package_version", "user_id", "participant_role", "started_at", "confirmed_at", "ended_at",
				    "recovery_confirmed_at", "end_reason", "sample_count", "valid_sample_count",
				    "max_distance_meters", "avg_distance_meters", "start_location", "max_distance_location",
				    "start_route_fraction", "start_gps_log_id", "end_gps_log_id", "device_safety_event_ids",
				    "runtime_context", "authoritative", "context_issues")
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
				   ST_SetSRID(ST_MakePoint($19, $20), 4326)::geography, ST_SetSRID(ST_MakePoint($21, $22), 4326)::geography,
				   $23, $24, $25, $26::uuid[], $27::jsonb, $28, $29::text[])`,
				[
					id,
					event.analysisVersion,
					event.configVersion,
					event.tripId,
					event.routeId,
					event.routeVersion,
					event.packageVersion,
					event.userId,
					event.participantRole,
					event.startedAt,
					event.confirmedAt,
					event.endedAt,
					event.recoveryConfirmedAt,
					event.endReason,
					event.sampleCount,
					event.validSampleCount,
					event.maxDistanceMeters,
					event.avgDistanceMeters,
					event.startLng,
					event.startLat,
					event.maxLng,
					event.maxLat,
					Math.min(1, Math.max(0, event.startRouteFraction)),
					event.startGpsLogId,
					event.endGpsLogId,
					event.deviceSafetyEventIds,
					JSON.stringify(event.runtimeContext),
					event.authoritative,
					event.contextIssues,
				]
			);
		}
		return id;
	}

	async findAnalysis(tripId: string, analysisVersion: string): Promise<TripAnalysisRow | null> {
		const rows = (await this.dataSource.query(
			`SELECT "id", "trip_id" AS "tripId", "analysis_version" AS "analysisVersion", "route_id" AS "routeId",
			        "route_version" AS "routeVersion", "runtime_context" AS "runtimeContext", "participants",
			        "samples_total" AS "samplesTotal", "samples_used" AS "samplesUsed",
			        "samples_excluded" AS "samplesExcluded", "episodes", "triggered_by" AS "triggeredBy",
			        "analyzed_at" AS "analyzedAt"
			 FROM "route_deviation_trip_analyses" WHERE "trip_id" = $1 AND "analysis_version" = $2`,
			[tripId, analysisVersion]
		)) as TripAnalysisRow[];
		return rows[0] ?? null;
	}

	async findEvents(filter: {
		analysisVersion: string;
		tripId?: string;
		routeId?: string;
		authoritative?: boolean;
		limit: number;
	}): Promise<RouteDeviationEventRow[]> {
		const conditions = [`event."analysis_version" = $1`];
		const params: unknown[] = [filter.analysisVersion];
		if (filter.tripId) {
			params.push(filter.tripId);
			conditions.push(`event."trip_id" = $${params.length}`);
		}
		if (filter.routeId) {
			params.push(filter.routeId);
			conditions.push(`event."route_id" = $${params.length}`);
		}
		if (filter.authoritative !== undefined) {
			params.push(filter.authoritative);
			conditions.push(`event."authoritative" = $${params.length}`);
		}
		params.push(filter.limit);
		return (await this.dataSource.query(
			`SELECT ${EVENT_COLUMNS} FROM "route_deviation_events" event
			 WHERE ${conditions.join(" AND ")}
			 ORDER BY event."started_at" DESC, event."id" DESC
			 LIMIT $${params.length}`,
			params
		)) as RouteDeviationEventRow[];
	}
}
