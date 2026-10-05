import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import type { Booking } from "../profiles/entities/booking.entity";
import type { BookingDetailsResponseDto } from "./dto/booking-details-response.dto";
import type { BookingListItemResponseDto } from "./dto/booking-list-item-response.dto";

export interface BookingOwnership {
	id: string;
	userId: string;
}

export interface BookingExpiryCandidate {
	id: string;
}

interface RawBookingDetails
	extends Omit<BookingDetailsResponseDto, "createdAt" | "members" | "equipmentItems"> {
	createdAt: Date;
	members: Array<
		Omit<BookingDetailsResponseDto["members"][number], "createdAt" | "updatedAt"> & {
			createdAt: string;
			updatedAt: string;
		}
	>;
	equipmentItems: Array<
		Omit<BookingDetailsResponseDto["equipmentItems"][number], "createdAt"> & { createdAt: string }
	>;
}

@Injectable()
export class BookingsRepository extends Repository<Booking> {
	async findExpiryCandidateIds(limit: number): Promise<string[]> {
		const rows = (await this.query(
			`SELECT "id"
			 FROM "bookings"
			 WHERE "status" = 'pending_payment'
			   AND "payment_status" = 'unpaid'
			   AND "hold_expires_at" < CURRENT_TIMESTAMP
			 ORDER BY "hold_expires_at" ASC, "id" ASC
			 LIMIT $1`,
			[limit]
		)) as BookingExpiryCandidate[];
		return rows.map((row) => row.id);
	}

	findListByOwner(ownerId: string): Promise<BookingListItemResponseDto[]> {
		return this.query(
			`SELECT
				b."id",
				b."trip_id" AS "tripId",
				b."num_people" AS "numPeople",
				b."status",
				b."payment_status" AS "paymentStatus",
				b."hold_expires_at" AS "holdExpiresAt",
				b."trip_starts_at_snapshot" AS "tripStartsAtSnapshot",
				b."trip_ends_at_snapshot" AS "tripEndsAtSnapshot",
				b."total_amount"::text AS "totalAmount",
				b."created_at" AS "createdAt",
				CASE
					WHEN t."id" IS NULL OR r."id" IS NULL
						OR btrim(t."title") = '' OR btrim(r."name") = '' THEN NULL
					ELSE jsonb_build_object(
						'id', t."id",
						'currentTitle', t."title",
						'routeId', r."id",
						'currentRouteName', r."name"
					)
				END AS "tripPresentation"
			FROM "bookings" b
			LEFT JOIN "trips" t ON t."id" = b."trip_id"
			LEFT JOIN "trekking_routes" r ON r."id" = t."route_id"
			WHERE b."user_id" = $1
			ORDER BY b."created_at" DESC, b."id" DESC`,
			[ownerId]
		);
	}

	findOwnershipById(id: string): Promise<BookingOwnership | null> {
		return this.findOne({
			select: { id: true, userId: true },
			where: { id },
		});
	}

	async findDetailsByIdForOwner(
		id: string,
		ownerId: string
	): Promise<BookingDetailsResponseDto | null> {
		const rows = (await this.query(
			`SELECT
				b."id",
				b."trip_id" AS "tripId",
				b."user_id" AS "userId",
				b."num_people" AS "numPeople",
				b."status",
				b."payment_status" AS "paymentStatus",
				b."hold_expires_at" AS "holdExpiresAt",
				b."trip_starts_at_snapshot" AS "tripStartsAtSnapshot",
				b."trip_ends_at_snapshot" AS "tripEndsAtSnapshot",
				b."base_price" AS "basePrice",
				b."total_amount" AS "totalAmount",
				b."cancellation_policy_snapshot" AS "cancellationPolicySnapshot",
				b."created_at" AS "createdAt",
				CASE
					WHEN t."id" IS NULL OR r."id" IS NULL
						OR btrim(t."title") = '' OR btrim(r."name") = '' THEN NULL
					ELSE jsonb_build_object(
						'id', t."id",
						'currentTitle', t."title",
						'routeId', r."id",
						'currentRouteName', r."name"
					)
				END AS "tripPresentation",
				COALESCE(member_rows."members", '[]'::jsonb) AS "members",
				COALESCE(item_rows."equipmentItems", '[]'::jsonb) AS "equipmentItems"
			FROM "bookings" b
			LEFT JOIN "trips" t ON t."id" = b."trip_id"
			LEFT JOIN "trekking_routes" r ON r."id" = t."route_id"
			LEFT JOIN LATERAL (
				SELECT jsonb_agg(
					jsonb_build_object(
						'id', bm."id",
						'userId', bm."user_id",
						'email', u."email",
						'isPrimary', bm."is_primary",
						'memberStatus', bm."member_status",
						'createdAt', bm."created_at",
						'updatedAt', bm."updated_at"
					)
					ORDER BY bm."is_primary" DESC, bm."created_at" ASC, bm."id" ASC
				) AS "members"
				FROM "booking_members" bm
				LEFT JOIN "users" u ON u."id" = bm."user_id"
				WHERE bm."booking_id" = b."id"
			) member_rows ON TRUE
			LEFT JOIN LATERAL (
				SELECT jsonb_agg(
					jsonb_build_object(
						'id', bi."id",
						'itemType', bi."item_type",
						'equipmentCatalogItemId', bi."equipment_catalog_item_id",
						'quantity', bi."quantity",
						'unitPrice', bi."unit_price"::text,
						'rentalDays', bi."rental_days",
						'totalPrice', bi."total_price"::text,
						'createdAt', bi."created_at",
						'presentation', CASE
							WHEN eci."id" IS NULL OR btrim(eci."name") = '' THEN NULL
							ELSE jsonb_build_object('currentName', eci."name")
						END
					)
					ORDER BY bi."created_at" ASC, bi."id" ASC
				) AS "equipmentItems"
				FROM "booking_items" bi
				LEFT JOIN "equipment_catalog_items" eci
					ON eci."id" = bi."equipment_catalog_item_id"
				WHERE bi."booking_id" = b."id"
			) item_rows ON TRUE
			WHERE b."id" = $1 AND b."user_id" = $2`,
			[id, ownerId]
		)) as RawBookingDetails[];

		const row = rows[0];
		if (!row) return null;
		return {
			...row,
			members: row.members.map((member) => ({
				...member,
				createdAt: new Date(member.createdAt),
				updatedAt: new Date(member.updatedAt),
			})),
			equipmentItems: row.equipmentItems.map((item) => ({
				...item,
				createdAt: new Date(item.createdAt),
			})),
		};
	}

	async lockIdempotencyKey(userId: string, idempotencyKey: string): Promise<void> {
		await this.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
			`${userId}:${idempotencyKey}`,
		]);
	}

	findByIdempotencyKey(userId: string, idempotencyKey: string): Promise<Booking | null> {
		return this.findOne({ where: { userId, idempotencyKey } });
	}

	findForUpdate(id: string): Promise<Booking | null> {
		return this.createQueryBuilder("booking")
			.setLock("pessimistic_write")
			.where("booking.id = :id", { id })
			.getOne();
	}
}
