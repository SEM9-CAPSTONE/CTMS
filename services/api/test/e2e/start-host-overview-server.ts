import setupIntegrationDatabase from "../setup-integration-database";

const database =
	process.env.TEST_DATABASE_URL ?? "postgresql://ctms:ctms@127.0.0.1:5432/ctms_378_test";
if (!new URL(database).pathname.endsWith("_test"))
	throw new Error("Host overview E2E requires a _test database");
Object.assign(process.env, {
	TEST_DATABASE_URL: database,
	DATABASE_URL: database,
	API_PORT: "3018",
	NODE_ENV: "test",
	JWT_SECRET: "ctms378-isolated-e2e-secret",
	TRIP_STATUS_WORKER_ENABLED: "false",
	BOOKING_EXPIRY_WORKER_ENABLED: "false",
	TRIP_AUTO_CANCEL_WORKER_ENABLED: "false",
	PORTER_REQUEST_EXPIRY_WORKER_ENABLED: "false",
});
async function start() {
	await setupIntegrationDatabase();
	await import("../../src/main");
}
void start().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
