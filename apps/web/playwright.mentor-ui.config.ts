import { defineConfig } from "@playwright/test";
export default defineConfig({
	testDir: "./tests/e2e",
	outputDir: "./test-results/mentor-ui-browser",
	testMatch: "mentor-ui-refinements.spec.ts",
	workers: 1,
	use: {
		ignoreHTTPSErrors: true,
		baseURL: "http://127.0.0.1:5180",
		viewport: { width: 1366, height: 768 },
	},
	webServer: {
		command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5180 --strictPort",
		url: "http://127.0.0.1:5180",
		reuseExistingServer: process.env.CTMS_UI_REUSE_SERVER === "1",
	},
});
