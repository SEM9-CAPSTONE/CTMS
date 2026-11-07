import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../core/api/httpClient";
import type { CreatePlanningResponse, DemandPlanningReport, DemandPlanningStatus } from "./types";
import { useDemandPlanning } from "./useDemandPlanning";
const edge = vi.hoisted(() => ({ planning: vi.fn(), createPlanning: vi.fn() }));
vi.mock("./service", () => ({ demandService: edge }));
let tick = 0;
const clients: QueryClient[] = [];
const data = (status: DemandPlanningStatus): DemandPlanningReport => ({
	status,
	reportVersion: "test-report",
	dataPeriod: "2026-07",
	generatedAt: null,
	stale: false,
	recommendations: [],
	errorCode: null,
});
function mount(enabled = true, month = "2026-07") {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	clients.push(client);
	return renderHook(({ period, ready }) => useDemandPlanning("test-host", period, ready), {
		initialProps: { period: month, ready: enabled },
		wrapper: ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={client}>{children}</QueryClientProvider>
		),
	});
}
const advance = async (ms = 10) => {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(ms);
	});
};
beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date(Date.UTC(2031, 0, 1, tick++)));
	Object.defineProperty(document, "hidden", { configurable: true, value: false });
	edge.planning.mockReset().mockResolvedValue(data("not_requested"));
	edge.createPlanning.mockReset();
});
afterEach(() => {
	cleanup();
	for (const client of clients.splice(0)) client.clear();
	vi.useRealTimers();
	Object.defineProperty(document, "hidden", { configurable: true, value: false });
});
describe("grounded planning lifecycle", () => {
	it("does not read planning before the monthly report succeeds", async () => {
		const view = mount(false);
		await advance();
		expect(edge.planning).not.toHaveBeenCalled();
		view.rerender({ period: "2026-07", ready: true });
		await advance();
		expect(edge.planning).toHaveBeenCalledTimes(1);
	});
	it("continues past 150 seconds, stops on completion, and stops on unmount", async () => {
		let status: DemandPlanningStatus = "running";
		edge.planning.mockImplementation(async () => data(status));
		const view = mount();
		await advance();
		await advance(155000);
		expect(edge.planning.mock.calls.length).toBeGreaterThan(30);
		status = "succeeded";
		await advance(5010);
		expect(view.result.current.status).toBe("succeeded");
		const calls = edge.planning.mock.calls.length;
		await advance(60000);
		expect(edge.planning).toHaveBeenCalledTimes(calls);
		view.unmount();
		await advance(60000);
		expect(edge.planning).toHaveBeenCalledTimes(calls);
	});
	it("pauses on hidden tabs, resumes on visibility and cancels the old subscription", async () => {
		edge.planning.mockResolvedValue(data("pending"));
		const view = mount();
		await advance();
		act(() => {
			Object.defineProperty(document, "hidden", { configurable: true, value: true });
			document.dispatchEvent(new Event("visibilitychange"));
		});
		const calls = edge.planning.mock.calls.length;
		await advance(20000);
		expect(edge.planning).toHaveBeenCalledTimes(calls);
		act(() => {
			Object.defineProperty(document, "hidden", { configurable: true, value: false });
			document.dispatchEvent(new Event("visibilitychange"));
		});
		await advance();
		expect(edge.planning.mock.calls.length).toBeGreaterThan(calls);
		view.unmount();
		const end = edge.planning.mock.calls.length;
		await advance(20000);
		expect(edge.planning).toHaveBeenCalledTimes(end);
	});
	it("backs off transient read failures and recovers without a new POST", async () => {
		edge.planning
			.mockResolvedValueOnce(data("running"))
			.mockRejectedValueOnce(new HttpError("transport", 503, {}))
			.mockResolvedValue(data("succeeded"));
		const view = mount();
		await advance();
		await advance(5000);
		expect(edge.planning).toHaveBeenCalledTimes(2);
		await advance(6000);
		expect(edge.planning).toHaveBeenCalledTimes(2);
		await advance(4010);
		expect(view.result.current.status).toBe("succeeded");
		expect(edge.createPlanning).not.toHaveBeenCalled();
	});
	it("reads an active job after remount instead of recreating it", async () => {
		edge.planning.mockResolvedValue(data("running"));
		const first = mount();
		await advance();
		first.unmount();
		const second = mount();
		await advance();
		expect(second.result.current.status).toBe("running");
		expect(edge.planning).toHaveBeenCalledTimes(2);
		expect(edge.createPlanning).not.toHaveBeenCalled();
	});
	it.each(["running", "succeeded"] as const)(
		"reconciles a %s POST result and prevents double clicks",
		async (status) => {
			let resolve: (value: CreatePlanningResponse) => void = () => {};
			edge.createPlanning.mockImplementation(
				() =>
					new Promise<CreatePlanningResponse>((done) => {
						resolve = done;
					})
			);
			const view = mount();
			await advance();
			act(() => {
				view.result.current.submit();
				view.result.current.submit();
			});
			await advance();
			expect(edge.createPlanning).toHaveBeenCalledTimes(1);
			edge.planning.mockResolvedValue(data(status));
			act(() => resolve({ status, reused: status === "succeeded" }));
			await advance();
			expect(view.result.current.status).toBe(status);
		}
	);
	it.each(["failed", "unavailable", "withheld", "succeeded"] as const)(
		"never creates or retries from %s",
		async (status) => {
			edge.planning.mockResolvedValue(data(status));
			const view = mount();
			await advance();
			act(() => view.result.current.submit());
			await advance();
			expect(edge.createPlanning).not.toHaveBeenCalled();
		}
	);
	it("respects Retry-After across months/remounts and unlocks only after expiry", async () => {
		edge.createPlanning.mockRejectedValue(
			new HttpError("rate", 429, { retryAfterSeconds: 99 }, new Headers({ "Retry-After": "30" }))
		);
		const first = mount();
		await advance();
		act(() => first.result.current.submit());
		await advance();
		expect(first.result.current.waitSeconds).toBe(30);
		first.rerender({ period: "2026-06", ready: true });
		await advance();
		act(() => first.result.current.submit());
		await advance();
		expect(edge.createPlanning).toHaveBeenCalledTimes(1);
		first.unmount();
		const next = mount();
		await advance();
		expect(next.result.current.waitSeconds).toBe(30);
		await advance(31000);
		expect(next.result.current.waitSeconds).toBe(0);
	});
	it.each([401, 403, 404, 422])(
		"stops polling and disables creation after HTTP %s",
		async (code) => {
			edge.planning
				.mockResolvedValueOnce(data("running"))
				.mockRejectedValue(new HttpError("private detail", code, {}));
			const view = mount();
			await advance();
			await advance(5010);
			const calls = edge.planning.mock.calls.length;
			await advance(60000);
			expect(edge.planning).toHaveBeenCalledTimes(calls);
			expect(view.result.current.isAvailable).toBe(false);
		}
	);
});
