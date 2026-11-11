import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tripsService } from "../../trips/services/trips.service";
import { useHostOperationalOverview } from "./useHostOperationalOverview";

vi.mock("../../trips/services/trips.service", () => ({
	tripsService: { getMyTrips: vi.fn(), getHostPorterAssignments: vi.fn() },
}));

function wrapper({ children }: { children: ReactNode }) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useHostOperationalOverview", () => {
	beforeEach(() => vi.resetAllMocks());
	it("loads the host's trips and assignments from the existing services", async () => {
		vi.mocked(tripsService.getMyTrips).mockResolvedValue([]);
		vi.mocked(tripsService.getHostPorterAssignments).mockResolvedValue([]);
		const { result } = renderHook(() => useHostOperationalOverview("host"), { wrapper });
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(tripsService.getMyTrips).toHaveBeenCalledOnce();
		expect(tripsService.getHostPorterAssignments).toHaveBeenCalledOnce();
		expect(result.current.isError).toBe(false);
		expect(result.current.todayTrips).toBe(0);
	});
	it("exposes a load failure instead of displaying zero as successful data", async () => {
		vi.mocked(tripsService.getMyTrips).mockRejectedValue(new Error("Unavailable"));
		vi.mocked(tripsService.getHostPorterAssignments).mockResolvedValue([]);
		const { result } = renderHook(() => useHostOperationalOverview("host"), { wrapper });
		await waitFor(() => expect(result.current.isError).toBe(true));
	});
	it("keeps trip data usable while marking porter data unavailable on a partial failure", async () => {
		vi.mocked(tripsService.getMyTrips).mockResolvedValue([]);
		vi.mocked(tripsService.getHostPorterAssignments).mockRejectedValue(new Error("Unavailable"));
		const { result } = renderHook(() => useHostOperationalOverview("host"), { wrapper });
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.isError).toBe(false);
		expect(result.current.portersUnavailable).toBe(true);
	});
});
