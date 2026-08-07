import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "../shared/database/database.module";
import { AuthModule } from "./auth/auth.module";
import { HealthController } from "./health/health.controller";
import { EventsGateway } from "./realtime/events.gateway";

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
		}),
		DatabaseModule,
		AuthModule,
	],
	controllers: [HealthController],
	providers: [EventsGateway],
})
export class AppModule {}
