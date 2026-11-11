import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { DataSource, type EntityManager } from "typeorm";
import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import { BookingStatus } from "../profiles/entities/booking.entity";
import { TripPorterStatus } from "../profiles/entities/trip-porter.entity";
import { TripStatus } from "../trips/entities/trip.entity";

@Injectable()
export class OfflinePackageAccessRepository {
	constructor(private readonly db: DataSource) {}

	/** No booking-owner shortcut: the authenticated person must be an actual member. */
	async downloadableTripStatus(
		tripId: string,
		userId: string
	): Promise<TripStatus.PUBLISHED | TripStatus.ONGOING | null> {
		const status = await this.participantTripStatus(tripId, userId);
		return status === TripStatus.PUBLISHED || status === TripStatus.ONGOING ? status : null;
	}

	/** Same participation predicate, optionally evaluated within a caller's DB snapshot. */
	async participantTripStatus(
		tripId: string,
		userId: string,
		manager: EntityManager = this.db.manager
	): Promise<TripStatus | null> {
		const rows: { status: TripStatus }[] = await manager.query(
			`SELECT t.status FROM trips t WHERE t.id=$1 AND (
			  EXISTS (SELECT 1 FROM booking_members m JOIN bookings b ON b.id=m.booking_id
			   WHERE b.trip_id=t.id AND m.user_id=$2 AND b.status::text=$3
			   AND m.member_status::text=ANY($4::text[]) AND m.left_at IS NULL)
			  OR EXISTS (SELECT 1 FROM trip_porters p
			   WHERE p.trip_id=t.id AND p.porter_id=$2 AND p.status::text=$5)
			 )`,
			[
				tripId,
				userId,
				BookingStatus.CONFIRMED,
				[BookingMemberStatus.REGISTERED, BookingMemberStatus.JOINED],
				TripPorterStatus.ASSIGNED,
			]
		);
		return rows[0]?.status ?? null;
	}
}
