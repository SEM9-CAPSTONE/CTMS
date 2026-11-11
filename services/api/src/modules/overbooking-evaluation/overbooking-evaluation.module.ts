import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BookingsModule } from "../bookings/bookings.module";
import { OverbookingEvaluationReportEntity } from "./entities/overbooking-evaluation-report.entity";
import { OverbookingEvaluationController } from "./overbooking-evaluation.controller";
import { OverbookingEvaluationRepository } from "./overbooking-evaluation.repository";
import { OverbookingEvaluationService } from "./overbooking-evaluation.service";

@Module({
	imports: [TypeOrmModule.forFeature([OverbookingEvaluationReportEntity]), BookingsModule],
	controllers: [OverbookingEvaluationController],
	providers: [OverbookingEvaluationService, OverbookingEvaluationRepository],
	exports: [OverbookingEvaluationService, OverbookingEvaluationRepository],
})
export class OverbookingEvaluationModule {}
