import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { MapLayerMouseEvent, Map as MapLibreMap } from "maplibre-gl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RouteGeometryEditor } from "../trekking-routes/components/RouteGeometryEditor";
import { RouteGeometryPreview } from "../trekking-routes/components/RouteGeometryPreview";
import type { GeoJsonLineString, RouteDangerZone } from "../trekking-routes/types";
import { SafetyDetailsModal } from "./components/SafetyDetailsModal";
import { SafetyMapFallback } from "./components/SafetyMapFallback";
import { useSafetyMapSymbols } from "./hooks/useSafetyMapSymbols";
import type { SafetyFeature } from "./types";

vi.mock("maplibre-gl", () => ({
	setWorkerUrl: vi.fn(),
	Marker: class {
		constructor(private options: { element: HTMLElement }) {}
		setLngLat() {
			return this;
		}
		addTo(map: { container: HTMLElement }) {
			map.container.append(this.options.element);
			return this;
		}
		remove() {
			this.options.element.remove();
		}
	},
	Popup: class {
		private element = document.createElement("div");
		setLngLat() {
			return this;
		}
		setDOMContent(content: HTMLElement) {
			const close = document.createElement("button");
			close.className = "maplibregl-popup-close-button";
			close.ariaLabel = "Close popup";
			this.element.replaceChildren(content, close);
			return this;
		}
		getElement() {
			return this.element;
		}
		addTo(map: { container: HTMLElement }) {
			map.container.append(this.element);
			return this;
		}
		remove() {
			this.element.remove();
		}
	},
}));
vi.mock("./hooks/useRouteSafety", () => ({
	useRouteSafety: () => ({
		data: { features: { type: "FeatureCollection", features: [point] } },
		valid: true,
		pending: false,
		isFetching: false,
		isError: false,
		refetch: vi.fn(),
	}),
}));

const line: GeoJsonLineString = {
	type: "LineString",
	coordinates: [
		[108, 12],
		[108.01, 12],
	],
};
const point: SafetyFeature = {
	type: "Feature",
	id: "host:11111111-1111-4111-8111-111111111111",
	geometry: { type: "Point", coordinates: [108.005, 12.001] },
	properties: {
		sourceType: "HOST_DEFINED",
		source: "CTMS",
		sourceReference: "11111111-1111-4111-8111-111111111111",
		routeName: "Đường rừng ven suối",
		hazardType: "host_defined",
		severity: "HIGH",
		geometryRole: "host_defined_area",
		description: `Lối mòn sát mép vực ở Dốc Vọng Cảnh.\n${"Đi theo cọc tiêu đỏ, tránh rẽ vào đường nhánh. ".repeat(5)}`,
		observedAt: "2026-11-16T00:00:00Z",
		issuedAt: null,
		fetchedAt: null,
		validFrom: null,
		validUntil: null,
		updatedAt: "2026-11-16T03:45:00Z",
		lifecycleStatus: "ACTIVE",
		verificationStatus: "UNVERIFIED",
		accuracyMeters: null,
		distanceMeters: 110,
		intersects: false,
		radiusMeters: 50,
	},
};
const polygon: SafetyFeature = {
	...point,
	id: "host:polygon",
	geometry: {
		type: "Polygon",
		coordinates: [
			[
				[108.004, 12.001],
				[108.006, 12.001],
				[108.006, 12.002],
				[108.004, 12.001],
			],
		],
	},
	properties: { ...point.properties, description: "Sườn dốc dễ sạt lở", radiusMeters: null },
};
beforeEach(() => vi.stubEnv("VITE_MAPTILER_API_KEY", ""));
afterEach(() => vi.unstubAllEnvs());

