import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource } from "typeorm";
import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import { BookingStatus } from "../profiles/entities/booking.entity";
import { TripPorterStatus } from "../profiles/entities/trip-porter.entity";
import type { TripStatus } from "../trips/entities/trip.entity";

export interface TrackedTrip {
	id: string;
	hostId?: string;
	status: TripStatus;
	startsAt: Date;
	endsAt: Date;
}

export interface CamperParticipation {
	memberStatus: BookingMemberStatus;
	checkedInAt: Date | null;
	leftAt: Date | null;
}

/** Bookings whose members can still be Trip participants. */
const PARTICIPATING_BOOKING_STATUSES = [BookingStatus.CONFIRMED, BookingStatus.COMPLETED];

/**
 * CTMS-059. Reads who may record GPS breadcrumbs for a Trip (BR-237).
 *
 * The Porter lookup uses the legacy `trip_porters` table because the
 * authoritative CTMS-47 `porter_assignments` source does not exist yet; replace
 * `isPorterAssigned` when it does (same approach as PorterScheduleConflictSource).
 */
@Injectable()
export class GpsParticipationSource {
	constructor(private readonly dataSource: DataSource) {}

	async findTrip(tripId: string): Promise<TrackedTrip | null> {
		const rows = (await this.dataSource.query(
			`SELECT "id", "host_id" AS "hostId", "status", "starts_at" AS "startsAt", "ends_at" AS "endsAt"
			 FROM "trips" WHERE "id" = $1`,
			[tripId]
		)) as TrackedTrip[];
		return rows[0] ?? null;
	}

	/** The caller's membership on a participating Booking of the Trip, preferring a joined one. */
	async findCamperParticipation(
		tripId: string,
		userId: string
	): Promise<CamperParticipation | null> {
		const rows = (await this.dataSource.query(
			`SELECT member."member_status" AS "memberStatus",
			        member."checked_in_at" AS "checkedInAt",
			        member."left_at" AS "leftAt"
			 FROM "booking_members" member
			 INNER JOIN "bookings" booking ON booking."id" = member."booking_id"
			 WHERE booking."trip_id" = $1
			   AND member."user_id" = $2
			   AND booking."status" = ANY($3::booking_status[])
			 ORDER BY (member."member_status" = $4) DESC, member."created_at" ASC
			 LIMIT 1`,
			[tripId, userId, PARTICIPATING_BOOKING_STATUSES, BookingMemberStatus.JOINED]
		)) as CamperParticipation[];
		return rows[0] ?? null;
	}

	/** Null when the user has no Porter link to the Trip at all; otherwise whether it is assigned. */
	async findPorterAssignment(
		tripId: string,
		userId: string
	): Promise<{ assigned: boolean } | null> {
		const rows = (await this.dataSource.query(
			`SELECT "status" FROM "trip_porters" WHERE "trip_id" = $1 AND "porter_id" = $2`,
			[tripId, userId]
		)) as Array<{ status: TripPorterStatus }>;
		if (rows.length === 0) {
			return null;
		}
		return { assigned: rows[0].status === TripPorterStatus.ASSIGNED };
	}
}
