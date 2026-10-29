import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { DataSource } from "typeorm";
import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import { GpsParticipantRole } from "../gps-tracking/gps-tracking.enums";
import { BookingStatus } from "../profiles/entities/booking.entity";
import { TripPorterStatus } from "../profiles/entities/trip-porter.entity";
import { SafetyEventType } from "../safety-events/safety-events.enums";
import { TripStatus } from "../trips/entities/trip.entity";
import type { MapPage, MapTripRow } from "./host-trip-map.types";

/** Read-only projection. Authorization, count and all child data share one statement snapshot. */
@Injectable()
export class HostTripMapRepository {
	constructor(private readonly db: DataSource) {}

	async read(
		hostId: string,
		page: number,
		limit: number,
		tripId: string | null = null
	): Promise<MapPage<MapTripRow>> {
		const rows = await this.db.query<Array<{ result: MapPage<MapTripRow> }>>(
			`WITH authorized AS (
			 SELECT t.* FROM trips t WHERE t.host_id=$1 AND t.status=$2
			 AND ($3::uuid IS NULL OR t.id=$3)
			), selected AS (
			 SELECT * FROM authorized ORDER BY starts_at,id LIMIT $4 OFFSET $5
			), projected AS (
			 SELECT t.id,t.title,t.starts_at AS "startsAt",t.ends_at AS "endsAt",
			 jsonb_build_object('id',r.id,'name',r.name,'geometry',ST_AsGeoJSON(r.route_geom::geometry)::jsonb,
			 'checkpoints',COALESCE((SELECT jsonb_agg(jsonb_build_object(
			 'id',c.id,'name',c.name,'type',c.type,'location',ST_AsGeoJSON(c.location::geometry)::jsonb,
			 'radiusMeters',c.radius_m,'routePosition',c.route_position) ORDER BY c.route_position,c.id)
			 FROM checkpoints c WHERE c.route_id=r.id),'[]'::jsonb)) AS route,
			 COALESCE((SELECT jsonb_agg(jsonb_build_object(
			 'id',p.id,'userId',p.user_id,'name',u.full_name,'role',p.role,'memberStatus',p.member_status,
			 'location',(SELECT jsonb_build_object('id',g.id,'latitude',ST_Y(g.location::geometry),
			 'longitude',ST_X(g.location::geometry),'accuracyMeters',g.accuracy_meters,
			 'eventTime',g.event_time,'receivedAt',g.received_at)
			 FROM gps_logs g WHERE g.trip_id=t.id AND g.user_id=p.user_id AND g.participant_role::text=p.role
			 ORDER BY g.event_time DESC,g.received_at DESC,g.id DESC LIMIT 1),
			 'safety',jsonb_build_object(
			 'route',(SELECT jsonb_build_object('type',s.event_type,'eventTime',s.event_time,'receivedAt',s.received_at)
			 FROM safety_events s WHERE s.trip_id=t.id AND s.user_id=p.user_id AND s.participant_role::text=p.role
			 AND s.event_type=ANY($11::safety_event_type[])
			 ORDER BY s.event_time DESC,s.received_at DESC,s.id DESC LIMIT 1),
			 'gps',(SELECT jsonb_build_object('type',s.event_type,'eventTime',s.event_time,'receivedAt',s.received_at)
			 FROM safety_events s WHERE s.trip_id=t.id AND s.user_id=p.user_id AND s.participant_role::text=p.role
			 AND s.event_type=ANY($12::safety_event_type[])
			 ORDER BY s.event_time DESC,s.received_at DESC,s.id DESC LIMIT 1),
			 'lastCheckpoint',(SELECT jsonb_build_object('checkpointId',v.checkpoint_id,'arrivedAt',v.arrived_at,'receivedAt',v.created_at)
			 FROM checkpoint_visits v WHERE v.trip_id=t.id AND v.member_id=p.id AND p.role=$8
			 ORDER BY v.arrived_at DESC,v.created_at DESC,v.id DESC LIMIT 1),
			 'behindSchedule',NULL)) ORDER BY p.role,p.id)
			 FROM (
			 SELECT m.id,m.user_id,m.member_status::text,$8::text AS role
			 FROM booking_members m JOIN bookings b ON b.id=m.booking_id
			 WHERE b.trip_id=t.id AND b.status=ANY($6::booking_status[])
			 AND m.member_status=ANY($7::booking_member_status[])
			 UNION ALL
			 SELECT tp.porter_id,tp.porter_id,NULL::text,$9::text
			 FROM trip_porters tp WHERE tp.trip_id=t.id AND tp.status=$10
			 ) p LEFT JOIN users u ON u.id=p.user_id),'[]'::jsonb) AS participants
			 FROM selected t JOIN trekking_routes r ON r.id=t.route_id
			) SELECT jsonb_build_object('total',(SELECT count(*) FROM authorized),
			 'items',COALESCE((SELECT jsonb_agg(to_jsonb(projected) ORDER BY "startsAt",id) FROM projected),'[]'::jsonb)) AS result`,
			[
				hostId,
				TripStatus.ONGOING,
				tripId,
				limit,
				(page - 1) * limit,
				[BookingStatus.CONFIRMED, BookingStatus.COMPLETED],
				[BookingMemberStatus.JOINED, BookingMemberStatus.LEFT],
				GpsParticipantRole.CAMPER,
				GpsParticipantRole.PORTER,
				TripPorterStatus.ASSIGNED,
				[SafetyEventType.OFF_ROUTE, SafetyEventType.ON_ROUTE_RECOVERED],
				[SafetyEventType.GPS_DEGRADED, SafetyEventType.GPS_RESTORED],
			]
		);
		return rows[0].result;
	}
}
