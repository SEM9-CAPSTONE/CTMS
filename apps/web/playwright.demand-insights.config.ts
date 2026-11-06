import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";
export default defineConfig({
	testDir: "./tests/e2e",
	testMatch: "ctms-416-demand-insights.spec.ts",
	workers: 1,
	retries: 0,
	reporter: "list",
	timeout: 30000,
	outputDir: join(tmpdir(), "ctms-416-playwright"),
	use: {
		baseURL: "http://127.0.0.1:5197",
		trace: "off",
		screenshot: "off",
		viewport: { width: 1440, height: 1000 },
	},
	webServer: {
		env: { VITE_API_BASE_URL: "http://localhost:3000/api" },
		command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5197",
		url: "http://127.0.0.1:5197",
		reuseExistingServer: false,
		timeout: 60000,
	},
});
