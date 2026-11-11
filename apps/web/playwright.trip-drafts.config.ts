import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
	testDir: "./tests/e2e",
	testMatch: "ctms-28-trip-drafts.spec.ts",
	workers: 1,
	retries: 0,
	use: { baseURL: "http://127.0.0.1:5192", trace: "retain-on-failure" },
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: {
		command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5192 --strictPort",
		url: "http://127.0.0.1:5192",
		reuseExistingServer: !process.env.CI,
		timeout: 30000,
	},
});
