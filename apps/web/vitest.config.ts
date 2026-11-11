import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		// Match the Windows pool used by the verified local validation run.
		pool: process.platform === "win32" ? "threads" : "forks",
		reporters: process.platform === "win32" ? ["verbose"] : ["default"],
		environment: "jsdom",
		setupFiles: ["./vitest.setup.ts"],
		// Playwright E2E specs (tests/e2e/*.spec.ts, added in Bước 6.4) use a
		// different `test`/`expect` API and must not be picked up by Vitest,
		// which also matches *.spec.ts by default.
		exclude: [...configDefaults.exclude, "tests/e2e/**"],
		maxWorkers: 1,
		testTimeout: 15_000,
	},
});
