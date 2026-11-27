import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RouteDangerZone, RouteMapMode } from "../types";
import { RouteCheckpointMap } from "./RouteCheckpointMap";
import { RouteGeometryPreview } from "./RouteGeometryPreview";

type Handler = (event?: unknown) => void;
interface NativeMap {
	container: HTMLElement;
	handlers: Map<string, Handler[]>;
	off: ReturnType<typeof vi.fn>;
}
const mocks = vi.hoisted(() => ({ maps: [] as NativeMap[], popupPositions: [] as unknown[] }));
vi.mock("maplibre-gl", () => ({
	setWorkerUrl: vi.fn(),
	Map: class {
		container: HTMLElement;
		painter = {};
		handlers = new Map<string, Handler[]>();
		constructor({ container }: { container: HTMLElement }) {
			this.container = container;
			mocks.maps.push(this);
			container.addEventListener("click", () => {
				for (const handler of this.handlers.get("click") ?? [])
					handler({ lngLat: { lng: 108.3, lat: 16.1 } });
			});
		}
		on(event: string, layerOrHandler: string | Handler, callback?: Handler) {
			const key = typeof layerOrHandler === "string" ? `${event}:${layerOrHandler}` : event;
			const handler = typeof layerOrHandler === "string" ? callback : layerOrHandler;
			if (handler) this.handlers.set(key, [...(this.handlers.get(key) ?? []), handler]);
		}
		once(event: string, handler: Handler) {
			this.on(event, handler);
		}
		off = vi.fn((event: string, layer: string, handler: Handler) => {
			const key = `${event}:${layer}`;
			this.handlers.set(key, this.handlers.get(key)?.filter((value) => value !== handler) ?? []);
		});
		addControl = vi.fn();
		addSource = vi.fn();
		addLayer = vi.fn();
		fitBounds = vi.fn();
		getSource = () => ({ setData: vi.fn() });
		getContainer() {
			return this.container;
		}
		remove = vi.fn();
	},
	Marker: class {
		constructor(private options: { element: HTMLElement }) {}
		setLngLat() {
			return this;
		}
		addTo(map: NativeMap) {
			map.container.append(this.options.element);
			return this;
		}
		remove() {
			this.options.element.remove();
		}
	},
	Popup: class {
		private content?: HTMLElement;
		getElement() {
			return this.content ?? document.createElement("div");
		}
		setMaxWidth() {
			return this;
		}
		setLngLat(position: unknown) {
			mocks.popupPositions.push(position);
			return this;
		}
		setDOMContent(content: HTMLElement) {
			this.content?.remove();
			this.content = content;
			return this;
		}
		addTo(map: NativeMap) {
			if (this.content) map.container.append(this.content);
			return this;
		}
		remove() {
			this.content?.remove();
		}
	},
	NavigationControl: class {},
	setMaxParallelImageRequests: vi.fn(),
}));

const geometry = {
	type: "LineString" as const,
	coordinates: [
		[108.28, 16.1],
		[108.31, 16.12],
	] as [number, number][],
};
const point: RouteDangerZone = {
	id: "11111111-1111-4111-8111-111111111111",
	routeId: "22222222-2222-4222-8222-222222222222",
	geometry: { type: "Point", coordinates: [108.3, 16.11] },
	radiusMeters: 50,
	description: "Lối mòn sát mép vực ở Dốc Vọng Cảnh",
	severity: "high",
	createdAt: "2026-11-16T00:00:00Z",
	updatedAt: "2026-11-16T03:45:00Z",
};
const polygon: RouteDangerZone = {
	...point,
	id: "polygon",
	geometry: {
		type: "Polygon",
		coordinates: [
			[
				[108.28, 16.1],
				[108.3, 16.12],
				[108.31, 16.1],
				[108.28, 16.1],
			],
		],
	},
	radiusMeters: null,
	description: "Đá dễ sạt lở",
	severity: "medium",
};
beforeEach(() => {
	mocks.maps = [];
	mocks.popupPositions = [];
	vi.stubEnv("VITE_MAPTILER_API_KEY", "unit-test");
});
afterEach(() => vi.unstubAllEnvs());

async function loadMap() {
	await waitFor(() => expect(mocks.maps).toHaveLength(1));
	act(() => {
		for (const handler of mocks.maps[0].handlers.get("load") ?? []) handler();
	});
	await screen.findByRole("button", { name: `Điểm nguy hiểm mức cao: ${point.description}` });
	return mocks.maps[0];
}

