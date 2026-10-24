import { Module } from "@nestjs/common";
import { DataSource } from "typeorm";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PorterProfile } from "../profiles/entities/porter-profile.entity";
import { RealtimeModule } from "../realtime/realtime.module";
import { TripsController } from "./controllers/trips.controller";
import { CheckpointVisit } from "./entities/checkpoint-visit.entity";
import { PorterRequest } from "./entities/porter-request.entity";
import { Trip } from "./entities/trip.entity";
import { AvailablePortersRepository } from "./repositories/available-porters.repository";
import { CheckpointVisitsRepository } from "./repositories/checkpoint-visits.repository";
import { PorterRequestsRepository } from "./repositories/porter-requests.repository";
import { PorterScheduleConflictSource } from "./repositories/porter-schedule-conflict-source";
import { TripsRepository } from "./repositories/trips.repository";
import { AvailablePortersService } from "./services/available-porters.service";
import { CheckpointVisitsService } from "./services/checkpoint-visits.service";
import { PorterRequestExpiryWorker } from "./services/porter-request-expiry.worker";
import { PorterRequestsService } from "./services/porter-requests.service";
import { TripAutoCancelService } from "./services/trip-auto-cancel.service";
import { TripAutoCancelWorker } from "./services/trip-auto-cancel.worker";
import { TripReviewDeadlineService } from "./services/trip-review-deadline.service";
import { TripRouteMapService } from "./services/trip-route-map.service";
import { TripStatusScheduleService } from "./services/trip-status-schedule.service";
import { TripStatusScheduleWorker } from "./services/trip-status-schedule.worker";
import { TripsService } from "./services/trips.service";

@Module({
	imports: [RealtimeModule],
	controllers: [TripsController],
	providers: [
		TripRouteMapService,
		TripsService,
		AvailablePortersService,
		PorterRequestsService,
		PorterRequestExpiryWorker,
		PorterScheduleConflictSource,
		TripAutoCancelService,
		TripAutoCancelWorker,
		TripStatusScheduleService,
		TripStatusScheduleWorker,
		CheckpointVisitsService,
		{
			provide: TripReviewDeadlineService,
			useFactory: (tripsService: TripsService) => new TripReviewDeadlineService(tripsService),
			inject: [TripsService],
		},
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
		{
			provide: PorterRequestsRepository,
			useFactory: (dataSource: DataSource) =>
				new PorterRequestsRepository(PorterRequest, dataSource.createEntityManager()),
			inject: [DataSource],
		},
		{
			provide: CheckpointVisitsRepository,
			useFactory: (dataSource: DataSource) =>
				new CheckpointVisitsRepository(CheckpointVisit, dataSource.createEntityManager()),
			inject: [DataSource],
		},
	],
	exports: [TripsRepository, CheckpointVisitsRepository, CheckpointVisitsService],
})
export class TripsModule {}
