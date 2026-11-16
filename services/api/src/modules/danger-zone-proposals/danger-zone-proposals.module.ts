import { Module } from "@nestjs/common";
import { TrekkingRoutesModule } from "../trekking-routes/trekking-routes.module";
import {
	AdminDangerZoneProposalsController,
	HostDangerZoneProposalsController,
} from "./danger-zone-proposals.controller";
import { DangerZoneProposalsRepository } from "./danger-zone-proposals.repository";
import { DangerZoneProposalsService } from "./danger-zone-proposals.service";

/** Host and field-incident danger-zone proposals reviewed by an Admin before publication. */
@Module({
	imports: [TrekkingRoutesModule],
	controllers: [HostDangerZoneProposalsController, AdminDangerZoneProposalsController],
	providers: [DangerZoneProposalsRepository, DangerZoneProposalsService],
})
export class DangerZoneProposalsModule {}
