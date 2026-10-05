import type { EntityManager, SelectQueryBuilder } from "typeorm";
import { Booking } from "../profiles/entities/booking.entity";
import { BookingsRepository } from "./bookings.repository";

describe("BookingsRepository", () => {
	it("finds bounded expiry candidate IDs in deterministic deadline order", async () => {
		const repository = new BookingsRepository(Booking, {} as EntityManager);
		const query = jest.spyOn(repository, "query").mockResolvedValue([{ id: "booking-1" }]);

		await expect(repository.findExpiryCandidateIds(25)).resolves.toEqual(["booking-1"]);
		const [sql, parameters] = query.mock.calls[0];
		expect(sql).toContain("\"status\" = 'pending_payment'");
		expect(sql).toContain("\"payment_status\" = 'unpaid'");
		expect(sql).toContain('"hold_expires_at" < CURRENT_TIMESTAMP');
		expect(sql).toContain('ORDER BY "hold_expires_at" ASC, "id" ASC');
		expect(sql).toContain("LIMIT $1");
		expect(parameters).toEqual([25]);
	});

	it("lists one owner's minimal Booking projections in deterministic newest-first order", async () => {
		const repository = new BookingsRepository(Booking, {} as EntityManager);
		const rows = [
			{
				id: "booking-2",
				tripId: "trip-1",
				numPeople: null,
				status: "completed",
				paymentStatus: null,
				holdExpiresAt: null,
				tripStartsAtSnapshot: null,
				tripEndsAtSnapshot: null,
				totalAmount: "120.00",
				createdAt: new Date("2030-01-02T00:00:00.000Z"),
				tripPresentation: null,
			},
		];
		const query = jest.spyOn(repository, "query").mockResolvedValue(rows);

		await expect(repository.findListByOwner("owner-1")).resolves.toBe(rows);
		const [sql, parameters] = query.mock.calls[0];
		expect(sql).toContain('WHERE b."user_id" = $1');
		expect(sql).toContain('b."total_amount"::text AS "totalAmount"');
		expect(sql).toContain('ORDER BY b."created_at" DESC, b."id" DESC');
		expect(sql).not.toContain("booking_members");
		expect(sql).not.toContain("booking_items");
		expect(parameters).toEqual(["owner-1"]);
	});

	it("loads only ownership fields before the aggregate read", async () => {
		const repository = new BookingsRepository(Booking, {} as EntityManager);
		const findOne = jest.spyOn(repository, "findOne").mockResolvedValue(null);

		await expect(repository.findOwnershipById("booking-1")).resolves.toBeNull();
		expect(findOne).toHaveBeenCalledWith({
			select: { id: true, userId: true },
			where: { id: "booking-1" },
		});
	});

	it("loads members, participant emails, equipment, and presentation in one aggregate query", async () => {
		const repository = new BookingsRepository(Booking, {} as EntityManager);
		const query = jest.spyOn(repository, "query").mockResolvedValue([
			{
				id: "booking-1",
				tripId: "trip-1",
				userId: "owner-1",
				numPeople: 2,
				status: "confirmed",
				paymentStatus: "not_required",
				holdExpiresAt: null,
				tripStartsAtSnapshot: new Date("2030-01-01T00:00:00.000Z"),
				tripEndsAtSnapshot: new Date("2030-01-02T00:00:00.000Z"),
				basePrice: "100.00",
				totalAmount: "120.00",
				cancellationPolicySnapshot: null,
				createdAt: new Date("2029-01-01T00:00:00.000Z"),
				tripPresentation: null,
				members: [
					{
						id: "member-1",
						userId: "owner-1",
						email: "owner@example.com",
						isPrimary: true,
						memberStatus: "registered",
						createdAt: "2029-01-01T00:00:00.000Z",
						updatedAt: "2029-01-01T00:00:00.000Z",
					},
				],
				equipmentItems: [
					{
						id: "item-1",
						itemType: "equipment",
						equipmentCatalogItemId: "equipment-1",
						quantity: 1,
						unitPrice: "20.00",
						rentalDays: 1,
						totalPrice: "20.00",
						createdAt: "2029-01-01T00:00:00.000Z",
						presentation: null,
					},
				],
			},
		]);

		const result = await repository.findDetailsByIdForOwner("booking-1", "owner-1");

		expect(result?.members[0].createdAt).toBeInstanceOf(Date);
		expect(result?.equipmentItems[0].createdAt).toBeInstanceOf(Date);
		expect(query).toHaveBeenCalledTimes(1);
		const [sql, parameters] = query.mock.calls[0];
		expect(sql).toContain("LEFT JOIN LATERAL");
		expect(sql).toContain('bi."unit_price"::text');
		expect(sql).toContain('bi."total_price"::text');
		expect(sql).toContain('b."id" = $1 AND b."user_id" = $2');
		expect(parameters).toEqual(["booking-1", "owner-1"]);
	});

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
