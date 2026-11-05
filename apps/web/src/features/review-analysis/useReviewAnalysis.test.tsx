import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../core/api/httpClient";
import { batch, batchFixture, insightFixture, tripId } from "./review-analysis.test-fixtures";
import { analysisService } from "./service";
import { useReviewAnalysis } from "./useReviewAnalysis";
vi.mock("./service", () => ({
	analysisService: { insights: vi.fn(), batch: vi.fn(), create: vi.fn() },
}));
const edge = vi.mocked(analysisService);
function wrapper({ children }: { children: ReactNode }) {
	return (
		<QueryClientProvider
			client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}
		>
			{children}
		</QueryClientProvider>
	);
}
beforeEach(() => {
	vi.resetAllMocks();
	vi.spyOn(document, "hidden", "get").mockReturnValue(false);
	edge.insights.mockResolvedValue({ ...insightFixture(), latestBatch: batch });
	edge.batch.mockResolvedValue(batchFixture());
});
afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
});
describe("CTMS-412 batch lifecycle", () => {
	it("restores server batch without POST and pauses polling while hidden and after unmount", async () => {
		const { result, unmount } = renderHook(() => useReviewAnalysis("host", tripId, 1), { wrapper });
		await waitFor(() => expect(result.current.batch.data?.batch.id).toBe(batch.id));
		expect(edge.create).not.toHaveBeenCalled();
		act(() => {
			vi.spyOn(document, "hidden", "get").mockReturnValue(true);
			document.dispatchEvent(new Event("visibilitychange"));
		});
		const count = edge.batch.mock.calls.length;
		await new Promise((r) => setTimeout(r, 2300));
		expect(edge.batch).toHaveBeenCalledTimes(count);
		act(() => {
			vi.spyOn(document, "hidden", "get").mockReturnValue(false);
			document.dispatchEvent(new Event("visibilitychange"));
		});
		await waitFor(() => expect(edge.batch.mock.calls.length).toBeGreaterThan(count));
		unmount();
		const last = edge.batch.mock.calls.length;
		await new Promise((r) => setTimeout(r, 2300));
		expect(edge.batch).toHaveBeenCalledTimes(last);
	});
	it("stops polling after terminal success", async () => {
		edge.batch.mockResolvedValue(batchFixture("succeeded"));
		const { result } = renderHook(() => useReviewAnalysis("host", tripId, 1), { wrapper });
		await waitFor(() => expect(result.current.batch.data?.batch.status).toBe("succeeded"));
		const count = edge.batch.mock.calls.length;
		await new Promise((r) => setTimeout(r, 2300));
		expect(edge.batch).toHaveBeenCalledTimes(count);
		expect(result.current.running).toBe(false);
	});
	it("does not fetch protected data while hidden before mount", async () => {
		vi.spyOn(document, "hidden", "get").mockReturnValue(true);
		renderHook(() => useReviewAnalysis("host", tripId, 1), { wrapper });
		await new Promise((r) => setTimeout(r, 50));
		expect(edge.insights).not.toHaveBeenCalled();
		expect(edge.batch).not.toHaveBeenCalled();
	});
	it("backs off transient poll errors rather than repeatedly polling at two seconds", async () => {
		edge.batch.mockRejectedValue(new HttpError("unavailable", 503, {}));
		const { unmount } = renderHook(() => useReviewAnalysis("host", tripId, 1), { wrapper });
		await waitFor(() => expect(edge.batch).toHaveBeenCalledTimes(1));
		await new Promise((r) => setTimeout(r, 2300));
		expect(edge.batch).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(edge.batch).toHaveBeenCalledTimes(2), { timeout: 3000 });
		unmount();
	});
});
