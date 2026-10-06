import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import type { BookingMember } from "./entities/booking-member.entity";

export interface BookingMembersInitializationRecord {
	id: string;
	bookingId: string;
	actorId: string;
	idempotencyKey: string;
	requestFingerprint: string;
	createdAt: Date;
}

interface SaveInitializationInput {
	bookingId: string;
	actorId: string;
	idempotencyKey: string;
	requestFingerprint: string;
}

@Injectable()
export class BookingMembersRepository extends Repository<BookingMember> {
	async lockIdempotencyKey(
		bookingId: string,
		actorId: string,
		idempotencyKey: string
	): Promise<void> {
		await this.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
			`booking-members:${bookingId}:${actorId}:${idempotencyKey}`,
		]);
	}

	async findInitializationByKey(
		bookingId: string,
		actorId: string,
		idempotencyKey: string
	): Promise<BookingMembersInitializationRecord | null> {
		const rows = (await this.query(
			`SELECT
				"id",
				"booking_id" AS "bookingId",
				"actor_id" AS "actorId",
				"idempotency_key" AS "idempotencyKey",
				"request_fingerprint" AS "requestFingerprint",
				"created_at" AS "createdAt"
			 FROM "booking_member_initializations"
			 WHERE "booking_id" = $1 AND "actor_id" = $2 AND "idempotency_key" = $3`,
			[bookingId, actorId, idempotencyKey]
		)) as BookingMembersInitializationRecord[];
		return rows[0] ?? null;
	}

	async hasInitialization(bookingId: string): Promise<boolean> {
		const rows = (await this.query(
			`SELECT EXISTS(
				SELECT 1 FROM "booking_member_initializations" WHERE "booking_id" = $1
			) AS "exists"`,
			[bookingId]
		)) as Array<{ exists: boolean }>;
		return rows[0]?.exists ?? false;
	}

	async saveInitialization(input: SaveInitializationInput): Promise<void> {
		await this.query(
			`INSERT INTO "booking_member_initializations" (
				"booking_id", "actor_id", "idempotency_key", "request_fingerprint"
			) VALUES ($1, $2, $3, $4)`,
			[input.bookingId, input.actorId, input.idempotencyKey, input.requestFingerprint]
		);
	}

	findByBooking(bookingId: string): Promise<BookingMember[]> {
		return this.createQueryBuilder("member")
			.where("member.bookingId = :bookingId", { bookingId })
			.orderBy("member.isPrimary", "DESC")
			.addOrderBy("member.createdAt", "ASC")
			.addOrderBy("member.id", "ASC")
			.getMany();
	}

	findForUpdateInBooking(id: string, bookingId: string): Promise<BookingMember | null> {
		return this.createQueryBuilder("member")
			.setLock("pessimistic_write")
			.where("member.id = :id", { id })
			.andWhere("member.bookingId = :bookingId", { bookingId })
			.getOne();
	}
}
