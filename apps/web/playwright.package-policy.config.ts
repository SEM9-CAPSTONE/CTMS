import { defineConfig, devices } from "@playwright/test";

// Requires the isolated API started by start-package-policy-server.ts.
export default defineConfig({
	testDir: "./tests/e2e",
	testMatch: "ctms-306-package-policy.spec.ts",
	workers: 1,
	retries: 0,
	reporter: "list",
	outputDir: "../../artifacts/ctms306-web-e2e",
	use: { baseURL: "http://127.0.0.1:5176", ...devices["Desktop Chrome"] },
	webServer: {
		command: "pnpm exec vite --host 127.0.0.1 --port 5176 --strictPort",
		url: "http://127.0.0.1:5176",
		env: { VITE_API_BASE_URL: process.env.CTMS306_API_URL ?? "http://127.0.0.1:3019/api" },
		reuseExistingServer: false,
	},
});
