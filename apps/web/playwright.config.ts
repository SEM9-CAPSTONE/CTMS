import { defineConfig, devices } from "@playwright/test";

const runsMockedCtms26Only = process.argv.some((arg) => /ctms-26/i.test(arg));

export default defineConfig({
	testDir: "./tests/e2e",
	// CTMS49 owns isolated API/database ports through its dedicated configuration.
	testIgnore: [
		"**/ctms-306-package-policy.spec.ts",
		"**/ctms-412-review-analysis.spec.ts",
		"**/ctms-50-survival-documents.spec.ts",
		"**/ctms-49-report-trip-incident.spec.ts",
		"**/ctms-378-*.spec.ts",
		"**/ctms-79-t02-receive-real-time-sos-alerts.spec.ts",
		"**/ctms-78-t02-authenticated-websocket.spec.ts",
		"**/ctms-63-t02-behind-schedule-warning.spec.ts",
		"**/ctms-66-t02-member-last-locations.spec.ts",
		"**/ctms-81-t02-broadcast-emergency-alert.spec.ts",
		"**/ctms-82-t02-reconnect-websocket.spec.ts",
		"**/route-code-splitting.spec.ts",
	],
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
