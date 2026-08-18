import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "../shared/database/database.module";
import { AuthModule } from "./auth/auth.module";
import { CampsitesModule } from "./campsites/campsites.module";
import { HealthController } from "./health/health.controller";
import { ProfilesModule } from "./profiles/profiles.module";
import { EventsGateway } from "./realtime/events.gateway";
import { UsersModule } from "./users/users.module";

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: ["../../.env", ".env"],
		}),
		DatabaseModule,
		AuthModule,
		ProfilesModule,
		UsersModule,
		CampsitesModule,
	],
	controllers: [HealthController],
	providers: [EventsGateway],
})
export class AppModule {}
