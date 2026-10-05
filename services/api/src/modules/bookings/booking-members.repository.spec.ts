import type { SelectQueryBuilder } from "typeorm";
import { BookingMembersRepository } from "./booking-members.repository";
import type { BookingMember } from "./entities/booking-member.entity";

describe("BookingMembersRepository", () => {
	it("scopes the advisory lock to Booking, actor, and idempotency key", async () => {
		const repository = Object.create(
			BookingMembersRepository.prototype
		) as BookingMembersRepository;
		const query = jest.fn().mockResolvedValue([]);
		Object.assign(repository, { query });

		await repository.lockIdempotencyKey("booking-1", "actor-1", "key-1");

		expect(query).toHaveBeenCalledWith("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
			"booking-members:booking-1:actor-1:key-1",
		]);
	});

	it("locks a member only inside the requested Booking", async () => {
		const query = {
			setLock: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			getOne: jest.fn().mockResolvedValue(null),
		};
		const repository = Object.create(
			BookingMembersRepository.prototype
		) as BookingMembersRepository;
		jest
			.spyOn(repository, "createQueryBuilder")
			.mockReturnValue(query as unknown as SelectQueryBuilder<BookingMember>);

		await expect(repository.findForUpdateInBooking("member-1", "booking-1")).resolves.toBeNull();
		expect(query.setLock).toHaveBeenCalledWith("pessimistic_write");
		expect(query.where).toHaveBeenCalledWith("member.id = :id", { id: "member-1" });
		expect(query.andWhere).toHaveBeenCalledWith("member.bookingId = :bookingId", {
			bookingId: "booking-1",
		});
	});
});
