import type { EntityManager, SelectQueryBuilder } from "typeorm";
import { EquipmentCatalogItem } from "./entities/equipment-catalog-item.entity";
import { EquipmentCatalogRepository } from "./equipment-catalog.repository";

describe("EquipmentCatalogRepository", () => {
	describe("findMineByHost", () => {
		it("filters by hostId and orders newest first", async () => {
			const query = {
				where: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue([]),
			};
			const repository = new EquipmentCatalogRepository(EquipmentCatalogItem, {} as EntityManager);
			jest
				.spyOn(repository, "createQueryBuilder")
				.mockReturnValue(query as unknown as SelectQueryBuilder<EquipmentCatalogItem>);

			await expect(repository.findMineByHost("host-1")).resolves.toEqual([]);
			expect(query.where).toHaveBeenCalledWith("item.hostId = :hostId", { hostId: "host-1" });
			expect(query.orderBy).toHaveBeenCalledWith("item.createdAt", "DESC");
			expect(query.addOrderBy).toHaveBeenCalledWith("item.id", "DESC");
		});
	});

	describe("findForUpdate", () => {
		it("locks only the requested item row", async () => {
			const query = {
				setLock: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(null),
			};
			const repository = new EquipmentCatalogRepository(EquipmentCatalogItem, {} as EntityManager);
			jest
				.spyOn(repository, "createQueryBuilder")
				.mockReturnValue(query as unknown as SelectQueryBuilder<EquipmentCatalogItem>);

			await expect(repository.findForUpdate("item-1")).resolves.toBeNull();
			expect(query.setLock).toHaveBeenCalledWith("pessimistic_write");
			expect(query.where).toHaveBeenCalledWith("item.id = :id", { id: "item-1" });
		});
	});
});
