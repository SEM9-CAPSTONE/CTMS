import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import type { BookingItem } from "./entities/booking-item.entity";

@Injectable()
export class BookingItemsRepository extends Repository<BookingItem> {
	async lockIdempotencyKey(bookingId: string, idempotencyKey: string): Promise<void> {
		await this.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
			`booking-item:${bookingId}:${idempotencyKey}`,
		]);
	}

	findByIdempotencyKey(bookingId: string, idempotencyKey: string): Promise<BookingItem | null> {
		return this.findOne({ where: { bookingId, idempotencyKey } });
	}

	findByBooking(bookingId: string): Promise<BookingItem[]> {
		return this.createQueryBuilder("item")
			.where("item.bookingId = :bookingId", { bookingId })
			.orderBy("item.createdAt", "ASC")
			.getMany();
	}

	sumTotalPriceForBooking(bookingId: string): Promise<string> {
		return this.createQueryBuilder("item")
			.select("COALESCE(SUM(item.totalPrice), 0)", "sum")
			.where("item.bookingId = :bookingId", { bookingId })
			.getRawOne<{ sum: string }>()
			.then((row) => row?.sum ?? "0");
	}
}
