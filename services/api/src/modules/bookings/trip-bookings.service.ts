import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { DataSource, type EntityManager } from "typeorm";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { TripPorterStatus } from "../profiles/entities/trip-porter.entity";
import type { TripStatus } from "../trips/entities/trip.entity";
import { UserRole } from "../users/entities/user.entity";
import type {
	TripBookingItemDto,
	TripBookingsResponseDto,
	TripEquipmentPreparationItemDto,
} from "./dto/trip-bookings-response.dto";

interface TripContextRow {
	tripId: string;
	hostId: string;
	status: TripStatus;
	startsAt: Date;
}

@Injectable()
export class TripBookingsService {
	constructor(private readonly dataSource: DataSource) {}

	async getBookings(actor: AuthenticatedUser, tripId: string): Promise<TripBookingsResponseDto> {
		return this.dataSource.transaction("REPEATABLE READ", async (manager) => {
			const trip = await this.findTripContext(manager, tripId);
			if (!trip) throw new NotFoundException("Trip not found");

			await this.assertActorScope(manager, actor, trip);

			const [bookings, equipmentSummary] = await Promise.all([
				this.findBookings(manager, tripId),
				this.findEquipmentSummary(manager, tripId),
			]);

			return {
				tripId: trip.tripId,
				status: trip.status,
				startsAt: trip.startsAt,
				bookings,
				equipmentSummary,
			};
		});
	}

	private async findTripContext(
		manager: EntityManager,
		tripId: string
	): Promise<TripContextRow | null> {
		const rows = (await manager.query(
			`SELECT
				t."id" AS "tripId",
				t."host_id" AS "hostId",
				t."status",
				t."starts_at" AS "startsAt"
			 FROM "trips" t
			 WHERE t."id" = $1`,
			[tripId]
		)) as TripContextRow[];
		return rows[0] ?? null;
	}

	private async assertActorScope(
		manager: EntityManager,
		actor: AuthenticatedUser,
		trip: TripContextRow
	): Promise<void> {
		if (actor.roles.includes(UserRole.ADMIN)) return;

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

		throw new ForbiddenException("Actor is not authorized to view bookings for this Trip");
	}

	private async findBookings(
		manager: EntityManager,
		tripId: string
	): Promise<TripBookingItemDto[]> {
		const rows = (await manager.query(
			`SELECT
				b."id",
				b."trip_id" AS "tripId",
				b."user_id" AS "userId",
				COALESCE(b."num_people", 1)::int AS "numPeople",
				b."status",
				b."payment_status" AS "paymentStatus",
				b."base_price"::text AS "basePrice",
				b."total_amount"::text AS "totalAmount",
				b."created_at" AS "createdAt",
				b."completed_at" AS "completedAt",
				jsonb_build_object(
					'id', u."id",
					'fullName', u."full_name",
					'email', u."email",
					'phone', u."phone",
					'avatarUrl', u."avatar_url"
				) AS "booker",
				COALESCE(
					(
						SELECT jsonb_agg(
							jsonb_build_object(
								'id', bm."id",
								'userId', bm."user_id",
								'displayName', COALESCE(mu."full_name", mu."email"),
								'email', mu."email",
								'isPrimary', bm."is_primary",
								'memberStatus', bm."member_status"
							)
							ORDER BY bm."is_primary" DESC, bm."created_at" ASC
						)
						FROM "booking_members" bm
						LEFT JOIN "users" mu ON mu."id" = bm."user_id"
						WHERE bm."booking_id" = b."id"
					),
					'[]'::jsonb
				) AS "members",
				COALESCE(
					(
						SELECT jsonb_agg(
							jsonb_build_object(
								'id', bi."id",
								'equipmentCatalogItemId', bi."equipment_catalog_item_id",
								'name', eci."name",
								'category', eci."category",
								'quantity', bi."quantity",
								'unitPrice', bi."unit_price"::text,
								'rentalDays', bi."rental_days",
								'totalPrice', bi."total_price"::text
							)
							ORDER BY bi."created_at" ASC
						)
						FROM "booking_items" bi
						JOIN "equipment_catalog_items" eci ON eci."id" = bi."equipment_catalog_item_id"
						WHERE bi."booking_id" = b."id"
					),
					'[]'::jsonb
				) AS "equipmentItems"
			 FROM "bookings" b
			 LEFT JOIN "users" u ON u."id" = b."user_id"
			 WHERE b."trip_id" = $1
			 ORDER BY b."created_at" DESC`,
			[tripId]
		)) as TripBookingItemDto[];

		return rows;
	}

	private async findEquipmentSummary(
		manager: EntityManager,
		tripId: string
	): Promise<TripEquipmentPreparationItemDto[]> {
		const rows = (await manager.query(
			`SELECT
				eci."id" AS "equipmentCatalogItemId",
				eci."name",
				eci."category",
				COALESCE(eci."quantity_total", 0)::int AS "inventoryQuantity",
				SUM(bi."quantity")::int AS "totalQuantity",
				COUNT(DISTINCT b."id")::int AS "bookingCount"
			 FROM "booking_items" bi
			 JOIN "bookings" b ON b."id" = bi."booking_id"
			 JOIN "equipment_catalog_items" eci ON eci."id" = bi."equipment_catalog_item_id"
			 WHERE b."trip_id" = $1
			   AND b."status" NOT IN ('cancelled', 'expired')
			 GROUP BY eci."id", eci."name", eci."category", eci."quantity_total"
			 ORDER BY eci."name" ASC`,
			[tripId]
		)) as TripEquipmentPreparationItemDto[];

		return rows;
	}
}
