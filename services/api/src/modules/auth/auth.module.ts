import { Module } from "@nestjs/common";
import { DataSource } from "typeorm";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { VerificationOtp } from "./entities/verification-otp.entity";
import { OtpDeliveryService } from "./otp-delivery.service";
import { EmailOtpProvider } from "./providers/email-otp.provider";
import {
	EMAIL_OTP_PROVIDER,
	SMS_OTP_PROVIDER,
} from "./providers/otp-notification-provider.interface";
import { SmsOtpProvider } from "./providers/sms-otp.provider";
import { VerificationOtpRepository } from "./verification-otp.repository";

@Module({
	imports: [UsersModule],
	controllers: [AuthController],
	providers: [
		AuthService,
		OtpDeliveryService,
		{ provide: SMS_OTP_PROVIDER, useClass: SmsOtpProvider },
		{ provide: EMAIL_OTP_PROVIDER, useClass: EmailOtpProvider },
		{
			provide: VerificationOtpRepository,
			useFactory: (dataSource: DataSource) =>
				new VerificationOtpRepository(VerificationOtp, dataSource.createEntityManager()),
			inject: [DataSource],
		},
	],
	exports: [AuthService],
})
export class AuthModule {}
