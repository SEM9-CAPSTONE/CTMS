import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { GeoJsonLineString, Position } from "../types";
import { useRouteGeometryMap } from "./useRouteGeometryMap";
import { useRouteMapSurface } from "./useRouteMapSurface";

interface FakeMap {
	options: { container: HTMLElement; pixelRatio: number; maxTileCacheSize: number };
	handlers: Map<string, (event?: Record<string, unknown>) => void>;
	remove: ReturnType<typeof vi.fn>;
	setData: ReturnType<typeof vi.fn>;
}
interface FakeMarker {
	element: HTMLElement;
	draggable: boolean;
	position: Position;
	dragEnd?: () => void;
	remove: ReturnType<typeof vi.fn>;
}
const mocks = vi.hoisted(() => ({
	instances: [] as FakeMap[],
	markers: [] as FakeMarker[],
	styleLoaded: false,
	throwOnCreate: false,
	missingPainter: false,
}));
vi.mock("maplibre-gl", () => ({
	setWorkerUrl: vi.fn(),
	Map: class {
		readonly handlers = new Map<string, (event?: Record<string, unknown>) => void>();
		readonly painter = mocks.missingPainter ? undefined : {};
		readonly remove;
		readonly addControl = vi.fn();
		readonly addSource = vi.fn();
		readonly addLayer = vi.fn();
		readonly setData = vi.fn();
		readonly resize = vi.fn();
		constructor(readonly options: FakeMap["options"]) {
			options.container.append(document.createElement("canvas"));
			if (mocks.throwOnCreate) throw new Error("WebGL2 unavailable");
			this.remove = vi.fn(() => options.container.replaceChildren());
			mocks.instances.push(this);
		}
		isStyleLoaded() {
			return mocks.styleLoaded;
		}
		getSource() {
			return { setData: this.setData };
		}
		on(event: string, handler: (event?: Record<string, unknown>) => void) {
			this.handlers.set(event, handler);
		}
		once(event: string, handler: (event?: Record<string, unknown>) => void) {
			this.handlers.set(event, handler);
		}
	},
	Marker: class implements FakeMarker {
		element: HTMLElement;
		draggable: boolean;
		position: Position = [0, 0];
		dragEnd?: () => void;
		remove = vi.fn();
		constructor({ element, draggable }: { element: HTMLElement; draggable: boolean }) {
			this.element = element;
			this.draggable = draggable;
			mocks.markers.push(this);
		}
		setLngLat(position: Position) {
			this.position = position;
			return this;
		}
		addTo() {
			return this;
		}
		getLngLat() {
			return { lng: this.position[0], lat: this.position[1] };
		}
		on(event: string, handler: () => void) {
			if (event === "dragend") this.dragEnd = handler;
			return this;
		}
	},
	NavigationControl: class {},
	setMaxParallelImageRequests: vi.fn(),
}));
interface Props {
	center: Position;
	onLoad: () => void;
}
function Surface({ center, onLoad }: Props) {
	const surface = useRouteMapSurface(onLoad, undefined, center);
	return (
		<section>
			<div data-testid="native-host" ref={surface.containerRef} />
			<output>{surface.fallback ? "fallback" : "map"}</output>
			<span>React overlay</span>
		</section>
	);
}
beforeEach(() => {
	vi.stubEnv("VITE_MAPTILER_API_KEY", "unit-test");
	mocks.instances = [];
	mocks.markers = [];
	mocks.styleLoaded = false;
	mocks.throwOnCreate = false;
	mocks.missingPainter = false;
});
afterEach(() => vi.unstubAllEnvs());

it("reuses one context when the selected route or callbacks change", async () => {
	const firstLoad = vi.fn();
	const view = render(<Surface center={[108, 16]} onLoad={firstLoad} />);
	await waitFor(() => expect(mocks.instances).toHaveLength(1));
	const native = mocks.instances[0];
	const latestLoad = vi.fn();
	view.rerender(<Surface center={[107, 15]} onLoad={latestLoad} />);
	act(() => native.handlers.get("load")?.());
	expect(latestLoad).toHaveBeenCalledOnce();
	expect(firstLoad).not.toHaveBeenCalled();
	expect(mocks.instances).toHaveLength(1);
	expect(native.remove).not.toHaveBeenCalled();
	expect(native.options.pixelRatio).toBeLessThanOrEqual(1.5);
	expect(native.options.maxTileCacheSize).toBe(64);
	view.unmount();
	expect(native.remove).toHaveBeenCalledOnce();
});

