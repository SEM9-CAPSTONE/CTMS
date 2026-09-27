import type { EntityManager, SelectQueryBuilder } from "typeorm";
import { Booking } from "../profiles/entities/booking.entity";
import { BookingsRepository } from "./bookings.repository";

describe("BookingsRepository", () => {
	describe("findForUpdate", () => {
		it("locks only the requested Booking row", async () => {
			const query = {
				setLock: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(null),
			};
			const repository = new BookingsRepository(Booking, {} as EntityManager);
			jest
				.spyOn(repository, "createQueryBuilder")
				.mockReturnValue(query as unknown as SelectQueryBuilder<Booking>);

			await expect(repository.findForUpdate("booking-1")).resolves.toBeNull();
			expect(query.setLock).toHaveBeenCalledWith("pessimistic_write");
			expect(query.where).toHaveBeenCalledWith("booking.id = :id", { id: "booking-1" });
		});
	});
});
