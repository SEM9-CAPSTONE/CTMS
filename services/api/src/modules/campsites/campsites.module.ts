import { Module } from "@nestjs/common";
import { DataSource } from "typeorm";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CampsitesController } from "./controllers/campsites.controller";
import { Campsite } from "./entities/campsite.entity";
import { CampsitesRepository } from "./repositories/campsites.repository";
import { CampsitesService } from "./services/campsites.service";

@Module({
	controllers: [CampsitesController],
	providers: [
		CampsitesService,
		JwtAuthGuard,
		RolesGuard,
		{
			provide: CampsitesRepository,
			useFactory: (dataSource: DataSource) =>
				new CampsitesRepository(Campsite, dataSource.createEntityManager()),
			inject: [DataSource],
		},
	],
})
export class CampsitesModule {}
