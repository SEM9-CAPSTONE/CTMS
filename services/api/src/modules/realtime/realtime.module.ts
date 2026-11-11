import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { GpsTrackingModule } from "../gps-tracking/gps-tracking.module";
import { UsersModule } from "../users/users.module";
import { EventsGateway } from "./events.gateway";
import { RealtimeEventPruneWorker } from "./realtime-event-prune.worker";
import { RealtimeEventsRepository } from "./realtime-events.repository";
import { RealtimeEventsService } from "./realtime-events.service";

@Module({
	imports: [
		UsersModule,
		// CTMS-078: server-owned Trip relationships authorize Trip room membership.
		GpsTrackingModule,
		// CTMS-079, BR-259: verify socket access tokens with the same secret as the HTTP JwtStrategy.
		JwtModule.registerAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => ({
				secret: configService.get<string>("JWT_SECRET"),
			}),
		}),
	],
	// CTMS-082: protected events are stored for missed-event recovery after a reconnect.
	providers: [
		EventsGateway,
		RealtimeEventsRepository,
		RealtimeEventsService,
		RealtimeEventPruneWorker,
	],
	exports: [EventsGateway, RealtimeEventsService],
})
export class RealtimeModule {}