describe("interactive danger zone details", () => {
	it("shows a visible selected hazard marker on the native map and replaces it when moved", async () => {
		const onSelectLocation = vi.fn();
		const props = {
			geometry,
			checkpoints: [],
			dangerZones: [point],
			radiusMeters: 80,
			mode: "hazard-point" as const,
			onSelectLocation,
		};
		const { rerender } = render(<RouteCheckpointMap {...props} />);
		const map = await loadMap();
		fireEvent.click(map.container);
		expect(onSelectLocation).toHaveBeenCalledWith({ type: "Point", coordinates: [108.3, 16.1] });
		rerender(
			<RouteCheckpointMap
				{...props}
				selectedLocation={{ type: "Point", coordinates: [108.3, 16.1] }}
			/>
		);
		expect(await screen.findByLabelText("Vị trí nguy hiểm đang chọn")).toBeVisible();
		rerender(
			<RouteCheckpointMap
				{...props}
				selectedLocation={{ type: "Point", coordinates: [108.29, 16.11] }}
			/>
		);
		await waitFor(() =>
			expect(screen.getAllByLabelText("Vị trí nguy hiểm đang chọn")).toHaveLength(1)
		);
	});
	it.each(["checkpoint", "hazard-point", "hazard-polygon"] as RouteMapMode[])(
		"opens a persisted marker without selecting a location in %s mode",
		async (mode) => {
			const onSelectLocation = vi.fn();
			const { container, unmount } = render(
				<RouteCheckpointMap
					geometry={geometry}
					checkpoints={[]}
					dangerZones={[point, polygon]}
					radiusMeters={0}
					mode={mode}
					onSelectLocation={onSelectLocation}
				/>
			);
			const map = await loadMap();
			const marker = screen.getByRole("button", {
				name: `Điểm nguy hiểm mức cao: ${point.description}`,
			});
			fireEvent.mouseDown(marker);
			fireEvent.click(marker);
			expect(screen.getByText("Cao", { selector: "dd" })).toBeVisible();
			expect(screen.getByText(point.description)).toBeVisible();
			expect(screen.getByText("50 m")).toBeVisible();
			expect(container.innerHTML).not.toContain(point.id);
			expect(container.innerHTML).not.toContain(point.routeId);
			expect(onSelectLocation).not.toHaveBeenCalled();
			act(() => {
				for (const handler of map.handlers.get("click:route-hazards-fill") ?? [])
					handler({
						features: [{ properties: { id: polygon.id } }],
						lngLat: { lng: 108.29, lat: 16.11 },
					});
			});
			expect(screen.queryByText("Trung bình", { selector: "dd" })).not.toBeInTheDocument();
			unmount();
			expect(map.off).toHaveBeenCalledWith("click", "route-hazards-fill", expect.any(Function));
		}
	);
	it.each(["checkpoint", "preview"])(
		"opens a polygon at the click location in the %s viewing map",
		async (surface) => {
			const zones = [point, polygon];
			const view = render(
				surface === "preview" ? (
					<RouteGeometryPreview geometry={geometry} dangerZones={zones} />
				) : (
					<RouteCheckpointMap
						geometry={geometry}
						checkpoints={[]}
						dangerZones={zones}
						radiusMeters={0}
						disabled
						onSelectLocation={vi.fn()}
					/>
				)
			);
			const map = await loadMap();
			fireEvent.click(
				screen.getByRole("button", { name: `Điểm nguy hiểm mức cao: ${point.description}` })
			);
			expect(screen.getByText("50 m")).toBeVisible();
			const lngLat = { lng: 108.29, lat: 16.11 };
			const layer = surface === "preview" ? "route-preview-hazards-fill" : "route-hazards-fill";
			await waitFor(() => expect(map.handlers.get(`click:${layer}`)).toHaveLength(1));
			act(() => {
				for (const handler of map.handlers.get(`click:${layer}`) ?? [])
					handler({ features: [{ properties: { id: polygon.id } }], lngLat });
			});
			expect(screen.getByText("Trung bình", { selector: "dd" })).toBeVisible();
			expect(screen.getByText(polygon.description)).toBeVisible();
			expect(screen.queryByText("50 m")).not.toBeInTheDocument();
			expect(mocks.popupPositions).toEqual([]);
			view.unmount();
			expect(map.off).toHaveBeenCalledWith("click", layer, expect.any(Function));
		}
	);
});
