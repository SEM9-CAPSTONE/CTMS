import { defineConfig, devices } from "@playwright/test";

const databaseUrl =
	process.env.TEST_DATABASE_URL ?? "postgresql://ctms:ctms@127.0.0.1:5432/ctms_mentor_e2e_test";
if (!new URL(databaseUrl).pathname.endsWith("_test"))
	throw new Error("Mentor E2E requires an isolated _test database");
process.env.DATABASE_URL = databaseUrl;
process.env.CTMS_E2E_API_BASE_URL = "http://127.0.0.1:3012/api";

export default defineConfig({
	testDir: "./tests/e2e",
	outputDir: "./test-results/mentor-browser",
	testMatch: "mentor-booking-review.spec.ts",
	workers: 1,
	retries: 0,
	timeout: 120_000,
	use: {
		baseURL: "http://127.0.0.1:5176",
		screenshot: "only-on-failure",
		trace: "retain-on-failure",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: [
		{
			command: "node node_modules/ts-node/dist/bin.js src/main.ts",
			cwd: "../../services/api",
			url: "http://127.0.0.1:3012/api/docs",
			timeout: 120_000,
			env: {
				DATABASE_URL: databaseUrl,
				API_PORT: "3012",
				NODE_ENV: "test",
				TRIP_STATUS_WORKER_ENABLED: "false",
				JWT_SECRET: "mentor-e2e-test-secret",
				BOOKING_HOLD_TTL_MINUTES: "120",
			},
		},
		{
			command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5176",
			url: "http://127.0.0.1:5176",
			timeout: 60_000,
			env: { VITE_API_BASE_URL: "http://127.0.0.1:3012/api" },
		},
	],
});
