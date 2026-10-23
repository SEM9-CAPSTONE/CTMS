import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

configure({ asyncUtilTimeout: 5000 });

// RTL's automatic cleanup only self-registers when `afterEach` exists as a
// global (i.e. `globals: true`). This project keeps `globals: false` for
// explicit imports, so cleanup must be wired here instead.
afterEach(() => {
	cleanup();
});

// Reflect main.tsx's QueryClientProvider when rendering pages/layouts in isolation.
// Tests with their own wrapper still retain that wrapper and its inner query client.
vi.mock("@testing-library/react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@testing-library/react")>();
	const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
	const { createElement } = await import("react");
	return {
		...actual,
		render: (
			ui: Parameters<typeof actual.render>[0],
			options?: Parameters<typeof actual.render>[1]
		) => {
			const client = new QueryClient({
				defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
			});
			const OriginalWrapper = options?.wrapper;
			return actual.render(ui, {
				...options,
				wrapper: ({ children }) =>
					createElement(
						QueryClientProvider,
						{ client },
						OriginalWrapper ? createElement(OriginalWrapper, null, children) : children
					),
			});
		},
	};
});
