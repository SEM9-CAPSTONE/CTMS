import type { EntityManager, SelectQueryBuilder } from "typeorm";
import { EquipmentReservation } from "./entities/equipment-reservation.entity";
import { EquipmentReservationsRepository } from "./equipment-reservations.repository";

describe("EquipmentReservationsRepository", () => {
	describe("sumOverlappingQuantity", () => {
		it("filters by equipment and overlapping date range, defaulting to 0", async () => {
			const query = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getRawOne: jest.fn().mockResolvedValue(null),
			};
			const repository = new EquipmentReservationsRepository(
				EquipmentReservation,
				{} as EntityManager
			);
			jest
				.spyOn(repository, "createQueryBuilder")
				.mockReturnValue(query as unknown as SelectQueryBuilder<EquipmentReservation>);

			await expect(
				repository.sumOverlappingQuantity("item-1", "2030-10-10", "2030-10-12")
			).resolves.toBe(0);
			expect(query.where).toHaveBeenCalledWith(
				"reservation.equipmentCatalogItemId = :equipmentCatalogItemId",
				{ equipmentCatalogItemId: "item-1" }
			);
			expect(query.andWhere).toHaveBeenCalledWith("reservation.rentalStartDate <= :rentalEndDate", {
				rentalEndDate: "2030-10-12",
			});
			expect(query.andWhere).toHaveBeenCalledWith("reservation.rentalEndDate >= :rentalStartDate", {
				rentalStartDate: "2030-10-10",
			});
		});

		it("returns the summed quantity when reservations overlap", async () => {
			const query = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getRawOne: jest.fn().mockResolvedValue({ sum: "3" }),
			};
			const repository = new EquipmentReservationsRepository(
				EquipmentReservation,
				{} as EntityManager
			);
			jest
				.spyOn(repository, "createQueryBuilder")
				.mockReturnValue(query as unknown as SelectQueryBuilder<EquipmentReservation>);

			await expect(
				repository.sumOverlappingQuantity("item-1", "2030-10-10", "2030-10-12")
			).resolves.toBe(3);
		});
	});
});
