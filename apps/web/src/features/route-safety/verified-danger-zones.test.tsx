import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RouteGeometryEditor } from "../trekking-routes/components/RouteGeometryEditor";
import { SafetyMapFallback } from "./components/SafetyMapFallback";
import { VERIFIED_ZONE_REFRESH_MS, VERIFIED_ZONE_VIEW_DEBOUNCE_MS } from "./constants";
import { useVerifiedDangerZones } from "./hooks/useVerifiedDangerZones";
import { routeSafetyService } from "./services/route-safety.service";
import type { MapSafetyBounds, SafetyFeature, VerifiedZoneCollection } from "./types";
import { excludeSafetyFeatures, projectFallbackPosition } from "./utils/verified-zone-map";

vi.mock("../auth/utils/tokenStorage", () => ({ getStoredAuthUser: () => ({ id: "host" }) }));
vi.mock("./services/route-safety.service", () => ({
	routeSafetyService: { verifiedZones: vi.fn() },
}));
vi.mock("./hooks/useRouteSafety", () => ({
	useRouteSafety: () => ({
		valid: false,
		pending: false,
		isFetching: false,
		isError: false,
		refetch: vi.fn(),
	}),
}));

const bounds: MapSafetyBounds = { west: 108, south: 16, east: 109, north: 17 };
const zone: SafetyFeature = {
	type: "Feature",
	id: "host:internal-zone",
	geometry: { type: "Point", coordinates: [108.29, 16.11] },
	properties: {
		sourceType: "ADMIN_VERIFIED",
		source: "CTMS",
		sourceReference: "internal-zone",
		hazardType: "SLIPPERY_OR_LANDSLIDE",
		severity: "HIGH",
		geometryRole: "verified_danger_zone",
		description: "Lối mòn sát mép vực, đi theo cọc tiêu đỏ.",
		observedAt: null,
		issuedAt: "2026-11-16T00:00:00Z",
		fetchedAt: null,
		validFrom: null,
		validUntil: null,
		updatedAt: "2026-11-16T00:00:00Z",
		lifecycleStatus: "ACTIVE",
		verificationStatus: "VERIFIED",
		accuracyMeters: null,
		distanceMeters: 0,
		intersects: false,
		radiusMeters: 50,
	},
};
const collection = (features: SafetyFeature[] = [zone]): VerifiedZoneCollection => ({
	type: "FeatureCollection",
	features,
	generatedAt: "2026-11-16T00:00:00Z",
	truncated: false,
});
function queryWrapper() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
}
beforeEach(() => {
	vi.stubEnv("VITE_MAPTILER_API_KEY", "");
	vi.mocked(routeSafetyService.verifiedZones).mockReset().mockResolvedValue(collection());
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
});

