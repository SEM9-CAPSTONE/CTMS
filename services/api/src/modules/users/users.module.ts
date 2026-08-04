import { Module } from "@nestjs/common";
import { DataSource } from "typeorm";
import { User } from "./entities/user.entity";
import { UsersRepository } from "./users.repository";

@Module({
	providers: [
		{
			provide: UsersRepository,
			useFactory: (dataSource: DataSource) =>
				new UsersRepository(User, dataSource.createEntityManager()),
			inject: [DataSource],
		},
	],
	exports: [UsersRepository],
})
export class UsersModule {}
