import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { WeatherRiskRule } from "../weather/entities/weather-risk-rule.entity";
import { WeatherRiskEvaluationReportEntity } from "./entities/weather-risk-evaluation-report.entity";
import { WeatherRiskEvaluationController } from "./weather-risk-evaluation.controller";
import { WeatherRiskEvaluationRepository } from "./weather-risk-evaluation.repository";
import { WeatherRiskEvaluationService } from "./weather-risk-evaluation.service";

/** CTMS-099: compare Weather Risk results with manual assessment (Admin only). */
@Module({
	imports: [TypeOrmModule.forFeature([WeatherRiskEvaluationReportEntity, WeatherRiskRule])],
	controllers: [WeatherRiskEvaluationController],
	providers: [WeatherRiskEvaluationService, WeatherRiskEvaluationRepository],
	exports: [WeatherRiskEvaluationService],
})
export class WeatherRiskEvaluationModule {}
