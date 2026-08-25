import { Module } from "@nestjs/common";
import { DataSource } from "typeorm";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TrekkingRoutesController } from "./controllers/trekking-routes.controller";
import { Checkpoint } from "./entities/checkpoint.entity";
import { TrekkingRoute } from "./entities/trekking-route.entity";
import { CheckpointsRepository } from "./repositories/checkpoints.repository";
import { TrekkingRoutesRepository } from "./repositories/trekking-routes.repository";
import { CheckpointsService } from "./services/checkpoints.service";
import { TrekkingRoutesService } from "./services/trekking-routes.service";

@Module({
	controllers: [TrekkingRoutesController],
	providers: [
		TrekkingRoutesService,
		CheckpointsService,
		JwtAuthGuard,
		RolesGuard,
		{
			provide: CheckpointsRepository,
			useFactory: (dataSource: DataSource) =>
				new CheckpointsRepository(Checkpoint, dataSource.createEntityManager()),
			inject: [DataSource],
		},
		{
			provide: TrekkingRoutesRepository,
			useFactory: (dataSource: DataSource) =>
				new TrekkingRoutesRepository(TrekkingRoute, dataSource.createEntityManager()),
			inject: [DataSource],
		},
	],
})
export class TrekkingRoutesModule {}
