import { Module } from "@nestjs/common";
import { TrekkingRoutesModule } from "../trekking-routes/trekking-routes.module";
import {
	AdminDangerZoneProposalsController,
	HostDangerZoneProposalsController,
} from "./danger-zone-proposals.controller";
import { DangerZoneProposalsRepository } from "./danger-zone-proposals.repository";
import { DangerZoneProposalsService } from "./danger-zone-proposals.service";
import { PorterDangerZoneProposalsController } from "./porter-danger-zone-proposals.controller";
import { PorterDangerZoneProposalsService } from "./porter-danger-zone-proposals.service";

/** Host and field-incident danger-zone proposals reviewed by an Admin before publication. */
@Module({
	imports: [TrekkingRoutesModule],
	controllers: [
		HostDangerZoneProposalsController,
		PorterDangerZoneProposalsController,
		AdminDangerZoneProposalsController,
	],
	providers: [
		DangerZoneProposalsRepository,
		DangerZoneProposalsService,
		PorterDangerZoneProposalsService,
	],
})
export class DangerZoneProposalsModule {}
