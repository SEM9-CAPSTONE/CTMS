import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { DemandInsightsController } from "./demand-insights.controller";
import { DemandInsightsProvider } from "./demand-insights.provider";
import { DemandInsightsRepository } from "./demand-insights.repository";
import { DemandInsightsService } from "./demand-insights.service";
import { DemandInsightsWorker } from "./demand-insights.worker";
import { PlanningCatalog } from "./planning/planning.catalog";
import { PlanningController } from "./planning/planning.controller";
import { PlanningProvider } from "./planning/planning.provider";
import { PlanningService } from "./planning/planning.service";
import { PlanningWorker } from "./planning/planning.worker";
@Module({
	controllers: [PlanningController, DemandInsightsController],
	providers: [
		PlanningCatalog,
		PlanningProvider,
		PlanningService,
		PlanningWorker,
		DemandInsightsProvider,
		DemandInsightsRepository,
		DemandInsightsService,
		DemandInsightsWorker,
		JwtAuthGuard,
		RolesGuard,
	],
})
export class DemandInsightsModule {}
