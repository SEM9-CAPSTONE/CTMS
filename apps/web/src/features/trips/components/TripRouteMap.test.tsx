import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreatedTrekkingRoute } from "../../trekking-routes/types";
import { TripRouteMap } from "./TripRouteMap";

const state = vi.hoisted(() => ({
	load: undefined as (() => void) | undefined,
	map: {
		on: vi.fn(),
		addControl: vi.fn(),
		addSource: vi.fn(),
		addLayer: vi.fn(),
		getSource: vi.fn(),
		setCenter: vi.fn(),
		remove: vi.fn(),
	},
	source: { setData: vi.fn() },
	marker: {
		setLngLat: vi.fn(),
		addTo: vi.fn(),
		on: vi.fn(),
		remove: vi.fn(),
		setDraggable: vi.fn(),
		getLngLat: vi.fn(),
	},
}));
vi.mock("maplibre-gl", () => ({
	Map: class {
		on = state.map.on;
		addControl = state.map.addControl;
		addSource = state.map.addSource;
		addLayer = state.map.addLayer;
		getSource = state.map.getSource;
		setCenter = state.map.setCenter;
		remove = state.map.remove;
	},
	Marker: class {
		setLngLat = state.marker.setLngLat;
		addTo = state.marker.addTo;
		on = state.marker.on;
		remove = state.marker.remove;
		setDraggable = state.marker.setDraggable;
		getLngLat = state.marker.getLngLat;
	},
	NavigationControl: class {},
}));
vi.mock("../../trekking-routes/utils/map-render-readiness", () => ({
	trackMapRenderReadiness: vi.fn(),
}));
const route: CreatedTrekkingRoute = {
	id: "route-a",
	name: "Route A",
	description: null,
	geometry: {
		type: "LineString",
		coordinates: [
			[108.22, 16.04],
			[108.25, 16.06],
		],
	},
	difficulty: "moderate",
	lengthMeters: 1000,
	expectedDurationMinutes: 60,
	status: "active",
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
};
beforeEach(() => {
	vi.clearAllMocks();
	state.load = undefined;
	vi.stubEnv("VITE_MAPTILER_API_KEY", "test-map-key");
	vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue("Chromium");
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as WebGL2RenderingContext);
	state.map.on.mockImplementation((event: string, callback: () => void) => {
		if (event === "load") state.load = callback;
		return state.map;
	});
	state.map.getSource.mockReturnValue(state.source);
	state.marker.setLngLat.mockReturnValue(state.marker);
	state.marker.addTo.mockReturnValue(state.marker);
	state.marker.on.mockReturnValue(state.marker);
	state.marker.setDraggable.mockReturnValue(state.marker);
});
afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
});
async function ready() {
	await waitFor(() => expect(state.load).toBeDefined());
	act(() => {
		state.load?.();
	});
	await waitFor(() =>
		expect(state.map.setCenter).toHaveBeenCalledWith(route.geometry.coordinates[0])
	);
	state.map.setCenter.mockClear();
}
describe("TripRouteMap camera stability", () => {
	it("updates meeting markers without moving the camera, including when the same route is re-rendered", async () => {
		const change = vi.fn();
		const { rerender } = render(
			<TripRouteMap route={route} meetingPoint={null} onMeetingPointChange={change} />
		);
		await ready();
		rerender(
			<TripRouteMap route={route} meetingPoint={[108.23, 16.05]} onMeetingPointChange={change} />
		);
		await waitFor(() => expect(state.marker.setLngLat).toHaveBeenLastCalledWith([108.23, 16.05]));
		rerender(
			<TripRouteMap
				route={{ ...route }}
				meetingPoint={[108.24, 16.055]}
				onMeetingPointChange={change}
			/>
		);
		await waitFor(() => expect(state.marker.setLngLat).toHaveBeenLastCalledWith([108.24, 16.055]));
		expect(state.map.setCenter).not.toHaveBeenCalled();
	});
	it("keeps the viewport when clearing a meeting point or disabling editing", async () => {
		const change = vi.fn();
		const { rerender } = render(
			<TripRouteMap route={route} meetingPoint={null} onMeetingPointChange={change} />
		);
		await ready();
		rerender(
			<TripRouteMap route={route} meetingPoint={[108.23, 16.05]} onMeetingPointChange={change} />
		);
		await waitFor(() => expect(state.marker.setLngLat).toHaveBeenCalled());
		rerender(
			<TripRouteMap
				route={route}
				meetingPoint={[108.23, 16.05]}
				disabled
				onMeetingPointChange={change}
			/>
		);
		await waitFor(() => expect(state.marker.setDraggable).toHaveBeenLastCalledWith(false));
		rerender(<TripRouteMap route={route} meetingPoint={null} onMeetingPointChange={change} />);
		await waitFor(() => expect(state.marker.remove).toHaveBeenCalled());
		expect(state.map.setCenter).not.toHaveBeenCalled();
	});
	it("moves the camera once when a different route is selected", async () => {
		const change = vi.fn();
		const { rerender } = render(
			<TripRouteMap route={route} meetingPoint={null} onMeetingPointChange={change} />
		);
		await ready();
		const next: CreatedTrekkingRoute = {
			...route,
			id: "route-b",
			geometry: {
				type: "LineString",
				coordinates: [
					[109, 17],
					[109.1, 17.1],
				],
			},
		};
		rerender(<TripRouteMap route={next} meetingPoint={null} onMeetingPointChange={change} />);
		await waitFor(() => expect(state.map.setCenter).toHaveBeenCalledWith([109, 17]));
		expect(state.map.setCenter).toHaveBeenCalledTimes(1);
		rerender(
			<TripRouteMap route={next} meetingPoint={[109.05, 17.05]} onMeetingPointChange={change} />
		);
		await waitFor(() => expect(state.marker.setLngLat).toHaveBeenLastCalledWith([109.05, 17.05]));
		expect(state.map.setCenter).toHaveBeenCalledTimes(1);
	});
});
