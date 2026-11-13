import { Module } from "@nestjs/common";
import { ProfilesModule } from "../profiles/profiles.module";
import { AdminModerationController } from "./admin-moderation.controller";
import { AdminModerationService } from "./admin-moderation.service";

@Module({
	imports: [ProfilesModule],
	controllers: [AdminModerationController],
	providers: [AdminModerationService],
})
export class AdminModerationModule {}
