import { Module } from "@nestjs/common";
import { DataSource } from "typeorm";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PorterProfile } from "../profiles/entities/porter-profile.entity";
import { TripsController } from "./controllers/trips.controller";
import { Trip } from "./entities/trip.entity";
import { AvailablePortersRepository } from "./repositories/available-porters.repository";
import { PorterScheduleConflictSource } from "./repositories/porter-schedule-conflict-source";
import { TripsRepository } from "./repositories/trips.repository";
import { AvailablePortersService } from "./services/available-porters.service";
import { TripsService } from "./services/trips.service";

@Module({
	controllers: [TripsController],
	providers: [
		TripsService,
		AvailablePortersService,
		PorterScheduleConflictSource,
		JwtAuthGuard,
		RolesGuard,
		{
			provide: AvailablePortersRepository,
			useFactory: (dataSource: DataSource) =>
				new AvailablePortersRepository(PorterProfile, dataSource.createEntityManager()),
			inject: [DataSource],
		},
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
