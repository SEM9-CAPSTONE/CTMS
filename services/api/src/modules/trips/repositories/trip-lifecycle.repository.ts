import { Injectable, NotFoundException } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { TripStatus } from "../entities/trip.entity";

export interface OperationalTrip {
	tripId: string;
	title: string;
	status: TripStatus;
	startsAt: Date;
	endsAt: Date;
	actualStartedAt: Date | null;
	actualEndedAt: Date | null;
	weatherPausedAt: Date | null;
	routeStatus: string;
	capacityMin: number;
	confirmedParticipants: number;
}

@Injectable()
export class TripLifecycleRepository {
	async assignedTrip(
		manager: EntityManager,
		porterId: string,
		tripId: string,
		lock: boolean
	): Promise<OperationalTrip> {
		// Capture the projection after acquiring locks so concurrent changes are visible.
		if (lock) {
			const locked: Array<{ id: string }> = await manager.query(
				`SELECT t.id FROM trips t WHERE t.id=$1 AND EXISTS(SELECT 1 FROM trip_porters p
				 WHERE p.trip_id=t.id AND p.porter_id=$2 AND p.status='assigned') FOR UPDATE OF t`,
				[tripId, porterId]
			);
			if (!locked.length) throw new NotFoundException({ code: "TRIP_NOT_ACCESSIBLE" });
			const assignments: Array<{ porter_id: string }> = await manager.query(
				`SELECT porter_id FROM trip_porters WHERE trip_id=$1 AND porter_id=$2
				 AND status='assigned' FOR SHARE`,
				[tripId, porterId]
			);
			if (!assignments.length) throw new NotFoundException({ code: "TRIP_NOT_ACCESSIBLE" });
		}
		const trips: OperationalTrip[] = await manager.query(
			`SELECT t.id AS "tripId",t.title,t.status,t.starts_at AS "startsAt",t.ends_at AS "endsAt",
			 t.actual_started_at AS "actualStartedAt",t.actual_ended_at AS "actualEndedAt",
			 t.weather_paused_at AS "weatherPausedAt",r.status AS "routeStatus",t.capacity_min AS "capacityMin",
			 (SELECT COALESCE(sum(b.num_people),0)::int FROM bookings b
			  WHERE b.trip_id=t.id AND b.status='confirmed') AS "confirmedParticipants"
			 FROM trips t JOIN trekking_routes r ON r.id=t.route_id
			 WHERE t.id=$1 AND EXISTS(SELECT 1 FROM trip_porters p
			  WHERE p.trip_id=t.id AND p.porter_id=$2 AND p.status='assigned')
			 ${lock ? "FOR SHARE OF r" : ""}`,
			[tripId, porterId]
		);
		if (!trips[0]) throw new NotFoundException({ code: "TRIP_NOT_ACCESSIBLE" });
		return trips[0];
	}

	async recordTransition(
		manager: EntityManager,
		trip: OperationalTrip,
		porterId: string,
		target: TripStatus.ONGOING | TripStatus.COMPLETED
	): Promise<void> {
		const starting = target === TripStatus.ONGOING;
		const timeColumn = starting ? "actual_started_at" : "actual_ended_at";
		const actorColumn = starting ? "started_by_id" : "ended_by_id";
		await manager.query(
			`WITH moved AS (
			 UPDATE trips SET status=$2,${timeColumn}=clock_timestamp(),${actorColumn}=$3,
			 updated_at=clock_timestamp()${starting ? ",participation_evaluated_at=COALESCE(participation_evaluated_at,clock_timestamp())" : ""}
			 WHERE id=$1 RETURNING ${timeColumn} AS occurred_at
			) INSERT INTO audit_logs(actor_id,action,target_type,target_id,"before","after",reason)
			 SELECT $3,$4,'trip',$1,jsonb_build_object('status',$5::text),
			 jsonb_build_object('status',$2::text,'occurredAt',occurred_at),'Porter xác nhận trạng thái chuyến đi'
			 FROM moved`,
			[trip.tripId, target, porterId, starting ? "trip.started" : "trip.ended", trip.status]
		);
		if (!starting) {
			await manager.query(
				`UPDATE bookings
				 SET status = 'completed',
				     completed_at = COALESCE(completed_at, clock_timestamp())
				 WHERE trip_id = $1
				   AND status = 'confirmed'`,
				[trip.tripId]
			);
		}
	}
}
