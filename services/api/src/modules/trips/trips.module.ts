import { Module } from "@nestjs/common";
import { DataSource } from "typeorm";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TripsController } from "./controllers/trips.controller";
import { Trip } from "./entities/trip.entity";
import { TripsRepository } from "./repositories/trips.repository";
import { TripsService } from "./services/trips.service";

@Module({
	controllers: [TripsController],
	providers: [
		TripsService,
		JwtAuthGuard,
		RolesGuard,
		{
			provide: TripsRepository,
			useFactory: (dataSource: DataSource) =>
				new TripsRepository(Trip, dataSource.createEntityManager()),
			inject: [DataSource],
		},
	],
	exports: [TripsRepository],
})
export class TripsModule {}
