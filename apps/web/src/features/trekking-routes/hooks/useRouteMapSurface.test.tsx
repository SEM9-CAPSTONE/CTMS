import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Position } from "../types";
import { useRouteMapSurface } from "./useRouteMapSurface";

interface FakeMap {
	options: { container: HTMLElement; pixelRatio: number; maxTileCacheSize: number };
	handlers: Map<string, (event?: Record<string, unknown>) => void>;
	remove: ReturnType<typeof vi.fn>;
}
const mocks = vi.hoisted(() => ({
	instances: [] as FakeMap[],
	styleLoaded: false,
	throwOnCreate: false,
	missingPainter: false,
}));
vi.mock("maplibre-gl", () => ({
	Map: class {
		readonly handlers = new Map<string, (event?: Record<string, unknown>) => void>();
		readonly painter = mocks.missingPainter ? undefined : {};
		readonly remove;
		readonly addControl = vi.fn();
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
		on(event: string, handler: (event?: Record<string, unknown>) => void) {
			this.handlers.set(event, handler);
		}
		once(event: string, handler: (event?: Record<string, unknown>) => void) {
			this.handlers.set(event, handler);
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
