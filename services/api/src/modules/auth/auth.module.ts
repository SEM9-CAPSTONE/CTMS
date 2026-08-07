import { Module } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import type ms from "ms";
import { DataSource } from "typeorm";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { RefreshToken } from "./entities/refresh-token.entity";
import { VerificationOtp } from "./entities/verification-otp.entity";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { JwtStrategy } from "./jwt.strategy";
import { OtpDeliveryService } from "./otp-delivery.service";
import { EmailOtpProvider } from "./providers/email-otp.provider";
import {
	EMAIL_OTP_PROVIDER,
	SMS_OTP_PROVIDER,
} from "./providers/otp-notification-provider.interface";
import { SmsOtpProvider } from "./providers/sms-otp.provider";
import { RefreshTokenRepository } from "./refresh-token.repository";
import { VerificationOtpRepository } from "./verification-otp.repository";

@Module({
	imports: [
		UsersModule,
		PassportModule,
		JwtModule.registerAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => ({
				secret: configService.get<string>("JWT_SECRET"),
				signOptions: {
					// Cast: runtime-configured (env) duration string, can't be checked
					// against jsonwebtoken's compile-time-only StringValue template type.
					expiresIn: (configService.get<string>("JWT_ACCESS_TOKEN_TTL") ?? "15m") as ms.StringValue,
				},
			}),
		}),
	],
	controllers: [AuthController],
	providers: [
		AuthService,
		OtpDeliveryService,
		{ provide: SMS_OTP_PROVIDER, useClass: SmsOtpProvider },
		{ provide: EMAIL_OTP_PROVIDER, useClass: EmailOtpProvider },
		JwtStrategy,
		JwtAuthGuard,
		{
			provide: VerificationOtpRepository,
			useFactory: (dataSource: DataSource) =>
				new VerificationOtpRepository(VerificationOtp, dataSource.createEntityManager()),
			inject: [DataSource],
		},
		{
			provide: RefreshTokenRepository,
			useFactory: (dataSource: DataSource) =>
				new RefreshTokenRepository(RefreshToken, dataSource.createEntityManager()),
			inject: [DataSource],
		},
	],
	exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
