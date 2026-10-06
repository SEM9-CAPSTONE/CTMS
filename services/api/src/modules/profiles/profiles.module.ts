import { Module } from "@nestjs/common";
import { DataSource } from "typeorm";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TrekkingRoutesModule } from "../trekking-routes/trekking-routes.module";
import { UsersModule } from "../users/users.module";
import { CamperHealthProfileController } from "./controllers/camper-health-profile.controller";
import { PorterProfileController } from "./controllers/porter-profile.controller";
import { PorterRouteQualificationsController } from "./controllers/porter-route-qualifications.controller";
import { ProfilesController } from "./controllers/profiles.controller";
import { RoutePorterQualificationsController } from "./controllers/route-porter-qualifications.controller";
import { EmergencyContact } from "./entities/emergency-contact.entity";
import { HealthProfile } from "./entities/health-profile.entity";
import { PorterProfile } from "./entities/porter-profile.entity";
import { PorterRouteQualification } from "./entities/porter-route-qualification.entity";
import { EmergencyContactsRepository } from "./repositories/emergency-contacts.repository";
import { HealthProfileRepository } from "./repositories/health-profile.repository";
import { PorterProfilesRepository } from "./repositories/porter-profiles.repository";
import { PorterRouteQualificationsRepository } from "./repositories/porter-route-qualifications.repository";
import { CamperHealthProfileService } from "./services/camper-health-profile.service";
import { PorterProfilesService } from "./services/porter-profiles.service";
import { PorterRouteQualificationsService } from "./services/porter-route-qualifications.service";
import { ProfilesService } from "./services/profiles.service";

@Module({
	imports: [UsersModule, TrekkingRoutesModule],
	controllers: [
		ProfilesController,
		CamperHealthProfileController,
		PorterProfileController,
		PorterRouteQualificationsController,
		RoutePorterQualificationsController,
	],
	providers: [
		ProfilesService,
		CamperHealthProfileService,
		PorterProfilesService,
		PorterRouteQualificationsService,
		JwtAuthGuard,
		RolesGuard,
		{
			provide: PorterProfilesRepository,
			useFactory: (dataSource: DataSource) =>
				new PorterProfilesRepository(PorterProfile, dataSource.createEntityManager()),
			inject: [DataSource],
		},
		{
			provide: PorterRouteQualificationsRepository,
			useFactory: (dataSource: DataSource) =>
				new PorterRouteQualificationsRepository(
					PorterRouteQualification,
					dataSource.createEntityManager()
				),
			inject: [DataSource],
		},
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
	exports: [HealthProfileRepository, PorterRouteQualificationsService],
})
export class ProfilesModule {}
