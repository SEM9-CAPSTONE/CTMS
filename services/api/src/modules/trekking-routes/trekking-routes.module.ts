import { Module } from "@nestjs/common";
import { DataSource } from "typeorm";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TrekkingRoutesController } from "./controllers/trekking-routes.controller";
import { TrekkingRoute } from "./entities/trekking-route.entity";
import { TrekkingRoutesRepository } from "./repositories/trekking-routes.repository";
import { TrekkingRoutesService } from "./services/trekking-routes.service";

@Module({
	controllers: [TrekkingRoutesController],
	providers: [
		TrekkingRoutesService,
		JwtAuthGuard,
		RolesGuard,
		{
			provide: TrekkingRoutesRepository,
			useFactory: (dataSource: DataSource) =>
				new TrekkingRoutesRepository(TrekkingRoute, dataSource.createEntityManager()),
			inject: [DataSource],
		},
	],
})
export class TrekkingRoutesModule {}
