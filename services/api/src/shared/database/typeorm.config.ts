import type { DataSourceOptions } from "typeorm";

export const dataSourceOptions: DataSourceOptions = {
	type: "postgres",
	url: process.env.DATABASE_URL ?? "postgresql://ctms:ctms@localhost:5432/ctms",
	entities: [`${__dirname}/../../modules/**/*.entity{.ts,.js}`],
	migrations: [`${__dirname}/../../migrations/*{.ts,.js}`],
	synchronize: false,
	migrationsRun: true,
};
