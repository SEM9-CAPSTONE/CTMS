import { BookingMembersRepository } from "./booking-members.repository";

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
});
