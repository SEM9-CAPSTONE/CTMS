import setupIntegrationDatabase from "../setup-integration-database";
import "../setup-survival-source-policy";

const database = process.env.TEST_DATABASE_URL ?? "postgresql://ctms:ctms@127.0.0.1:5432/ctms_test";
if (!new URL(database).pathname.endsWith("_test"))
	throw new Error("CTMS50 browser tests require an isolated _test database");
Object.assign(process.env, {
	DATABASE_URL: database,
	TEST_DATABASE_URL: database,
	NODE_ENV: "test",
	JWT_SECRET: "ctms50-browser-test-secret",
	TRIP_STATUS_WORKER_ENABLED: "false",
	BOOKING_EXPIRY_WORKER_ENABLED: "false",
	TRIP_AUTO_CANCEL_WORKER_ENABLED: "false",
	PORTER_REQUEST_EXPIRY_WORKER_ENABLED: "false",
});
async function start() {
	await setupIntegrationDatabase();
	const { createSurvivalE2eApp } = require("../support/survival-e2e-app") as typeof import(
		"../support/survival-e2e-app"
	);
	const { app } = await createSurvivalE2eApp();
	await app.listen(3050, "127.0.0.1");
}
void start().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
