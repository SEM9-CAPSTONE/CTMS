import { Module } from "@nestjs/common";
import { DataSource } from "typeorm";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { VerificationOtp } from "./entities/verification-otp.entity";
import { VerificationOtpRepository } from "./verification-otp.repository";

@Module({
	imports: [UsersModule],
	controllers: [AuthController],
	providers: [
		AuthService,
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
