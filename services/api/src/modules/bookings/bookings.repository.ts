import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import type { Booking } from "../profiles/entities/booking.entity";

@Injectable()
export class BookingsRepository extends Repository<Booking> {
	async lockIdempotencyKey(userId: string, idempotencyKey: string): Promise<void> {
		await this.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
			`${userId}:${idempotencyKey}`,
		]);
	}

	findByIdempotencyKey(userId: string, idempotencyKey: string): Promise<Booking | null> {
		return this.findOne({ where: { userId, idempotencyKey } });
	}
}
