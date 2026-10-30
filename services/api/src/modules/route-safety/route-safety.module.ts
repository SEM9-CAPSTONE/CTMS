import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { NchmfSafetyService } from "./nchmf-safety.service";
import { OsmWaterService } from "./osm-water.service";
import { RouteSafetyController } from "./route-safety.controller";
import { RouteSafetyRepository } from "./route-safety.repository";
import { RouteSafetyService } from "./route-safety.service";
import { SafetyImportService } from "./safety-import.service";
import { VndmsSafetyService } from "./vndms-safety.service";

@Module({
	controllers: [RouteSafetyController],
	providers: [
		RouteSafetyRepository,
		RouteSafetyService,
		SafetyImportService,
		NchmfSafetyService,
		VndmsSafetyService,
		OsmWaterService,
		JwtAuthGuard,
		RolesGuard,
	],
})
export class RouteSafetyModule {}
