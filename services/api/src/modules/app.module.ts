import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./health/health.controller";
import { EventsGateway } from "./realtime/events.gateway";

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
		}),
	],
	controllers: [HealthController],
	providers: [EventsGateway],
})
export class AppModule {}
