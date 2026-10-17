import { defineConfig, devices } from "@playwright/test";

const runsMockedCtms26Only = process.argv.some((arg) => /ctms-26/i.test(arg));

export default defineConfig({
	testDir: "./tests/e2e",
	// CTMS49 owns isolated API/database ports through its dedicated configuration.
	testIgnore: "**/ctms-49-report-trip-incident.spec.ts",
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
		...(runsMockedCtms26Only
			? []
			: [
					{
						command: "node node_modules/ts-node/dist/bin.js src/main.ts",
						cwd: "../../services/api",
						url: "http://localhost:3000/api/docs",
						reuseExistingServer: !process.env.CI,
						timeout: 120_000,
					},
				]),
		{
			command: "node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5174",
			url: "http://localhost:5174",
			reuseExistingServer: !process.env.CI,
			timeout: 30_000,
		},
	],
});
