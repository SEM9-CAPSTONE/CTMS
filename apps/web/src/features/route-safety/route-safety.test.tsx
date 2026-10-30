import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GeoJsonLineString } from "../trekking-routes/types";
import { RouteSafetyPanel } from "./components/RouteSafetyPanel";
import { useRouteSafety } from "./hooks/useRouteSafety";
import { setSafetyMapData } from "./hooks/useSafetyMapLayers";
import { routeSafetyService } from "./services/route-safety.service";
import type { RouteSafetyResult, SafetyProvider } from "./types";

vi.mock("./services/route-safety.service", () => ({ routeSafetyService: { analyze: vi.fn() } }));
const result = (version: string): RouteSafetyResult => ({
	liveSource: {
		source: "NCHMF",
		status: "LIVE",
		checkedAt: "2026-10-30T07:30:00Z",
		dataTime: "2026-10-30T07:00:00Z",
		validUntil: "2026-10-30T13:00:00Z",
	},
	riskLevel: "UNKNOWN",
	summary: {
		activeWarnings: 0,
		nearbyIncidents: 0,
		hostDefinedDangerZones: 0,
		historicalFeatures: 0,
	},
	features: { type: "FeatureCollection", features: [] },
	analyzedAt: "2026-10-29T12:00:00Z",
	dataVersion: version,
	truncated: false,
	coverage: "PARTIAL",
	proximityMeters: 300,
});
const line: GeoJsonLineString = {
	type: "LineString",
	coordinates: [
		[108, 12],
		[108.01, 12],
	],
};
const next: GeoJsonLineString = {
	type: "LineString",
	coordinates: [
		[108, 12],
		[108.02, 12],
	],
};
const sourceResult = (source: SafetyProvider, version: string): RouteSafetyResult => {
	const data = result(version);
	data.sources = [
		{ source, status: "LIVE", checkedAt: data.analyzedAt, dataTime: null, validUntil: null },
	];
	if (source !== "NCHMF") data.liveSource = undefined;
	return data;
};
const wrapper = () => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
	return ({ children }: PropsWithChildren) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
};

describe("Route Safety preview BR-480", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.setItem("authUser", JSON.stringify({ id: "host" }));
	});
	it("debounces changes, clears old results and prevents late responses replacing the new line", async () => {
		let finishOld: ((value: RouteSafetyResult) => void) | undefined;
		vi.mocked(routeSafetyService.analyze)
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						finishOld = resolve;
					})
			)
			.mockResolvedValue(result("new"));
		const hook = renderHook(({ geometry }) => useRouteSafety(geometry), {
			initialProps: { geometry: line },
			wrapper: wrapper(),
		});
		await waitFor(() => expect(routeSafetyService.analyze).toHaveBeenCalledTimes(3));
		hook.rerender({ geometry: next });
		expect(hook.result.current.data).toBeUndefined();
		expect(routeSafetyService.analyze).toHaveBeenCalledTimes(3);
		await waitFor(() => expect(routeSafetyService.analyze).toHaveBeenCalledTimes(6));
		await waitFor(() => expect(hook.result.current.data?.dataVersion).toContain("new"));
		await act(async () => {
			finishOld?.(result("old"));
		});
		expect(hook.result.current.data?.dataVersion).not.toContain("old");
	});
	it("shows completed sources while a slow water request is still pending", async () => {
		let finishWater: ((value: RouteSafetyResult) => void) | undefined;
		vi.mocked(routeSafetyService.analyze).mockImplementation(
			(_geometry, _routeId, _signal, source = "NCHMF") =>
				source === "OSM"
					? new Promise((resolve) => {
							finishWater = resolve;
						})
					: Promise.resolve(sourceResult(source, source))
		);
		const hook = renderHook(() => useRouteSafety(line), { wrapper: wrapper() });
		await waitFor(() => expect(hook.result.current.data).toBeDefined());
		expect(hook.result.current.isFetching).toBe(true);
		expect(hook.result.current.sources?.find((s) => s.source === "OSM")?.status).toBe("LOADING");
		expect(hook.result.current.data?.dataVersion).toContain("NCHMF");
		await act(async () => {
			finishWater?.(sourceResult("OSM", "water-ready"));
		});
		await waitFor(() => expect(hook.result.current.isFetching).toBe(false));
		expect(hook.result.current.data?.dataVersion).toContain("water-ready");
	});
	it("does not analyze an incomplete line and removes stale data on clearing", async () => {
		vi.mocked(routeSafetyService.analyze).mockResolvedValue(result("valid"));
		const hook = renderHook(({ geometry }) => useRouteSafety(geometry), {
			initialProps: { geometry: line },
			wrapper: wrapper(),
		});
		await waitFor(() => expect(hook.result.current.data).toBeDefined());
		hook.rerender({ geometry: { type: "LineString", coordinates: [] } });
		expect(hook.result.current.data).toBeUndefined();
		expect(hook.result.current.valid).toBe(false);
	});
	it("keeps a stable map source and layers when only data changes", () => {
		let exists = false;
		const source = { setData: vi.fn() };
		const map = {
			getSource: vi.fn(() => (exists ? source : undefined)),
			addSource: vi.fn(() => {
				exists = true;
			}),
			addLayer: vi.fn(),
		};
		setSafetyMapData(map as unknown as MapLibreMap, result("one").features);
		setSafetyMapData(map as unknown as MapLibreMap, result("two").features);
		expect(map.addSource).toHaveBeenCalledTimes(1);
		expect(map.addLayer).toHaveBeenCalledTimes(2);
		expect(source.setData).toHaveBeenCalledTimes(2);
	});
});

