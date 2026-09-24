import { Module } from "@nestjs/common";
import { DataSource } from "typeorm";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { EquipmentCatalogItem } from "./entities/equipment-catalog-item.entity";
import { EquipmentCatalogController } from "./equipment-catalog.controller";
import { EquipmentCatalogRepository } from "./equipment-catalog.repository";
import { EquipmentCatalogService } from "./equipment-catalog.service";

@Module({
	controllers: [EquipmentCatalogController],
	providers: [
		EquipmentCatalogService,
		JwtAuthGuard,
		RolesGuard,
		{
			provide: EquipmentCatalogRepository,
			useFactory: (dataSource: DataSource) =>
				new EquipmentCatalogRepository(EquipmentCatalogItem, dataSource.createEntityManager()),
			inject: [DataSource],
		},
	],
})
export class EquipmentCatalogModule {}
