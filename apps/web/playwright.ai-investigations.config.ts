import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	testMatch: "ctms-344-ai-investigations.spec.ts",
	workers: 1,
	reporter: "list",
	outputDir: join(tmpdir(), "ctms-344-playwright"),
	use: { baseURL: "http://127.0.0.1:5188", viewport: { width: 1440, height: 900 } },
	webServer: {
		env: { VITE_API_BASE_URL: "http://localhost:3000/api" },
		command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5188 --strictPort",
		url: "http://127.0.0.1:5188",
		timeout: 15_000,
	},
});
