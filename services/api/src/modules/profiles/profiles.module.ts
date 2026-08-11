import { Module } from "@nestjs/common";
import { DataSource } from "typeorm";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UsersModule } from "../users/users.module";
import { CamperHealthProfileController } from "./controllers/camper-health-profile.controller";
import { CamperHealthProfileService } from "./services/camper-health-profile.service";
import { EmergencyContactsRepository } from "./repositories/emergency-contacts.repository";
import { EmergencyContact } from "./entities/emergency-contact.entity";
import { HealthProfile } from "./entities/health-profile.entity";
import { HealthProfileRepository } from "./repositories/health-profile.repository";
import { ProfilesController } from "./controllers/profiles.controller";
import { ProfilesService } from "./services/profiles.service";

@Module({
	imports: [UsersModule],
	controllers: [ProfilesController, CamperHealthProfileController],
	providers: [
		ProfilesService,
		CamperHealthProfileService,
		JwtAuthGuard,
		{
			provide: EmergencyContactsRepository,
			useFactory: (dataSource: DataSource) =>
				new EmergencyContactsRepository(EmergencyContact, dataSource.createEntityManager()),
			inject: [DataSource],
		},
		{
			provide: HealthProfileRepository,
			useFactory: (dataSource: DataSource) =>
				new HealthProfileRepository(HealthProfile, dataSource.createEntityManager()),
			inject: [DataSource],
		},
	],
})
export class ProfilesModule {}
