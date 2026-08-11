import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "../shared/database/database.module";
import { AuthModule } from "./auth/auth.module";
import { HealthController } from "./health/health.controller";
import { ProfilesModule } from "./profiles/profiles.module";
import { EventsGateway } from "./realtime/events.gateway";

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: ["../../.env", ".env"],
		}),
		DatabaseModule,
		AuthModule,
		ProfilesModule,
	],
	controllers: [HealthController],
	providers: [EventsGateway],
})
export class AppModule {}
