import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	testMatch: "ctms-370-*.spec.ts",
	workers: 1,
	timeout: 60000,
	expect: { timeout: 15000 },
	use: {
		baseURL: "http://127.0.0.1:5190",
		screenshot: "only-on-failure",
		viewport: { width: 1440, height: 1200 },
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1200 } },
		},
	],
	webServer: {
		command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5190 --strictPort",
		url: "http://127.0.0.1:5190",
		reuseExistingServer: false,
		env: { VITE_MAPTILER_API_KEY: "" },
	},
});
