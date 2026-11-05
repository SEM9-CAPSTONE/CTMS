import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ReviewAnalysisController } from "./review-analysis.controller";
import { ReviewAnalysisProvider } from "./review-analysis.provider";
import { ReviewAnalysisQueue } from "./review-analysis.queue";
import { ReviewAnalysisRepository } from "./review-analysis.repository";
import { ReviewAnalysisService } from "./review-analysis.service";
import { ReviewAnalysisWorker } from "./review-analysis.worker";
@Module({
	controllers: [ReviewAnalysisController],
	providers: [
		ReviewAnalysisService,
		ReviewAnalysisRepository,
		ReviewAnalysisQueue,
		ReviewAnalysisProvider,
		ReviewAnalysisWorker,
		JwtAuthGuard,
		RolesGuard,
	],
})
export class ReviewAnalysisModule {}
