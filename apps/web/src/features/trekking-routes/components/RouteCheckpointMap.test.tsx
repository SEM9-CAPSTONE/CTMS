import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RouteCheckpointMap } from "./RouteCheckpointMap";

vi.mock("../utils/route-map", () => ({
	DEFAULT_ROUTE_CENTER: [108.45, 11.94],
	getRouteMapStyleUrl: () => undefined,
}));

const geometry = {
	type: "LineString" as const,
	coordinates: [
		[108.45, 11.94],
		[108.47, 11.94],
	] as [number, number][],
};

describe("RouteCheckpointMap fallback", () => {
	it("selects a canonical Point and renders a geodesic radius area", () => {
		const onSelect = vi.fn();
		render(
			<RouteCheckpointMap
				geometry={geometry}
				checkpoints={[]}
				radiusMeters={30}
				onSelectLocation={onSelect}
			/>
		);
		const map = screen.getByLabelText("Bản đồ chọn checkpoint");
		vi.spyOn(map, "getBoundingClientRect").mockReturnValue({
			left: 0,
			top: 0,
			width: 100,
			height: 100,
			right: 100,
			bottom: 100,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		});
		fireEvent.click(map, { clientX: 50, clientY: 50 });
		expect(onSelect).toHaveBeenCalledWith({ type: "Point", coordinates: expect.any(Array) });

		const selected = { type: "Point" as const, coordinates: [108.46, 11.94] as [number, number] };
		const { rerender } = render(
			<RouteCheckpointMap
				geometry={geometry}
				checkpoints={[]}
				radiusMeters={30}
				selectedLocation={selected}
				onSelectLocation={onSelect}
			/>
		);
		rerender(
			<RouteCheckpointMap
				geometry={geometry}
				checkpoints={[]}
				radiusMeters={80}
				selectedLocation={selected}
				onSelectLocation={onSelect}
			/>
		);
		expect(screen.getAllByTestId("checkpoint-radius-circle").at(-1)).toBeInTheDocument();
	});

	it("renders existing markers numbered in server array order and disables selection", () => {
		const onSelect = vi.fn();
		const checkpoint = (id: string, longitude: number) => ({
			id,
			routeId: "route-id",
			name: id,
			location: { type: "Point" as const, coordinates: [longitude, 11.94] as [number, number] },
			radiusMeters: 30,
			type: "rest" as const,
			expectedArrivalOffset: 10,
			instructions: "Rest",
			nearbyWaterOrShelter: false,
			routePosition: 0.5,
			createdAt: "2026-08-25T00:00:00.000Z",
			updatedAt: "2026-08-25T00:00:00.000Z",
		});
		render(
			<RouteCheckpointMap
				geometry={geometry}
				checkpoints={[checkpoint("first", 108.452), checkpoint("second", 108.468)]}
				radiusMeters={30}
				disabled
				onSelectLocation={onSelect}
			/>
		);
		expect(screen.getByTestId("checkpoint-marker-1")).toHaveTextContent("1");
		expect(screen.getByTestId("checkpoint-marker-2")).toHaveTextContent("2");
		fireEvent.click(screen.getByLabelText("Bản đồ chọn checkpoint"));
		expect(onSelect).not.toHaveBeenCalled();
	});
});
