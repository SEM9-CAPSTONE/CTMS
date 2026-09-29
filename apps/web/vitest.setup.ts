import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

configure({ asyncUtilTimeout: 5000 });

// RTL's automatic cleanup only self-registers when `afterEach` exists as a
// global (i.e. `globals: true`). This project keeps `globals: false` for
// explicit imports, so cleanup must be wired here instead.
afterEach(() => {
	cleanup();
});