describe("automatically published map danger zones", () => {
	it("shows a published zone before drawing any route and opens details without adding a vertex", async () => {
		const onChange = vi.fn();
		render(
			<RouteGeometryEditor value={{ type: "LineString", coordinates: [] }} onChange={onChange} />,
			{ wrapper: queryWrapper() }
		);
		const marker = await screen.findByRole("button", { name: /Điểm nguy hiểm đã xác nhận:/ });
		expect(routeSafetyService.verifiedZones).toHaveBeenCalledWith(
			{ west: -180, south: -90, east: 180, north: 90 },
			expect.any(AbortSignal)
		);
		expect(marker).toHaveClass("size-11");
		fireEvent.pointerDown(marker);
		fireEvent.click(marker);
		expect(screen.getByRole("dialog")).toHaveTextContent("50 m");
		expect(screen.getByRole("dialog")).toHaveTextContent("Quản trị viên xác nhận");
		expect(screen.getByRole("dialog")).toHaveTextContent("Trơn trượt, sạt lở");
		expect(screen.getByRole("dialog")).not.toHaveTextContent("internal-zone");
		expect(onChange).not.toHaveBeenCalled();
	});
	it("keeps polygon details accessible while drawing without intercepting polygon area clicks", () => {
		const polygon: SafetyFeature = {
			...zone,
			geometry: {
				type: "Polygon",
				coordinates: [
					[
						[108, 16],
						[109, 16],
						[109, 17],
						[108, 16],
					],
				],
			},
			properties: { ...zone.properties, labelPoint: { type: "Point", coordinates: [108.5, 16.5] } },
		};
		const { container } = render(
			<SafetyMapFallback
				data={collection([polygon])}
				project={() => [50, 50]}
				areaClicksEnabled={false}
			/>
		);
		expect(container.querySelector("path")).not.toHaveAttribute("role", "button");
		fireEvent.click(screen.getByRole("button", { name: /Điểm nguy hiểm đã xác nhận:/ }));
		expect(screen.getByRole("dialog")).toHaveTextContent(zone.properties.description);
	});
	it("loads the viewport on open and reloads after a pan without a route id", async () => {
		let moved: () => void = () => {};
		let current = bounds;
		const map = {
			getBounds: () => ({
				getWest: () => current.west,
				getSouth: () => current.south,
				getEast: () => current.east,
				getNorth: () => current.north,
			}),
			on: vi.fn((_event: string, callback: () => void) => {
				moved = callback;
			}),
			off: vi.fn(),
		} as unknown as MapLibreMap;
		const { unmount } = renderHook(() => useVerifiedDangerZones(map, true, false, bounds, "host"), {
			wrapper: queryWrapper(),
		});
		await waitFor(() =>
			expect(routeSafetyService.verifiedZones).toHaveBeenCalledWith(bounds, expect.any(AbortSignal))
		);
		current = { west: 109, south: 16, east: 110, north: 17 };
		act(() => moved());
		await waitFor(
			() =>
				expect(routeSafetyService.verifiedZones).toHaveBeenCalledWith(
					current,
					expect.any(AbortSignal)
				),
			{ timeout: VERIFIED_ZONE_VIEW_DEBOUNCE_MS + 2000 }
		);
		unmount();
		expect(map.off).toHaveBeenCalledWith("moveend", moved);
	});
	it("refreshes approvals and withdrawals while the map stays open", async () => {
		vi.useFakeTimers();
		const { result } = renderHook(() => useVerifiedDangerZones(null, false, true, bounds, "host"), {
			wrapper: queryWrapper(),
		});
		await act(async () => {
			await vi.advanceTimersByTimeAsync(1);
		});
		expect(result.current.data?.features).toHaveLength(1);
		vi.mocked(routeSafetyService.verifiedZones).mockResolvedValue(collection([]));
		await act(async () => {
			await vi.advanceTimersByTimeAsync(VERIFIED_ZONE_REFRESH_MS + 10);
		});
		expect(result.current.data?.features).toEqual([]);
	});
	it("cancels an obsolete viewport request when the map changes", async () => {
		let signal: AbortSignal | undefined;
		vi.mocked(routeSafetyService.verifiedZones).mockImplementation((_bounds, nextSignal) => {
			signal = nextSignal;
			return new Promise(() => {});
		});
		const { rerender } = renderHook(
			({ viewport }) => useVerifiedDangerZones(null, false, true, viewport, "host"),
			{ initialProps: { viewport: bounds }, wrapper: queryWrapper() }
		);
		await waitFor(() => expect(signal).toBeDefined());
		const previous = signal;
		rerender({ viewport: { ...bounds, west: 107 } });
		expect(previous?.aborted).toBe(true);
	});
	it("removes duplicate raw features and aligns fallback markers with letterboxed SVG", () => {
		expect(excludeSafetyFeatures(collection(), [zone.id])?.features).toEqual([]);
		const container = document.createElement("div");
		vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
			width: 400,
			height: 200,
		} as DOMRect);
		expect(projectFallbackPosition([0, 0], "0 0 100 100", container)).toEqual([25, 0]);
		expect(projectFallbackPosition([100, 100], "0 0 100 100", container)).toEqual([75, 100]);
	});
});
