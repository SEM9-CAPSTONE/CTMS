import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { DataSource } from "typeorm";
import { TripPorterStatus } from "../profiles/entities/trip-porter.entity";
import { SosStatus } from "../sos/sos.enums";
import { TripStatus } from "../trips/entities/trip.entity";
import { WeatherSnapshotStatus } from "../weather/entities/weather-snapshot.entity";
import {
	type OverviewBooking,
	type OverviewPage,
	type OverviewPorter,
	type OverviewRoute,
	type OverviewSos,
	type OverviewTrip,
	type OverviewWeather,
	OverviewWeatherState,
} from "./host-overview.types";

/** Read projections only. Each source's count and page share one PostgreSQL statement snapshot. */
@Injectable()
export class HostOverviewRepository {
	constructor(private readonly db: DataSource) {}

	private async page<T>(
		sql: string,
		params: unknown[],
		page: number,
		limit: number
	): Promise<OverviewPage<T>> {
		const rows = await this.db.query<Array<{ result: OverviewPage<T> }>>(
			`WITH source AS (${sql}), selected AS (
			 SELECT * FROM source ORDER BY "sortKey" DESC, "id" ASC
			 LIMIT $${params.length + 1} OFFSET $${params.length + 2}
			) SELECT jsonb_build_object('total',(SELECT count(*) FROM source),
			 'items',COALESCE((SELECT jsonb_agg(to_jsonb(selected) - 'sortKey' ORDER BY "sortKey" DESC,"id" ASC) FROM selected),'[]'::jsonb)) AS result`,
			[...params, limit, (page - 1) * limit]
		);
		return rows[0].result;
	}

	bookings(
		hostId: string,
		at: string,
		timeZone: string,
		page: number,
		limit: number
	): Promise<OverviewPage<OverviewBooking>> {
		return this.page(
			`SELECT b.id, b.trip_id AS "tripId", b.status, b.payment_status AS "paymentStatus",
		 b.num_people AS "numPeople", b.created_at AS "createdAt", b.created_at AS "sortKey"
		 FROM bookings b JOIN trips t ON t.id=b.trip_id WHERE t.host_id=$1
		 AND b.created_at >= (date_trunc('day',$2::timestamptz AT TIME ZONE $3) AT TIME ZONE $3)
		 AND b.created_at < ((date_trunc('day',$2::timestamptz AT TIME ZONE $3)+interval '1 day') AT TIME ZONE $3)`,
			[hostId, at, timeZone],
			page,
			limit
		);
	}

	trips(hostId: string, page: number, limit: number): Promise<OverviewPage<OverviewTrip>> {
		return this.page(
			`SELECT t.id,t.title,t.route_id AS "routeId",t.status,t.starts_at AS "startsAt",
		 t.ends_at AS "endsAt",t.updated_at AS "updatedAt",t.starts_at AS "sortKey"
		 FROM trips t WHERE t.host_id=$1 AND t.status=$2`,
			[hostId, TripStatus.ONGOING],
			page,
			limit
		);
	}

	routes(hostId: string, page: number, limit: number): Promise<OverviewPage<OverviewRoute>> {
		return this.page(
			`SELECT r.id,r.name,r.status,r.updated_at AS "updatedAt",r.updated_at AS "sortKey"
		 FROM trekking_routes r WHERE r.host_id=$1`,
			[hostId],
			page,
			limit
		);
	}

	porters(hostId: string, page: number, limit: number): Promise<OverviewPage<OverviewPorter>> {
		return this.page(
			`SELECT p.porter_id AS id,p.porter_id AS "porterId",max(t.starts_at) AS "sortKey",
		 jsonb_agg(jsonb_build_object('tripId',t.id,'status',p.status) ORDER BY t.id) AS assignments
		 FROM trip_porters p JOIN trips t ON t.id=p.trip_id WHERE t.host_id=$1
		 AND t.status=ANY($2::trip_status[]) AND p.status=ANY($3::trip_porter_status[])
		 GROUP BY p.porter_id`,
			[
				hostId,
				[TripStatus.PUBLISHED, TripStatus.ONGOING],
				[TripPorterStatus.ASSIGNED, TripPorterStatus.PENDING_RECONFIRMATION],
			],
			page,
			limit
		);
	}

	sos(hostId: string, page: number, limit: number): Promise<OverviewPage<OverviewSos>> {
		return this.page(
			`SELECT s.id,s.trip_id AS "tripId",s.status,s.emergency_type AS "emergencyType",
		 s.event_time AS "eventTime",s.received_at AS "receivedAt",s.updated_at AS "updatedAt",s.event_time AS "sortKey"
		 FROM sos_alerts s JOIN trips t ON t.id=s.trip_id WHERE t.host_id=$1 AND s.status=ANY($2::sos_status[])`,
			[hostId, [SosStatus.ACTIVE, SosStatus.ACKNOWLEDGED]],
			page,
			limit
		);
	}

	weather(
		hostId: string,
		at: string,
		maxAgeSeconds: number,
		page: number,
		limit: number
	): Promise<OverviewPage<OverviewWeather>> {
		return this.page(
			`SELECT r.id,r.id AS "routeId",r.updated_at AS "sortKey",a.id AS "assessmentId",
		 a.risk_level AS "riskLevel",a.criteria_scores AS "criteriaScores",a.created_at AS "assessedAt",
		 s.observed_at AS "observedAt",s.created_at AS "fetchedAt",
		 CASE WHEN a.id IS NULL OR s.status IS DISTINCT FROM $4 OR s.observed_at IS NULL THEN $5
		 WHEN rule.is_active IS DISTINCT FROM TRUE OR s.observed_at > $2::timestamptz OR s.created_at > $2::timestamptz
		 OR a.created_at > $2::timestamptz
		 OR s.observed_at < $2::timestamptz - $3::double precision * interval '1 second'
		 OR s.created_at < $2::timestamptz - $3::double precision * interval '1 second'
		 OR EXISTS(SELECT 1 FROM weather_snapshots newer WHERE newer.route_id=r.id
		 AND (newer.created_at,newer.id) > (s.created_at,s.id)) THEN $6 ELSE $7 END AS state
		 FROM trekking_routes r
		 LEFT JOIN LATERAL (SELECT * FROM weather_risk_assessments a WHERE a.route_id=r.id ORDER BY a.created_at DESC,a.id DESC LIMIT 1) a ON TRUE
		 LEFT JOIN weather_snapshots s ON s.id=a.snapshot_id AND s.route_id=r.id
		 LEFT JOIN weather_risk_rules rule ON rule.id=a.rule_version_id
		 WHERE EXISTS(SELECT 1 FROM trips t WHERE t.host_id=$1 AND t.route_id=r.id AND t.status=ANY($8::trip_status[]))`,
			[
				hostId,
				at,
				maxAgeSeconds,
				WeatherSnapshotStatus.SUCCESS,
				OverviewWeatherState.UNAVAILABLE,
				OverviewWeatherState.STALE,
				OverviewWeatherState.AVAILABLE,
				[TripStatus.PUBLISHED, TripStatus.ONGOING],
			],
			page,
			limit
		);
	}
}
