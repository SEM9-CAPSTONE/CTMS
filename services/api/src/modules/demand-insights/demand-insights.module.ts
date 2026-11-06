import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { DemandInsightsController } from "./demand-insights.controller";
import { DemandInsightsProvider } from "./demand-insights.provider";
import { DemandInsightsRepository } from "./demand-insights.repository";
import { DemandInsightsService } from "./demand-insights.service";
import { DemandInsightsWorker } from "./demand-insights.worker";
@Module({
	controllers: [DemandInsightsController],
	providers: [
		DemandInsightsProvider,
		DemandInsightsRepository,
		DemandInsightsService,
		DemandInsightsWorker,
		JwtAuthGuard,
		RolesGuard,
	],
})
export class DemandInsightsModule {}
