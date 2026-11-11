import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	testMatch: "route-safety.spec.ts",
	workers: 1,
	retries: 0,
	reporter: "list",
	use: { baseURL: "http://127.0.0.1:5186", trace: "retain-on-failure" },
	projects: [
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				launchOptions: {
					executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
					args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
				},
			},
		},
	],
	webServer: {
		command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5186 --strictPort",
		url: "http://127.0.0.1:5186",
		reuseExistingServer: false,
		timeout: 30000,
		env: {
			VITE_MAPTILER_API_KEY: "route-safety-e2e",
			VITE_API_BASE_URL: "http://127.0.0.1:3199/api",
		},
	},
});
