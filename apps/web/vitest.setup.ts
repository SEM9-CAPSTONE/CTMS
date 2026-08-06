import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// RTL's automatic cleanup only self-registers when `afterEach` exists as a
// global (i.e. `globals: true`). This project keeps `globals: false` for
// explicit imports, so cleanup must be wired here instead.
afterEach(() => {
	cleanup();
});
