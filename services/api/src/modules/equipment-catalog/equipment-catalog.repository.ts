import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import type { EquipmentCatalogItem } from "./entities/equipment-catalog-item.entity";

@Injectable()
export class EquipmentCatalogRepository extends Repository<EquipmentCatalogItem> {
	findMineByHost(hostId: string): Promise<EquipmentCatalogItem[]> {
		return this.createQueryBuilder("item")
			.where("item.hostId = :hostId", { hostId })
			.orderBy("item.createdAt", "DESC")
			.addOrderBy("item.id", "DESC")
			.getMany();
	}

	findForUpdate(id: string): Promise<EquipmentCatalogItem | null> {
		return this.createQueryBuilder("item")
			.setLock("pessimistic_write")
			.where("item.id = :id", { id })
			.getOne();
	}
}
