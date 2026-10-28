import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	testMatch: "ctms-378-*.spec.ts",
	workers: 1,
	retries: 0,
	timeout: 60000,
	expect: { timeout: 15000 },
	reporter: "list",
	use: {
		baseURL: "http://127.0.0.1:5188",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: [
		{
			command: "node node_modules/ts-node/dist/bin.js test/e2e/start-host-overview-server.ts",
			cwd: "../../services/api",
			url: "http://127.0.0.1:3018/api/docs",
			reuseExistingServer: false,
			timeout: 120000,
		},
		{
			command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5188 --strictPort",
			url: "http://127.0.0.1:5188",
			reuseExistingServer: false,
			timeout: 30000,
			env: { VITE_API_BASE_URL: "http://127.0.0.1:3018/api", VITE_WS_URL: "http://127.0.0.1:3018" },
		},
	],
});
