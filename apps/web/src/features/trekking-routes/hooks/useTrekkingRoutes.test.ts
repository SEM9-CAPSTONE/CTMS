import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreatedTrekkingRoute } from "../types";

type TestingLibrary = typeof import("@testing-library/react");
type TrekkingRoutesModule = typeof import("./useTrekkingRoutes");

let testingLibrary: TestingLibrary;
let trekkingRoutesModule: TrekkingRoutesModule;
let listMinePaginatedMock: ReturnType<typeof vi.fn>;

const activeRoute = { id: "route-id", status: "active" } as CreatedTrekkingRoute;
const closedRoute = { id: "route-id", status: "closed" } as CreatedTrekkingRoute;

describe("useTrekkingRoutes", () => {
	beforeEach(async () => {
		vi.resetModules();
		vi.doUnmock("../../../core/api");
		listMinePaginatedMock = vi.fn();
		vi.doMock("../services/trekking-routes.service", () => ({
			trekkingRoutesService: { listMinePaginated: listMinePaginatedMock },
		}));

		[testingLibrary, trekkingRoutesModule] = await Promise.all([
			import("@testing-library/react"),
			import("./useTrekkingRoutes"),
		]);
	});

	afterEach(() => {
		testingLibrary.cleanup();
		vi.doUnmock("../services/trekking-routes.service");
		vi.resetModules();
	});

	it("loads the first page with the CTMS default page size", async () => {
		listMinePaginatedMock.mockResolvedValueOnce({
			items: [activeRoute],
			pagination: { page: 1, limit: 20, total: 21, totalPages: 2 },
		});
		const { result } = testingLibrary.renderHook(() => trekkingRoutesModule.useTrekkingRoutes());

		await testingLibrary.waitFor(() => expect(result.current.items).toEqual([activeRoute]));
		expect(listMinePaginatedMock).toHaveBeenCalledWith(1, 20, "all");
		expect(result.current.pagination).toEqual({ page: 1, limit: 20, total: 21, totalPages: 2 });
	});

	it("navigates pages and ignores an older out-of-order response", async () => {
		let resolveFirst!: (response: unknown) => void;
		listMinePaginatedMock
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						resolveFirst = resolve;
					})
			)
			.mockResolvedValueOnce({
				items: [closedRoute],
				pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
			});
		const { result } = testingLibrary.renderHook(() => trekkingRoutesModule.useTrekkingRoutes());

		testingLibrary.act(() => {
			result.current.setPage(2);
		});
		await testingLibrary.waitFor(() => expect(result.current.items).toEqual([closedRoute]));
		resolveFirst({
			items: [activeRoute],
			pagination: { page: 1, limit: 20, total: 21, totalPages: 2 },
		});
		await testingLibrary.waitFor(() => expect(listMinePaginatedMock).toHaveBeenCalledTimes(2));

		expect(result.current.items).toEqual([closedRoute]);
		expect(result.current.pagination.page).toBe(2);
	});

	it("moves to the last valid page after a refresh shrinks the result set", async () => {
		listMinePaginatedMock
			.mockResolvedValueOnce({
				items: [activeRoute],
				pagination: { page: 1, limit: 20, total: 41, totalPages: 3 },
			})
			.mockResolvedValueOnce({
				items: [closedRoute],
				pagination: { page: 3, limit: 20, total: 20, totalPages: 1 },
			})
			.mockResolvedValueOnce({
				items: [activeRoute],
				pagination: { page: 1, limit: 20, total: 20, totalPages: 1 },
			});
		const { result } = testingLibrary.renderHook(() => trekkingRoutesModule.useTrekkingRoutes());
		await testingLibrary.waitFor(() => expect(result.current.items).toEqual([activeRoute]));

		testingLibrary.act(() => result.current.setPage(3));

		await testingLibrary.waitFor(() => expect(listMinePaginatedMock).toHaveBeenCalledTimes(3));
		expect(listMinePaginatedMock).toHaveBeenLastCalledWith(1, 20, "all");
		expect(result.current.pagination.page).toBe(1);
	});

	it("resets to page one and reloads when the status filter changes", async () => {
		listMinePaginatedMock
			.mockResolvedValueOnce({
				items: [activeRoute],
				pagination: { page: 1, limit: 20, total: 21, totalPages: 2 },
			})
			.mockResolvedValueOnce({
				items: [closedRoute],
				pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
			})
			.mockResolvedValueOnce({
				items: [],
				pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
			});
		const { result } = testingLibrary.renderHook(() => trekkingRoutesModule.useTrekkingRoutes());
		await testingLibrary.waitFor(() => expect(result.current.items).toEqual([activeRoute]));

		testingLibrary.act(() => result.current.setPage(2));
		await testingLibrary.waitFor(() => expect(result.current.pagination.page).toBe(2));

		testingLibrary.act(() => result.current.setStatusFilter("draft"));

		await testingLibrary.waitFor(() =>
			expect(listMinePaginatedMock).toHaveBeenLastCalledWith(1, 20, "draft")
		);
		expect(result.current.statusFilter).toBe("draft");
		expect(result.current.pagination).toEqual({
			page: 1,
			limit: 20,
			total: 0,
			totalPages: 0,
		});
	});

	it("refreshes the latest authoritative rejection reason", async () => {
		listMinePaginatedMock
			.mockResolvedValueOnce({
				items: [{ ...activeRoute, status: "draft", latestRejectionReason: "First reason" }],
				pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
			})
			.mockResolvedValueOnce({
				items: [{ ...activeRoute, status: "draft", latestRejectionReason: "Latest reason" }],
				pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
			});
		const { result } = testingLibrary.renderHook(() => trekkingRoutesModule.useTrekkingRoutes());

		await testingLibrary.waitFor(() =>
			expect(result.current.items[0]?.latestRejectionReason).toBe("First reason")
		);
		await testingLibrary.act(async () => result.current.retry());

		expect(result.current.items[0]?.latestRejectionReason).toBe("Latest reason");
	});

	it.each(["all", "draft", "pending_approval", "active", "closed"] as const)(
		"updates status filter to %s and queries page 1",
		async (status) => {
			listMinePaginatedMock.mockResolvedValue({
				items: [],
				pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
			});
			const { result } = testingLibrary.renderHook(() => trekkingRoutesModule.useTrekkingRoutes());
			await testingLibrary.waitFor(() => expect(result.current.isLoading).toBe(false));

			testingLibrary.act(() => result.current.setPage(3));
			testingLibrary.act(() => result.current.setStatusFilter(status));

			await testingLibrary.waitFor(() =>
				expect(listMinePaginatedMock).toHaveBeenLastCalledWith(1, 20, status)
			);
			expect(result.current.statusFilter).toBe(status);
		}
	);
});
