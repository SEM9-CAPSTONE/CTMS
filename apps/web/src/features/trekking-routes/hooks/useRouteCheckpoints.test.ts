import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { trekkingRoutesService } from "../services/trekking-routes.service";
import { useRouteCheckpoints } from "./useRouteCheckpoints";

vi.mock("../services/trekking-routes.service", () => ({
	trekkingRoutesService: { listCheckpoints: vi.fn() },
}));

describe("useRouteCheckpoints", () => {
	beforeEach(() => vi.clearAllMocks());

	it("exposes loading and the server-ordered success result", async () => {
		let resolve!: (items: never[]) => void;
		vi.mocked(trekkingRoutesService.listCheckpoints).mockReturnValue(
			new Promise((done) => {
				resolve = done;
			})
		);
		const { result } = renderHook(() => useRouteCheckpoints("route-one"));
		expect(result.current.isLoading).toBe(true);
		await act(async () => resolve([{ id: "first" }, { id: "second" }] as never));
		expect(result.current.items.map((item) => item.id)).toEqual(["first", "second"]);
	});

	it("reloads when the selected route changes and supports retry after an error", async () => {
		vi.mocked(trekkingRoutesService.listCheckpoints)
			.mockRejectedValueOnce(new HttpError("forbidden", 403, {}))
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: "route-two-item" }] as never);
		const { result, rerender } = renderHook(({ routeId }) => useRouteCheckpoints(routeId), {
			initialProps: { routeId: "route-one" },
		});
		await waitFor(() => expect(result.current.error).toContain("không có quyền"));
		await act(async () => {
			await result.current.reload();
		});
		expect(result.current.items).toEqual([]);
		rerender({ routeId: "route-two" });
		await waitFor(() => expect(result.current.items[0]?.id).toBe("route-two-item"));
		expect(trekkingRoutesService.listCheckpoints).toHaveBeenLastCalledWith("route-two");
	});
});