it("updates the full native line with only waypoint markers and commits a move at dragend", async () => {
	const waypoints: Position[] = [
		[108, 16],
		[108.01, 16.01],
	];
	const onChange = vi.fn();
	function EditorSurface({ geometry }: { geometry: GeoJsonLineString }) {
		const surface = useRouteGeometryMap(geometry, waypoints, false, onChange, vi.fn());
		return <div ref={surface.containerRef} />;
	}
	const view = render(<EditorSurface geometry={{ type: "LineString", coordinates: waypoints }} />);
	await waitFor(() => expect(mocks.instances).toHaveLength(1));
	const native = mocks.instances[0];
	act(() => native.handlers.get("load")?.());
	await waitFor(() => expect(mocks.markers).toHaveLength(2));
	const geometry: GeoJsonLineString = {
		type: "LineString",
		coordinates: [waypoints[0], [108, 16.01], waypoints[1]],
	};
	view.rerender(<EditorSurface geometry={geometry} />);
	expect(native.setData).toHaveBeenLastCalledWith(expect.objectContaining({ geometry }));
	expect(mocks.instances).toHaveLength(1);
	expect(mocks.markers.map((marker) => marker.element.ariaLabel)).toEqual([
		"Điểm bắt đầu",
		"Điểm kết thúc",
	]);
	expect(mocks.markers.every((marker) => marker.draggable)).toBe(true);
	mocks.markers[1].position = [108.012, 16.011];
	expect(onChange).not.toHaveBeenCalled();
	act(() => mocks.markers[1].dragEnd?.());
	expect(onChange).toHaveBeenCalledWith([waypoints[0], [108.012, 16.011]]);
	view.unmount();
	expect(mocks.markers.every((marker) => marker.remove.mock.calls.length === 1)).toBe(true);
});

it("keeps the native map after an individual tile fails", async () => {
	render(<Surface center={[108, 16]} onLoad={vi.fn()} />);
	await waitFor(() => expect(mocks.instances).toHaveLength(1));
	const native = mocks.instances[0];
	act(() => native.handlers.get("error")?.({ sourceId: "satellite", tile: {} }));
	expect(screen.getByText("map")).toBeInTheDocument();
	expect(native.remove).not.toHaveBeenCalled();
});

it("releases the map once on context loss and preserves the React overlay", async () => {
	render(<Surface center={[108, 16]} onLoad={vi.fn()} />);
	await waitFor(() => expect(mocks.instances).toHaveLength(1));
	const native = mocks.instances[0];
	act(() => native.handlers.get("webglcontextlost")?.());
	await waitFor(() => expect(screen.getByText("fallback")).toBeInTheDocument());
	expect(native.remove).toHaveBeenCalledOnce();
	expect(screen.getByTestId("native-host").querySelector("canvas")).toBeNull();
	expect(screen.getByText("React overlay")).toBeInTheDocument();
	expect(mocks.instances).toHaveLength(1);
});

it("cleans up a partial constructor failure without retrying in a loop", async () => {
	mocks.throwOnCreate = true;
	render(<Surface center={[108, 16]} onLoad={vi.fn()} />);
	await waitFor(() => expect(screen.getByText("fallback")).toBeInTheDocument());
	expect(screen.getByTestId("native-host").querySelector("canvas")).toBeNull();
	expect(screen.getByText("React overlay")).toBeInTheDocument();
});

it("uses fallback when the native constructor returns without a renderer", async () => {
	mocks.missingPainter = true;
	render(<Surface center={[108, 16]} onLoad={vi.fn()} />);
	await waitFor(() => expect(screen.getByText("fallback")).toBeInTheDocument());
	expect(mocks.instances).toHaveLength(1);
	expect(mocks.instances[0].remove).toHaveBeenCalledOnce();
	expect(screen.getByTestId("native-host").querySelector("canvas")).toBeNull();
});