describe("nearby saved route zones", () => {
	it("shows complete provenance and local update time without exposing identifiers or interpreting HTML", () => {
		const feature: SafetyFeature = {
			...point,
			properties: {
				...point.properties,
				description: `${point.properties.description}<img src=x onerror="alert(1)">`,
			},
		};
		const view = render(<SafetyDetailsModal feature={feature} onClose={vi.fn()} />);
		const content = screen.getByRole("dialog");
		expect(content).toHaveTextContent("Thông tin điểm nguy hiểm");
		expect(content).toHaveTextContent("Đường rừng ven suối");
		expect(content).toHaveTextContent("Cao");
		expect(content).toHaveTextContent("Chưa xác minh");
		expect(content).toHaveTextContent("50 m");
		expect(content).toHaveTextContent("16/11/2026");
		expect(content).toHaveTextContent("10:45");
		expect(content.textContent).toContain(point.properties.description);
		expect(content.querySelector("img")).toBeNull();
		expect(content.outerHTML).not.toContain(point.properties.sourceReference);
		view.rerender(<SafetyDetailsModal feature={polygon} onClose={vi.fn()} />);
		expect(screen.getByRole("dialog")).not.toHaveTextContent("Bán kính ghi nhận");
	});
	it("opens saved marker details in the route editor without adding or moving a vertex", () => {
		const onChange = vi.fn();
		render(<RouteGeometryEditor value={line} onChange={onChange} />);
		const marker = screen.getByRole("button", { name: /Lối mòn sát mép vực ở Dốc Vọng Cảnh/ });
		fireEvent.pointerDown(marker);
		fireEvent.click(marker);
		expect(screen.getByRole("dialog")).toHaveTextContent("Đường rừng ven suối");
		expect(onChange).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Đóng thông tin" }));
		expect(onChange).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Bản đồ vẽ tuyến" }));
		expect(onChange).toHaveBeenCalledOnce();
	});
	it("opens fallback polygon details only outside drawing mode", () => {
		const props = {
			data: { type: "FeatureCollection" as const, features: [polygon] },
			project: (position: [number, number]) => position,
		};
		const { rerender } = render(<SafetyMapFallback {...props} />);
		fireEvent.click(screen.getByRole("button", { name: polygon.properties.description }));
		expect(screen.getByRole("dialog")).toHaveTextContent("Chưa xác minh");
		fireEvent.click(screen.getByRole("button", { name: "Đóng thông tin" }));
		rerender(<SafetyMapFallback {...props} areaClicksEnabled={false} />);
		expect(
			screen.queryByRole("button", { name: polygon.properties.description })
		).not.toBeInTheDocument();
	});
	it("renders a persisted zone once while retaining a nearby zone from another own route", () => {
		const persisted: RouteDangerZone = {
			id: point.properties.sourceReference,
			routeId: "route",
			geometry: { type: "Point", coordinates: [108.005, 12.001] },
			radiusMeters: 50,
			description: point.properties.description,
			severity: "high",
			createdAt: point.properties.observedAt ?? "",
			updatedAt: point.properties.updatedAt,
		};
		const nearby: SafetyFeature = {
			...point,
			id: "host:nearby",
			properties: { ...point.properties, description: "Đoạn dốc trơn trượt" },
		};
		render(
			<RouteGeometryPreview
				geometry={line}
				dangerZones={[persisted]}
				safetyFeatures={{ type: "FeatureCollection", features: [point, nearby] }}
			/>
		);
		expect(screen.getAllByRole("button", { name: /Lối mòn sát mép vực/ })).toHaveLength(1);
		expect(screen.getByRole("button", { name: nearby.properties.description })).toBeVisible();
	});
	it.each([true, false])(
		"preserves native marker clicks and enables polygon detail clicks=%s",
		async (areaClicksEnabled) => {
			const container = document.createElement("div");
			document.body.append(container);
			const draw = vi.fn();
			container.addEventListener("click", draw);
			const native = {
				container,
				on: vi.fn<
					(event: string, layer: string, handler: (event: MapLayerMouseEvent) => void) => void
				>(),
				off: vi.fn(),
			};
			function NativeDetails() {
				const details = useSafetyMapSymbols(
					native as unknown as MapLibreMap,
					true,
					{ type: "FeatureCollection", features: [point, polygon] },
					areaClicksEnabled
				);
				return details.feature ? (
					<SafetyDetailsModal feature={details.feature} onClose={details.onClose} />
				) : null;
			}
			const view = render(<NativeDetails />);
			try {
				await waitFor(() =>
					expect(container.querySelector("button[data-safety-symbol]")).not.toBeNull()
				);
				const marker = container.querySelector<HTMLButtonElement>("button[data-safety-symbol]");
				if (!marker) throw new Error("Expected a saved hazard marker");
				fireEvent.pointerDown(marker);
				fireEvent.click(marker);
				expect(draw).not.toHaveBeenCalled();
				expect(screen.getByRole("dialog")).toHaveTextContent("Đường rừng ven suối");
				expect(container.querySelector('[role="dialog"]')).toBeNull();
				expect(screen.getByRole("button", { name: "Đóng thông tin" })).toBeInTheDocument();
				const click = native.on.mock.calls.find(
					([event, layer]) => event === "click" && layer.endsWith("-fill")
				);
				if (areaClicksEnabled) {
					expect(click).toBeDefined();
					act(() =>
						click?.[2]({
							features: [{ id: polygon.id }],
							lngLat: { lng: 108.005, lat: 12.001 },
						} as unknown as MapLayerMouseEvent)
					);
					expect(screen.getByRole("dialog")).toHaveTextContent(polygon.properties.description);
				} else expect(click).toBeUndefined();
			} finally {
				view.unmount();
				container.remove();
			}
		}
	);
});
