import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { DataSource } from "typeorm";
import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import { GpsParticipantRole } from "../gps-tracking/gps-tracking.enums";
import { BookingStatus } from "../profiles/entities/booking.entity";
import { TripPorterStatus } from "../profiles/entities/trip-porter.entity";
import { SafetyEventType } from "../safety-events/safety-events.enums";
import type { MemberLocationRow, MemberLocationsTrip } from "./member-locations.types";

/**
 * CTMS-066 read projection. Reads only server-persisted tables (gps_logs, safety_events,
 * checkpoint_visits); data still buffered on a device cannot appear here (BR-246).
 */
@Injectable()
export class MemberLocationsRepository {
	constructor(private readonly db: DataSource) {}

	async findTrip(tripId: string): Promise<MemberLocationsTrip | null> {
		const rows = await this.db.query<MemberLocationsTrip[]>(
			`SELECT id, host_id AS "hostId", status::text AS status FROM trips WHERE id=$1`,
			[tripId]
		);
		return rows[0] ?? null;
	}

	async isAssignedPorter(tripId: string, userId: string): Promise<boolean> {
		const rows = await this.db.query<unknown[]>(
			"SELECT 1 FROM trip_porters WHERE trip_id=$1 AND porter_id=$2 AND status=$3",
			[tripId, userId, TripPorterStatus.ASSIGNED]
		);
		return rows.length > 0;
	}

	/** Eligible members use the same rule as CTMS-369: joined/left Campers of confirmed/completed bookings, assigned Porters. */
	async findMembers(tripId: string): Promise<MemberLocationRow[]> {
		return this.db.query<MemberLocationRow[]>(
			`SELECT p.id, p.user_id AS "userId", u.full_name AS name, p.role, p.member_status AS "memberStatus",
			 (SELECT jsonb_build_object('id',g.id,'latitude',ST_Y(g.location::geometry),'longitude',ST_X(g.location::geometry),
			   'accuracyMeters',g.accuracy_meters,'eventTime',g.event_time,'receivedAt',g.received_at)
			  FROM gps_logs g WHERE g.trip_id=$1 AND g.user_id=p.user_id AND g.participant_role::text=p.role
			  ORDER BY g.event_time DESC,g.received_at DESC,g.id DESC LIMIT 1) AS location,
			 (SELECT max(x.received_at) FROM (
			   SELECT g.received_at FROM gps_logs g WHERE g.trip_id=$1 AND g.user_id=p.user_id AND g.participant_role::text=p.role
			   UNION ALL
			   SELECT s.received_at FROM safety_events s WHERE s.trip_id=$1 AND s.user_id=p.user_id AND s.participant_role::text=p.role
			   AND s.event_type::text <> 'BEHIND_SCHEDULE') x) AS "lastSyncedAt",
			 (SELECT jsonb_build_object('type',s.event_type,'eventTime',s.event_time,'receivedAt',s.received_at)
			  FROM safety_events s WHERE s.trip_id=$1 AND s.user_id=p.user_id AND s.participant_role::text=p.role
			  AND s.event_type=ANY($7::safety_event_type[])
			  ORDER BY s.event_time DESC,s.received_at DESC,s.id DESC LIMIT 1) AS route,
			 (SELECT jsonb_build_object('type',s.event_type,'eventTime',s.event_time,'receivedAt',s.received_at)
			  FROM safety_events s WHERE s.trip_id=$1 AND s.user_id=p.user_id AND s.participant_role::text=p.role
			  AND s.event_type=ANY($8::safety_event_type[])
			  ORDER BY s.event_time DESC,s.received_at DESC,s.id DESC LIMIT 1) AS gps,
			 (SELECT jsonb_build_object('checkpointId',v.checkpoint_id,'checkpointName',c.name,'arrivedAt',v.arrived_at,'receivedAt',v.created_at)
			  FROM checkpoint_visits v JOIN checkpoints c ON c.id=v.checkpoint_id
			  WHERE v.trip_id=$1 AND v.member_id=p.id AND p.role=$4
			  ORDER BY v.arrived_at DESC,v.created_at DESC,v.id DESC LIMIT 1) AS "lastCheckpoint"
			 FROM (
			  SELECT m.id,m.user_id,m.member_status::text AS member_status,$4::text AS role
			  FROM booking_members m JOIN bookings b ON b.id=m.booking_id
			  WHERE b.trip_id=$1 AND b.status=ANY($2::booking_status[]) AND m.member_status=ANY($3::booking_member_status[])
			  UNION ALL
			  SELECT tp.porter_id,tp.porter_id,NULL::text,$5::text
			  FROM trip_porters tp WHERE tp.trip_id=$1 AND tp.status=$6
			 ) p LEFT JOIN users u ON u.id=p.user_id
			 ORDER BY p.role, u.full_name NULLS LAST, p.id`,
			[
				tripId,
				[BookingStatus.CONFIRMED, BookingStatus.COMPLETED],
				[BookingMemberStatus.JOINED, BookingMemberStatus.LEFT],
				GpsParticipantRole.CAMPER,
				GpsParticipantRole.PORTER,
				TripPorterStatus.ASSIGNED,
				[SafetyEventType.OFF_ROUTE, SafetyEventType.ON_ROUTE_RECOVERED],
				[SafetyEventType.GPS_DEGRADED, SafetyEventType.GPS_RESTORED],
			]
		);
	}
}
