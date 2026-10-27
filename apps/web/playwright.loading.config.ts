import { defineConfig, devices } from "@playwright/test";

// Run against production output: build first to verify actual chunk requests.
export default defineConfig({
	testDir: "./tests/e2e",
	testMatch: "route-code-splitting.spec.ts",
	workers: 1,
	reporter: "list",
	use: {
		...devices["Desktop Chrome"],
		channel: "chrome",
		baseURL: "http://127.0.0.1:4175",
	},
	webServer: {
		command: "node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4175 --strictPort",
		url: "http://127.0.0.1:4175",
		timeout: 30_000,
	},
});
