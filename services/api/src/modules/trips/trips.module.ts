import { Module } from "@nestjs/common";
import { DataSource } from "typeorm";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { RealtimeModule } from "../realtime/realtime.module";
import { TripsController } from "./controllers/trips.controller";
import { Trip } from "./entities/trip.entity";
import { TripsRepository } from "./repositories/trips.repository";
import { TripReviewDeadlineService } from "./services/trip-review-deadline.service";
import { TripsService } from "./services/trips.service";

@Module({
	imports: [RealtimeModule],
	controllers: [TripsController],
	providers: [
		TripsService,
		TripReviewDeadlineService,
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
