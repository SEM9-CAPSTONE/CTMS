import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { hash } from "bcrypt";
import { DataSource } from "typeorm";
import { assertSafeTestDatabase } from "./assert-safe-test-database";

export const sourceTestPassword = "Ctms50!FictionalTest";
export const sourceTestEmail = (role: string) => `${role}-ctms50-e2e@example.test`;
export async function createSurvivalE2eApp() {
	process.env.NODE_ENV = "test";
	process.env.SURVIVAL_DOCUMENT_STORAGE_ROOT = await mkdtemp(join(tmpdir(), "ctms50-e2e-"));
	const { AppModule } = require("../../src/modules/app.module") as typeof import(
		"../../src/modules/app.module"
	);
	const { validationExceptionFactory } =
		require("../../src/shared/pipes/validation-exception-factory") as typeof import(
			"../../src/shared/pipes/validation-exception-factory"
		);
	const app = await NestFactory.create(AppModule, { logger: ["error", "warn"] });
	app.setGlobalPrefix("api");
	app.enableCors();
	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true,
			exceptionFactory: validationExceptionFactory,
		})
	);
	await app.init();
	const db = app.get(DataSource);
	await assertSafeTestDatabase(db);
	const password = await hash(sourceTestPassword, 4);
	for (const role of ["admin", "camper", "host", "porter"]) {
		const rows: Array<{ id: string }> = await db.query(
			`INSERT INTO users(id,email,password_hash,role,status,full_name) VALUES($1,$2,$3,$4,'active','CTMS50 browser test') ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash RETURNING id`,
			[randomUUID(), sourceTestEmail(role), password, role]
		);
		await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,$2) ON CONFLICT DO NOTHING", [
			rows[0].id,
			role,
		]);
	}
	return { app, storageRoot: process.env.SURVIVAL_DOCUMENT_STORAGE_ROOT };
}
