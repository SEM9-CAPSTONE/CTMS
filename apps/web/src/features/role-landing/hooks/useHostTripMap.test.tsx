import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { trekkingRoutesService } from "../../trekking-routes/services/trekking-routes.service";
import type { CreatedTrekkingRoute } from "../../trekking-routes/types";
import { useHostTripMap } from "./useHostTripMap";

vi.mock("../../trekking-routes/services/trekking-routes.service", () => ({
	trekkingRoutesService: { listMine: vi.fn(), listCheckpoints: vi.fn() },
}));

const route: CreatedTrekkingRoute = {
	id: "route",
	name: "Actual route",
	description: null,
	geometry: {
		type: "LineString",
		coordinates: [
			[108, 16],
			[108.01, 16.01],
		],
	},
	difficulty: "easy",
	expectedDurationMinutes: 60,
	lengthMeters: 1000,
	status: "active",
	createdAt: "2026-10-01T00:00:00Z",
	updatedAt: "2026-10-01T00:00:00Z",
};

function createWrapper() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
}

describe("useHostTripMap", () => {
	beforeEach(() => vi.resetAllMocks());
	it("loads the selected trip's real route geometry and checkpoints", async () => {
		vi.mocked(trekkingRoutesService.listMine).mockResolvedValue([{ ...route, id: "other" }, route]);
		vi.mocked(trekkingRoutesService.listCheckpoints).mockResolvedValue([]);
		const { result } = renderHook(() => useHostTripMap("host", "route"), {
			wrapper: createWrapper(),
		});
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data?.route).toEqual(route);
		expect(trekkingRoutesService.listCheckpoints).toHaveBeenCalledWith("route");
	});
	it("does not fetch when the trip has no route", () => {
		renderHook(() => useHostTripMap("host"), { wrapper: createWrapper() });
		expect(trekkingRoutesService.listMine).not.toHaveBeenCalled();
		expect(trekkingRoutesService.listCheckpoints).not.toHaveBeenCalled();
	});
	it("reports missing geometry instead of substituting a different route", async () => {
		vi.mocked(trekkingRoutesService.listMine).mockResolvedValue([{ ...route, id: "other" }]);
		vi.mocked(trekkingRoutesService.listCheckpoints).mockResolvedValue([]);
		const { result } = renderHook(() => useHostTripMap("host", "route"), {
			wrapper: createWrapper(),
		});
		await waitFor(() => expect(result.current.isError).toBe(true));
		expect(result.current.data).toBeUndefined();
	});
});
