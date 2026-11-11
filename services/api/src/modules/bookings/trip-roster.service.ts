import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource, type EntityManager } from "typeorm";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import type { BookingStatus } from "../profiles/entities/booking.entity";
import { TripPorterStatus } from "../profiles/entities/trip-porter.entity";
import type { TripStatus } from "../trips/entities/trip.entity";
import { UserRole } from "../users/entities/user.entity";
import type { BookingMemberStatus } from "./booking-member-status.enum";
import type {
	TripRosterMemberResponseDto,
	TripRosterResponseDto,
} from "./dto/trip-roster-response.dto";

interface TripRosterContextRow {
	tripId: string;
	hostId: string;
	status: TripStatus;
	startsAt: Date;
}

interface TripRosterMemberRow {
	memberId: string;
	bookingId: string;
	userId: string | null;
	displayName: string | null;
	email: string | null;
	isPrimary: boolean;
	memberStatus: BookingMemberStatus;
	bookingStatus: BookingStatus | null;
	checkedInAt: Date | null;
	noShowAt: Date | null;
	leftAt: Date | null;
}

@Injectable()
export class TripRosterService {
	constructor(private readonly dataSource: DataSource) {}

	getRoster(actor: AuthenticatedUser, tripId: string): Promise<TripRosterResponseDto> {
		return this.dataSource.transaction("REPEATABLE READ", async (manager) => {
			const trip = await this.findTripContext(manager, tripId);
			if (!trip) throw new NotFoundException("Trip not found");

			await this.assertActorScope(manager, actor, trip);
			const members = await this.findMembers(manager, tripId);

			return {
				tripId: trip.tripId,
				status: trip.status,
				startsAt: trip.startsAt,
				members,
			};
		});
	}

	private async findTripContext(
		manager: EntityManager,
		tripId: string
	): Promise<TripRosterContextRow | null> {
		const rows = (await manager.query(
			`SELECT
				t."id" AS "tripId",
				t."host_id" AS "hostId",
				t."status",
				t."starts_at" AS "startsAt"
			 FROM "trips" t
			 WHERE t."id" = $1`,
			[tripId]
		)) as TripRosterContextRow[];
		return rows[0] ?? null;
	}

	private async assertActorScope(
		manager: EntityManager,
		actor: AuthenticatedUser,
		trip: TripRosterContextRow
	): Promise<void> {
		if (actor.roles.includes(UserRole.HOST) && trip.hostId === actor.userId) return;

		if (actor.roles.includes(UserRole.PORTER)) {
			const rows = (await manager.query(
				`SELECT 1
				 FROM "trip_porters"
				 WHERE "trip_id" = $1
				   AND "porter_id" = $2
				   AND "status" = $3
				 LIMIT 1`,
				[trip.tripId, actor.userId, TripPorterStatus.ASSIGNED]
			)) as Array<{ exists: number }>;
			if (rows.length > 0) return;
		}

		throw new ForbiddenException("Actor is not authorized for this Trip");
	}

	private findMembers(
		manager: EntityManager,
		tripId: string
	): Promise<TripRosterMemberResponseDto[]> {
		return manager.query(
			`SELECT
				bm."id" AS "memberId",
				bm."booking_id" AS "bookingId",
				bm."user_id" AS "userId",
				u."full_name" AS "displayName",
				u."email",
				bm."is_primary" AS "isPrimary",
				bm."member_status" AS "memberStatus",
				b."status" AS "bookingStatus",
				bm."checked_in_at" AS "checkedInAt",
				bm."no_show_at" AS "noShowAt",
				bm."left_at" AS "leftAt"
			 FROM "bookings" b
			 INNER JOIN "booking_members" bm ON bm."booking_id" = b."id"
			 LEFT JOIN "users" u ON u."id" = bm."user_id"
			 WHERE b."trip_id" = $1
			 ORDER BY
				b."created_at" ASC,
				b."id" ASC,
				bm."is_primary" DESC,
				bm."created_at" ASC,
				bm."id" ASC`,
			[tripId]
		) as Promise<TripRosterMemberRow[]>;
	}
}
