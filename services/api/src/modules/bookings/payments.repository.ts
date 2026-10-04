import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import type { Payment } from "./entities/payment.entity";

/**
 * CTMS-032-T01. Repository for the `payments` table.
 *
 * Advisory lock scope: `payment:{bookingId}:{idempotencyKey}` so concurrent
 * pay requests for the same booking are serialised without blocking other
 * bookings (BR-179).
 */
@Injectable()
export class PaymentsRepository extends Repository<Payment> {
	findByBookingForUpdate(bookingId: string): Promise<Payment[]> {
		return this.createQueryBuilder("payment")
			.where("payment.bookingId = :bookingId", { bookingId })
			.orderBy("payment.id", "ASC")
			.setLock("pessimistic_write")
			.getMany();
	}

	/**
	 * Acquires a transaction-scoped advisory lock so that concurrent pay
	 * requests carrying the same (bookingId, idempotencyKey) are serialised
	 * (BR-178, BR-179). Must be called inside an active transaction.
	 */
	async lockIdempotencyKey(bookingId: string, idempotencyKey: string): Promise<void> {
		await this.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
			`payment:${bookingId}:${idempotencyKey}`,
		]);
	}

	/** Returns an existing Payment for idempotency replay (BR-178). */
	findByIdempotencyKey(bookingId: string, idempotencyKey: string): Promise<Payment | null> {
		return this.findOne({ where: { bookingId, idempotencyKey } });
	}

	/** Pessimistic write lock on a Payment row for concurrent-update protection (BR-179). */
	findForUpdate(id: string): Promise<Payment | null> {
		return this.createQueryBuilder("payment")
			.setLock("pessimistic_write")
			.where("payment.id = :id", { id })
			.getOne();
	}
}
