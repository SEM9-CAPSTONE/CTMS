import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { LevelNotificationsService } from "./level-notifications.service";
import { LevelRequestFilesService } from "./level-request-files.service";
import {
	AdminLevelRequestsController,
	PorterLevelNotificationsController,
	PorterLevelRequestsController,
} from "./level-requests.controller";
import { LevelRequestsRepository } from "./level-requests.repository";
import { LevelRequestsService } from "./level-requests.service";
import {
	AdminPorterLevelsController,
	PorterLevelReviewController,
} from "./porter-levels.controller";
import { PorterLevelsRepository } from "./porter-levels.repository";
import { PorterLevelsService } from "./porter-levels.service";

@Module({
	controllers: [
		AdminPorterLevelsController,
		PorterLevelReviewController,
		AdminLevelRequestsController,
		PorterLevelRequestsController,
		PorterLevelNotificationsController,
	],
	providers: [
		PorterLevelsRepository,
		PorterLevelsService,
		LevelRequestsRepository,
		LevelRequestsService,
		LevelRequestFilesService,
		LevelNotificationsService,
		JwtAuthGuard,
		RolesGuard,
	],
})
export class PorterLevelsModule {}
