import { resolve } from "node:path";
import setupIntegrationDatabase from "../setup-integration-database";

// Always isolate this suite from development data, including when .env exists.
const database = process.env.TEST_DATABASE_URL ?? "postgresql://ctms:ctms@127.0.0.1:5432/ctms_test";
if (!new URL(database).pathname.endsWith("_test"))
	throw new Error("Incident E2E requires a database ending in _test");
Object.assign(process.env, {
	TEST_DATABASE_URL: database,
	DATABASE_URL: database,
	API_PORT: "3002",
	NODE_ENV: "test",
	JWT_SECRET: "ctms49-isolated-e2e-secret",
	UPLOAD_ROOT: resolve(__dirname, "../../uploads/e2e-incidents"),
	TRIP_STATUS_WORKER_ENABLED: "false",
	BOOKING_EXPIRY_WORKER_ENABLED: "false",
	TRIP_AUTO_CANCEL_WORKER_ENABLED: "false",
	PORTER_REQUEST_EXPIRY_WORKER_ENABLED: "false",
});

async function start(): Promise<void> {
	await setupIntegrationDatabase();
	await import("../../src/main");
}
void start().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
