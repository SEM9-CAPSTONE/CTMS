import type { EntityManager, SelectQueryBuilder } from "typeorm";
import { Payment } from "./entities/payment.entity";
import { PaymentsRepository } from "./payments.repository";

describe("PaymentsRepository", () => {
	describe("lockIdempotencyKey", () => {
		it("hashes the booking and idempotency key scope for advisory transaction lock", async () => {
			const repository = new PaymentsRepository(Payment, {} as EntityManager);
			const querySpy = jest.spyOn(repository, "query").mockResolvedValue(undefined);

			await repository.lockIdempotencyKey("booking-1", "pay-key-1");

			expect(querySpy).toHaveBeenCalledWith(
				"SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
				["payment:booking-1:pay-key-1"]
			);
		});
	});

	describe("findByIdempotencyKey", () => {
		it("finds payment by bookingId and idempotencyKey", async () => {
			const repository = new PaymentsRepository(Payment, {} as EntityManager);
			const findOneSpy = jest.spyOn(repository, "findOne").mockResolvedValue(null);

			await expect(repository.findByIdempotencyKey("booking-1", "pay-key-1")).resolves.toBeNull();

			expect(findOneSpy).toHaveBeenCalledWith({
				where: { bookingId: "booking-1", idempotencyKey: "pay-key-1" },
			});
		});
	});

	describe("findForUpdate", () => {
		it("acquires pessimistic write lock on the requested Payment row", async () => {
			const query = {
				setLock: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(null),
			};
			const repository = new PaymentsRepository(Payment, {} as EntityManager);
			jest
				.spyOn(repository, "createQueryBuilder")
				.mockReturnValue(query as unknown as SelectQueryBuilder<Payment>);

			await expect(repository.findForUpdate("payment-1")).resolves.toBeNull();
			expect(query.setLock).toHaveBeenCalledWith("pessimistic_write");
			expect(query.where).toHaveBeenCalledWith("payment.id = :id", { id: "payment-1" });
		});
	});
});
