import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GeoJsonLineString } from "../trekking-routes/types";
import { RouteDurationAdvice } from "./components/RouteDurationAdvice";
import { useRouteTerrain } from "./hooks/useRouteTerrain";
import { terrainService } from "./services/terrain.service";
import type { TerrainResult } from "./terrain-types";
import { terrainAdvice } from "./utils/terrain-advice";

vi.mock("./services/terrain.service", () => ({ terrainService: { analyze: vi.fn() } }));
const line: GeoJsonLineString = {
	type: "LineString",
	coordinates: [
		[108, 12],
		[108.03, 12],
	],
};
const next: GeoJsonLineString = {
	type: "LineString",
	coordinates: [
		[108, 12],
		[108.06, 12],
	],
};
const result: TerrainResult = {
	status: "READY",
	source: "MapTiler",
	distanceMeters: 3263,
	sampleSpacingMeters: 100,
	ascentMeters: 600,
	descentMeters: 100,
	maxSlopePercent: 20,
	estimatedMinutes: 225,
	minimumMinutes: 225,
	horizontalMinutes: 48.945,
	verticalMinutes: 200,
	estimateBasis: "TCVN",
	classifiedDistanceMeters: 3263,
	unknownDistanceMeters: 0,
	legs: [{ distanceMeters: 3263, terrain: "EASY" }],
	profile: [
		{ coordinates: [108, 12], distanceMeters: 0, elevationMeters: 100, slopePercent: 0 },
		{ coordinates: [108.03, 12], distanceMeters: 3263, elevationMeters: 600, slopePercent: 15.3 },
	],
};
const wrapper = () => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return ({ children }: PropsWithChildren) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
};

describe("Terrain duration advice", () => {
	it("warns immediately for 300+ km in 120 minutes without elevation", () => {
		const advice = terrainAdvice(
			{
				type: "LineString",
				coordinates: [
					[108, 12],
					[111, 12],
				],
			},
			"120"
		);
		expect(advice.distanceMeters).toBeGreaterThan(300_000);
		expect(advice.speedKmh).toBeGreaterThan(150);
		expect(advice.warning).toBe(true);
	});
	it("uses ascent in guidance and accepts sufficient time", () => {
		expect(terrainAdvice(line, "60").warning).toBe(false);
		expect(terrainAdvice(line, "60", result).warning).toBe(true);
		expect(terrainAdvice(line, "224", result).warning).toBe(true);
		expect(terrainAdvice(line, "225", result).warning).toBe(false);
		expect(terrainAdvice(line, "").warning).toBe(false);
		expect(terrainAdvice(line, "0").warning).toBe(false);
	});
});

describe("useRouteTerrain", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		localStorage.setItem("authUser", JSON.stringify({ id: "host" }));
	});
	it("reuses elevation when only duration changes, clears stale profiles and uses cached geometry", async () => {
		vi.mocked(terrainService.analyze).mockResolvedValue(result);
		const hook = renderHook(({ geometry, duration }) => useRouteTerrain(geometry, duration), {
			initialProps: { geometry: line, duration: "120" },
			wrapper: wrapper(),
		});
		await waitFor(() => expect(hook.result.current.data?.status).toBe("READY"));
		hook.rerender({ geometry: line, duration: "60" });
		expect(hook.result.current.warning).toBe(true);
		expect(terrainService.analyze).toHaveBeenCalledTimes(1);
		hook.rerender({ geometry: next, duration: "60" });
		expect(hook.result.current.data).toBeUndefined();
		await waitFor(() => expect(terrainService.analyze).toHaveBeenCalledTimes(2), { timeout: 2500 });
		hook.rerender({ geometry: line, duration: "120" });
		await waitFor(() => expect(hook.result.current.data?.status).toBe("READY"), { timeout: 2500 });
		expect(terrainService.analyze).toHaveBeenCalledTimes(2);
	});
	it("does not apply a late response to an edited route", async () => {
		let finish: ((data: TerrainResult) => void) | undefined;
		vi.mocked(terrainService.analyze)
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						finish = resolve;
					})
			)
			.mockResolvedValue(result);
		const hook = renderHook(({ geometry }) => useRouteTerrain(geometry, "120"), {
			initialProps: { geometry: line },
			wrapper: wrapper(),
		});
		await waitFor(() => expect(terrainService.analyze).toHaveBeenCalledTimes(1));
		hook.rerender({ geometry: next });
		await act(async () => {
			finish?.(result);
		});
		expect(hook.result.current.data).toBeUndefined();
	});
	it("keeps distance guidance on provider failure and removes it when route is cleared", async () => {
		vi.mocked(terrainService.analyze).mockRejectedValue(new Error("network"));
		const hook = renderHook(({ geometry }) => useRouteTerrain(geometry, "1"), {
			initialProps: { geometry: line },
			wrapper: wrapper(),
		});
		await waitFor(() => expect(hook.result.current.unavailable).toBe(true));
		expect(hook.result.current.warning).toBe(true);
		expect(hook.result.current.estimatedMinutes).toBeGreaterThan(0);
		hook.rerender({ geometry: { type: "LineString", coordinates: [] } });
		expect(hook.result.current.valid).toBe(false);
		expect(hook.result.current.data).toBeUndefined();
	});
});

function AdviceForm({ duration }: { duration: string }) {
	const assessment = useRouteTerrain(line, duration);
	return (
		<RouteDurationAdvice invalid={assessment.warning} minimumMinutes={assessment.minimumMinutes} />
	);
}

describe("Quiet background terrain analysis", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		localStorage.setItem("authUser", JSON.stringify({ id: "host" }));
	});
	it("renders nothing during loading or after a successful analysis with sufficient time", async () => {
		let finish: ((data: TerrainResult) => void) | undefined;
		vi.mocked(terrainService.analyze).mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				})
		);
		const view = render(<AdviceForm duration="300" />);
		await waitFor(() => expect(terrainService.analyze).toHaveBeenCalledTimes(1));
		expect(view.container).toBeEmptyDOMElement();
		await act(async () => {
			finish?.(result);
		});
		expect(view.container).toBeEmptyDOMElement();
	});
	it("keeps provider failures silent", async () => {
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		vi.mocked(terrainService.analyze).mockRejectedValue(new Error("MapTiler unavailable"));
		const view = render(
			<QueryClientProvider client={client}>
				<AdviceForm duration="300" />
			</QueryClientProvider>
		);
		await waitFor(() => expect(client.getQueryCache().getAll()[0]?.state.status).toBe("error"));
		expect(view.container).toBeEmptyDOMElement();
	});
	it("only shows the brief duration warning when the time is too short", async () => {
		vi.mocked(terrainService.analyze).mockResolvedValue(result);
		render(<AdviceForm duration="1" />);
		expect(screen.getByRole("alert")).toHaveTextContent("Thời lượng di chuyển phải từ");
		await waitFor(() => expect(terrainService.analyze).toHaveBeenCalledTimes(1));
		expect(screen.getAllByRole("alert")).toHaveLength(1);
		expect(screen.queryByRole("img")).not.toBeInTheDocument();
		expect(screen.queryByRole("button")).not.toBeInTheDocument();
		expect(screen.queryByRole("heading")).not.toBeInTheDocument();
	});
});