describe("Compact route map legend", () => {
	it("shows symbols and severity keys instead of the long feature list", () => {
		render(
			<RouteSafetyPanel
				valid
				loading={false}
				error={false}
				data={result("legend")}
				onRetry={vi.fn()}
			/>
		);
		expect(screen.getByRole("region", { name: "Chú giải bản đồ" })).toBeInTheDocument();
		expect(screen.getByText("Điểm nguy hiểm")).toBeInTheDocument();
		expect(screen.getByText("Nguồn nước")).toBeInTheDocument();
		expect(screen.getByText("Vùng nguy hiểm")).toBeInTheDocument();
		expect(screen.getByText("Rất cao")).toBeInTheDocument();
		expect(document.querySelector("details")).toBeNull();
		expect(screen.queryByText("Mức nguy cơ từ dữ liệu còn hiệu lực:")).not.toBeInTheDocument();
		expect(screen.queryByRole("link")).not.toBeInTheDocument();
		expect(screen.queryByText("Thông tin tham khảo")).not.toBeInTheDocument();
	});
	it.each(["UNAVAILABLE", "PARTIAL", "DISABLED"] as const)(
		"omits %s source diagnostics from the legend",
		(status) => {
			const retry = vi.fn();
			const data = result("source");
			if (data.liveSource) data.liveSource.status = status;
			render(<RouteSafetyPanel valid loading={false} error={false} data={data} onRetry={retry} />);
			expect(screen.queryByRole("alert")).not.toBeInTheDocument();
			expect(screen.queryByText("NCHMF")).not.toBeInTheDocument();
			screen.getByRole("button", { name: "Kiểm tra lại" }).click();
			expect(retry).toHaveBeenCalledOnce();
		}
	);
	it("keeps retry available after an error without a diagnostic footer", () => {
		const retry = vi.fn();
		render(<RouteSafetyPanel valid loading={false} error onRetry={retry} />);
		expect(screen.getByRole("button", { name: "Kiểm tra lại" })).toHaveAttribute(
			"title",
			"Không tải được dữ liệu. Kiểm tra lại"
		);
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		screen.getByRole("button", { name: "Kiểm tra lại" }).click();
		expect(retry).toHaveBeenCalledOnce();
	});
	it("does not label an empty result as safe", () => {
		render(
			<RouteSafetyPanel
				valid
				loading={false}
				error={false}
				data={result("empty")}
				onRetry={vi.fn()}
			/>
		);
		expect(screen.queryByText("Chưa có dữ liệu gần tuyến")).not.toBeInTheDocument();
		expect(screen.queryByText(/^An toàn$/)).not.toBeInTheDocument();
	});
	it("uses the refresh spinner while loading without source names", () => {
		render(
			<RouteSafetyPanel
				valid
				loading
				error={false}
				sources={[
					{ source: "OSM", status: "LOADING", checkedAt: "", dataTime: null, validUntil: null },
				]}
				onRetry={vi.fn()}
			/>
		);
		expect(screen.getByRole("button", { name: "Kiểm tra lại" })).toBeDisabled();
		expect(screen.queryByText("OSM")).not.toBeInTheDocument();
	});
});
