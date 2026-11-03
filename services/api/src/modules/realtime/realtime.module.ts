import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { UsersModule } from "../users/users.module";
import { EventsGateway } from "./events.gateway";

@Module({
	imports: [
		UsersModule,
		// CTMS-079, BR-259: verify socket access tokens with the same secret as the HTTP JwtStrategy.
		JwtModule.registerAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => ({
				secret: configService.get<string>("JWT_SECRET"),
			}),
		}),
	],
	providers: [EventsGateway],
	exports: [EventsGateway],
})
export class RealtimeModule {}
