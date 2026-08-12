import { Module } from "@nestjs/common";
import { DataSource } from "typeorm";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { User } from "./entities/user.entity";
import { UsersController } from "./users.controller";
import { UsersRepository } from "./users.repository";
import { UsersService } from "./users.service";

@Module({
	controllers: [UsersController],
	providers: [
		UsersService,
		JwtAuthGuard,
		{
			provide: UsersRepository,
			useFactory: (dataSource: DataSource) =>
				new UsersRepository(User, dataSource.createEntityManager()),
			inject: [DataSource],
		},
	],
	exports: [UsersRepository, UsersService],
})
export class UsersModule {}
