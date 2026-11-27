import { defineConfig, devices } from "@playwright/test";

const productionServer = process.env.CTMS_WEB_TEST_URL;
// Build with deterministic browser settings; provider data is intercepted by the tests.
export default defineConfig({
	testDir: "./tests/e2e",
	testMatch: "route-code-splitting.spec.ts",
	workers: 1,
	reporter: "list",
	use: {
		...devices["Desktop Chrome"],
		channel: process.platform === "win32" ? "chrome" : undefined,
		baseURL: productionServer || "http://127.0.0.1:4175",
		launchOptions: process.env.CI
			? { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] }
			: undefined,
	},
	webServer: productionServer
		? undefined
		: {
				command:
					"node node_modules/vite/bin/vite.js build && node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4175 --strictPort",
				url: "http://127.0.0.1:4175",
				timeout: 120_000,
				env: {
					VITE_API_BASE_URL: "http://127.0.0.1:4175/api",
					VITE_MAPTILER_API_KEY: "build-check",
				},
			},
});
