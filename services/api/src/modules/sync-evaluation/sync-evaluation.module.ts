import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { GpsTrackingModule } from "../gps-tracking/gps-tracking.module";
import { SafetyEventsModule } from "../safety-events/safety-events.module";
import { TripsModule } from "../trips/trips.module";
import { UsersModule } from "../users/users.module";
import { SyncEvaluationReportEntity } from "./entities/sync-evaluation-report.entity";
import { SyncEvaluationController } from "./sync-evaluation.controller";
import { SyncEvaluationRepository } from "./sync-evaluation.repository";
import { SyncEvaluationService } from "./sync-evaluation.service";

@Module({
	imports: [
		TypeOrmModule.forFeature([SyncEvaluationReportEntity]),
		GpsTrackingModule,
		SafetyEventsModule,
		TripsModule,
		UsersModule,
	],
	controllers: [SyncEvaluationController],
	providers: [SyncEvaluationService, SyncEvaluationRepository],
	exports: [SyncEvaluationService],
})
export class SyncEvaluationModule {}
