import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RealtimeModule } from "../realtime/realtime.module";
import { RealtimeEvaluationReportEntity } from "./entities/realtime-evaluation-report.entity";
import { RealtimeLatencySampleEntity } from "./entities/realtime-latency-sample.entity";
import { RealtimeEvaluationController } from "./realtime-evaluation.controller";
import { RealtimeEvaluationHarness } from "./realtime-evaluation.harness";
import { RealtimeEvaluationRepository } from "./realtime-evaluation.repository";
import { RealtimeEvaluationService } from "./realtime-evaluation.service";

/** CTMS-100: real-time communication performance evaluation (Admin only). */
@Module({
	imports: [
		TypeOrmModule.forFeature([RealtimeEvaluationReportEntity, RealtimeLatencySampleEntity]),
		RealtimeModule,
		// Evaluation clients authenticate like any socket: tokens signed with the same secret.
		JwtModule.registerAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => ({
				secret: configService.get<string>("JWT_SECRET"),
			}),
		}),
	],
	controllers: [RealtimeEvaluationController],
	providers: [RealtimeEvaluationService, RealtimeEvaluationRepository, RealtimeEvaluationHarness],
})
export class RealtimeEvaluationModule {}
