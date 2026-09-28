import type { EntityManager, SelectQueryBuilder } from "typeorm";
import { BookingItemsRepository } from "./booking-items.repository";
import { BookingItem } from "./entities/booking-item.entity";

describe("BookingItemsRepository", () => {
	describe("findByBooking", () => {
		it("filters by bookingId and orders oldest first", async () => {
			const query = {
				where: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue([]),
			};
			const repository = new BookingItemsRepository(BookingItem, {} as EntityManager);
			jest
				.spyOn(repository, "createQueryBuilder")
				.mockReturnValue(query as unknown as SelectQueryBuilder<BookingItem>);

			await expect(repository.findByBooking("booking-1")).resolves.toEqual([]);
			expect(query.where).toHaveBeenCalledWith("item.bookingId = :bookingId", {
				bookingId: "booking-1",
			});
			expect(query.orderBy).toHaveBeenCalledWith("item.createdAt", "ASC");
		});
	});

	describe("sumTotalPriceForBooking", () => {
		it("sums totalPrice for the booking, defaulting to 0", async () => {
			const query = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getRawOne: jest.fn().mockResolvedValue(null),
			};
			const repository = new BookingItemsRepository(BookingItem, {} as EntityManager);
			jest
				.spyOn(repository, "createQueryBuilder")
				.mockReturnValue(query as unknown as SelectQueryBuilder<BookingItem>);

			await expect(repository.sumTotalPriceForBooking("booking-1")).resolves.toBe("0");
			expect(query.select).toHaveBeenCalledWith("COALESCE(SUM(item.totalPrice), 0)", "sum");
			expect(query.where).toHaveBeenCalledWith("item.bookingId = :bookingId", {
				bookingId: "booking-1",
			});
		});

		it("returns the summed value when rows exist", async () => {
			const query = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getRawOne: jest.fn().mockResolvedValue({ sum: "250000.00" }),
			};
			const repository = new BookingItemsRepository(BookingItem, {} as EntityManager);
			jest
				.spyOn(repository, "createQueryBuilder")
				.mockReturnValue(query as unknown as SelectQueryBuilder<BookingItem>);

			await expect(repository.sumTotalPriceForBooking("booking-1")).resolves.toBe("250000.00");
		});
	});
});
