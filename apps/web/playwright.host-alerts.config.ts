import { defineConfig } from "@playwright/test";
import hostMap from "./playwright.host-map.config";

export default defineConfig({
	...hostMap,
	testMatch: "ctms-374-*.spec.ts",
	use: { ...hostMap.use, baseURL: "http://localhost:5173" },
	webServer: undefined,
});
