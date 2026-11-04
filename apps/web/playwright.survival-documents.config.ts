import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
	testDir: "./tests/e2e",
	testMatch: "ctms-50-survival-documents.spec.ts",
	workers: 1,
	fullyParallel: false,
	retries: 0,
	timeout: 60000,
	expect: { timeout: 15000 },
	reporter: "list",
	use: {
		baseURL: "http://127.0.0.1:5150",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"], channel: process.env.PLAYWRIGHT_CHANNEL },
		},
	],
	webServer: [
		{
			command:
				"node node_modules/ts-node/dist/bin.js --transpile-only test/e2e/start-survival-documents-server.ts",
			cwd: "../../services/api",
			url: "http://127.0.0.1:3050/api/health",
			reuseExistingServer: false,
			timeout: 120000,
			env: {
				TEST_DATABASE_URL:
					process.env.TEST_DATABASE_URL ?? "postgresql://ctms:ctms@127.0.0.1:5432/ctms_test",
			},
		},
		{
			command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5150 --strictPort",
			url: "http://127.0.0.1:5150",
			reuseExistingServer: false,
			timeout: 30000,
			env: { VITE_API_BASE_URL: "http://127.0.0.1:3050/api", VITE_WS_URL: "http://127.0.0.1:3050" },
		},
	],
});
