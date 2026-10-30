import type { PropsWithChildren, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	CreatedTrekkingRoute,
	PaginatedTrekkingRoutesResponse,
	RouteListFilters,
	RouteStatusFilter,
} from "../types";

let library: typeof import("@testing-library/react");
let module: typeof import("./useHostRouteBrowser");
let wrapper: (props: PropsWithChildren) => ReactNode;
let list: ReturnType<
	typeof vi.fn<
		(
			page?: number,
			limit?: number,
			status?: RouteStatusFilter,
			filters?: RouteListFilters
		) => Promise<PaginatedTrekkingRoutesResponse>
	>
>;
const route: CreatedTrekkingRoute = {
	id: "route",
	name: "Ridge",
	description: null,
	geometry: {
		type: "LineString",
		coordinates: [
			[108, 16],
			[108.1, 16.1],
		],
	},
	difficulty: "easy",
	expectedDurationMinutes: 120,
	lengthMeters: 3500,
	status: "draft",
	createdAt: "2026-10-30T00:00:00Z",
	updatedAt: "2026-10-30T00:00:00Z",
};
const response = (page = 1): PaginatedTrekkingRoutesResponse => ({
	items: [{ ...route, id: `route-${page}` }],
	pagination: { page, limit: 5, total: 12, totalPages: 3 },
	statusCounts: { all: 12, draft: 6, pending_approval: 0, active: 6, closed: 0 },
});
describe("Host route pagination and filters", () => {
	beforeEach(async () => {
		vi.resetModules();
		vi.doUnmock("./useHostRouteBrowser");
		localStorage.setItem("authUser", JSON.stringify({ id: "host" }));
		list = vi.fn().mockImplementation(async (page = 1) => response(page));
		vi.doMock("../services/trekking-routes.service", () => ({
			trekkingRoutesService: { listMinePaginated: list },
		}));
		const query = await import("@tanstack/react-query");
		[library, module] = await Promise.all([
			import("@testing-library/react"),
			import("./useHostRouteBrowser"),
		]);
		const client = new query.QueryClient({
			defaultOptions: { queries: { retry: false, gcTime: 0 } },
		});
		wrapper = ({ children }) => (
			<query.QueryClientProvider client={client}>{children}</query.QueryClientProvider>
		);
	});
	afterEach(() => {
		library.cleanup();
		vi.doUnmock("../services/trekking-routes.service");
		vi.doUnmock("./useHostRouteBrowser");
		vi.resetModules();
	});
	it("requests five records per page and resets pagination on status, sort and name changes", async () => {
		const hook = library.renderHook(() => module.useHostRouteBrowser(), { wrapper });
		await library.waitFor(() => expect(hook.result.current.items[0]?.id).toBe("route-1"));
		expect(list).toHaveBeenLastCalledWith(1, 5, "all", { search: "", sort: "newest" });
		library.act(() => hook.result.current.setPage(2));
		await library.waitFor(() => expect(hook.result.current.items[0]?.id).toBe("route-2"));
		library.act(() => hook.result.current.setSort("name"));
		await library.waitFor(() =>
			expect(list).toHaveBeenLastCalledWith(1, 5, "all", { search: "", sort: "name" })
		);
		library.act(() => hook.result.current.setStatusFilter("active"));
		await library.waitFor(() =>
			expect(list).toHaveBeenLastCalledWith(1, 5, "active", { search: "", sort: "name" })
		);
		library.act(() => hook.result.current.setSearch("  Ridge  "));
		await library.waitFor(() =>
			expect(list).toHaveBeenLastCalledWith(1, 5, "active", { search: "Ridge", sort: "name" })
		);
	});
	it("does not let a late page response replace the current selection data", async () => {
		let finish: ((value: PaginatedTrekkingRoutesResponse) => void) | undefined;
		list.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				})
		);
		const hook = library.renderHook(() => module.useHostRouteBrowser(), { wrapper });
		await library.waitFor(() => expect(list).toHaveBeenCalledOnce());
		library.act(() => hook.result.current.setPage(2));
		await library.waitFor(() => expect(hook.result.current.items[0]?.id).toBe("route-2"));
		await library.act(async () => {
			finish?.(response(1));
		});
		expect(hook.result.current.items[0]?.id).toBe("route-2");
	});
});
