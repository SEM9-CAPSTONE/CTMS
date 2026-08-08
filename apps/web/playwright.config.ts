import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: true,
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
	webServer: {
		command: "pnpm exec vite --host 0.0.0.0 --port 5174",
		url: "http://localhost:5174",
		reuseExistingServer: !process.env.CI,
		timeout: 30_000,
	},
});
