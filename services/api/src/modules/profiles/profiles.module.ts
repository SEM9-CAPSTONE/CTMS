import { Module } from "@nestjs/common";
import { DataSource } from "typeorm";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UsersModule } from "../users/users.module";
import { EmergencyContactsRepository } from "./emergency-contacts.repository";
import { EmergencyContact } from "./entities/emergency-contact.entity";
import { ProfilesController } from "./profiles.controller";
import { ProfilesService } from "./profiles.service";

@Module({
	imports: [UsersModule],
	controllers: [ProfilesController],
	providers: [
		ProfilesService,
		JwtAuthGuard,
		{
			provide: EmergencyContactsRepository,
			useFactory: (dataSource: DataSource) =>
				new EmergencyContactsRepository(EmergencyContact, dataSource.createEntityManager()),
			inject: [DataSource],
		},
	],
})
export class ProfilesModule {}
