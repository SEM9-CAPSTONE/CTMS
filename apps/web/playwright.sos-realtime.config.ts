import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	testMatch: [
		"ctms-79-t02-receive-real-time-sos-alerts.spec.ts",
		"ctms-78-t02-authenticated-websocket.spec.ts",
	],
	workers: 1,
	fullyParallel: false,
	retries: 0,
	timeout: 90_000,
	expect: { timeout: 15_000 },
	reporter: "list",
	use: {
		baseURL: "http://127.0.0.1:5189",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: [
		{
			command: "node node_modules/ts-node/dist/bin.js test/e2e/start-sos-realtime-server.ts",
			cwd: "../../services/api",
			url: "http://127.0.0.1:3019/api/docs",
			reuseExistingServer: false,
			timeout: 120_000,
		},
		{
			command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5189 --strictPort",
			url: "http://127.0.0.1:5189",
			reuseExistingServer: false,
			timeout: 30_000,
			env: { VITE_API_BASE_URL: "http://127.0.0.1:3019/api" },
		},
	],
});
