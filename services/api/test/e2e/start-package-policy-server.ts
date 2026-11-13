/** Production HTTP modules with main-seed demo data in an isolated test DB only.
 * No CTMS-119 freshness override: the source stays unknown as in production. */
import "dotenv/config";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { DataSource } from "typeorm";
import setupDatabase from "../setup-integration-database";

const database =
	process.env.TEST_DATABASE_URL ?? "postgresql://ctms:ctms@127.0.0.1:5432/ctms306_host_review_test";
if (new URL(database).pathname !== "/ctms306_host_review_test")
	throw new Error("Requires isolated ctms306_host_review_test");
Object.assign(process.env, {
	TEST_DATABASE_URL: database,
	DATABASE_URL: database,
	NODE_ENV: "test",
	CTMS306_DEMO_SEED: "1",
	JWT_SECRET: "ctms306-isolated-ui-test-secret",
	REDIS_URL: "redis://127.0.0.1:6379/14",
	OFFLINE_PACKAGE_STORAGE_ROOT: resolve("../../artifacts/ctms306-http/packages"),
	OFFLINE_BASEMAP_STORAGE_ROOT: resolve("../../artifacts/ctms306-http/basemaps"),
	OFFLINE_PACKAGE_DEPARTURE_GATE_ENABLED: "false",
});
for (const key of [
	"OFFLINE_PACKAGE_WORKER_ENABLED",
	"KNOWLEDGE_WORKER_ENABLED",
	"REVIEW_ANALYSIS_WORKER_ENABLED",
	"DEMAND_WORKER_ENABLED",
	"TRIP_AUTO_CANCEL_WORKER_ENABLED",
	"BOOKING_EXPIRY_WORKER_ENABLED",
	"TRIP_STATUS_WORKER_ENABLED",
	"PORTER_REQUEST_EXPIRY_WORKER_ENABLED",
	"TRIP_WEATHER_MONITOR_WORKER_ENABLED",
	"TRIP_WEATHER_DECISION_WORKER_ENABLED",
	"REVIEW_MODERATION_WORKER_ENABLED",
	"ROUTE_SAFETY_LIVE_ENABLED",
	"ROUTE_SAFETY_WATER_ENABLED",
	"ROUTE_SAFETY_VNDMS_ENABLED",
	"REALTIME_EVENT_PRUNE_WORKER_ENABLED",
])
	process.env[key] = "false";

async function start(): Promise<void> {
	await setupDatabase();
	const { AppModule } = require("../../src/modules/app.module") as typeof import(
		"../../src/modules/app.module"
	);
	const app = await NestFactory.create(AppModule, { logger: ["error", "warn"] });
	app.setGlobalPrefix("api");
	app.enableCors();
	await app.init();
	const db = app.get(DataSource);
	const { assertSafeTestDatabase } =
		require("../support/assert-safe-test-database") as typeof import(
			"../support/assert-safe-test-database"
		);
	await assertSafeTestDatabase(db);
	const seed = require("../../src/seeds/main.seed") as typeof import("../../src/seeds/main.seed");
	await seed.seedDevAdmin();
	await seed.seedRouteRecoveryDemo(db, { screenshotRun: 6 });
	const tripId = "306de000-0000-4000-8000-000000000061";
	const [{ id: porterId }] = (await db.query(
		"SELECT id FROM users WHERE email='porter@ctms.local'"
	)) as Array<{ id: string }>;
	await db.query(
		"INSERT INTO trip_porters(trip_id,porter_id,status) VALUES($1,$2,'assigned') ON CONFLICT(trip_id,porter_id) DO UPDATE SET status='assigned'",
		[tripId, porterId]
	);
	const [{ id: packageId }] = (await db.query(
		"SELECT id FROM offline_packages WHERE trip_id=$1 ORDER BY package_version DESC LIMIT 1",
		[tripId]
	)) as Array<{ id: string }>;
	const { PackageActivationService } =
		require("../../src/modules/offline-packages/package-activation.service") as typeof import(
			"../../src/modules/offline-packages/package-activation.service"
		);
	const policy = app.get(PackageActivationService);
	await db.transaction(async (manager) => {
		await policy.requirePackage(manager, tripId, packageId);
		await manager.query("SELECT id FROM trips WHERE id=$1 FOR UPDATE", [tripId]);
		await policy.assertDepartureReady(manager, tripId);
	});
	app
		.getHttpAdapter()
		.get("/__ctms306_ready", (_req: unknown, res: { json: (body: unknown) => void }) =>
			res.json({ fixture: true, tripId })
		);
	await app.listen(3019, "127.0.0.1");
	console.log(
		"CTMS-306 fixture HTTP API ready on 3019; test DB only, source freshness UNKNOWN, not the official package pipeline."
	);
}
void start().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
