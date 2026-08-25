import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: "list",
	use: {
		baseURL: "http://localhost:5174",
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: [
		{
			command: "node node_modules/ts-node/dist/bin.js src/main.ts",
			cwd: "../../services/api",
			url: "http://localhost:3000/api/docs",
			reuseExistingServer: !process.env.CI,
			timeout: 60_000,
		},
		{
			command: "node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5174",
			url: "http://localhost:5174",
			reuseExistingServer: !process.env.CI,
			timeout: 30_000,
		},
	],
});
