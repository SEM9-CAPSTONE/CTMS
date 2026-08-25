import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		environment: "jsdom",
		setupFiles: ["./vitest.setup.ts"],
		// Playwright E2E specs (tests/e2e/*.spec.ts, added in Bước 6.4) use a
		// different `test`/`expect` API and must not be picked up by Vitest,
		// which also matches *.spec.ts by default.
		exclude: [...configDefaults.exclude, "tests/e2e/**"],
		maxWorkers: 1,
		isolate: false,
	},
});
