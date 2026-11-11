import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	testMatch: "ctms-49-report-trip-incident.spec.ts",
	workers: 1,
	fullyParallel: false,
	retries: 0,
	timeout: 90_000,
	expect: { timeout: 20_000 },
	reporter: "list",
	use: {
		baseURL: "http://127.0.0.1:5175",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				permissions: ["geolocation"],
				geolocation: {
					latitude: 16.054321,
					longitude: 108.234567,
					accuracy: 9,
				},
			},
		},
	],
	webServer: [
		{
			command: "node node_modules/ts-node/dist/bin.js test/e2e/start-incidents-server.ts",
			cwd: "../../services/api",
			url: "http://127.0.0.1:3002/api/docs",
			reuseExistingServer: false,
			timeout: 120_000,
		},
		{
			command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5175 --strictPort",
			url: "http://127.0.0.1:5175",
			reuseExistingServer: false,
			timeout: 30_000,
			env: {
				VITE_API_BASE_URL: "http://127.0.0.1:3002/api",
				VITE_WS_URL: "http://127.0.0.1:3002",
			},
		},
	],
});
