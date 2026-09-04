import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RouteDangerZone } from "../types";
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

	it("distinguishes shelters and renders persisted Point/Polygon hazards with a readable legend", () => {
		const checkpoint = {
			id: "shelter-id",
			routeId: "route-id",
			name: "Storm shelter",
			location: { type: "Point" as const, coordinates: [108.46, 11.94] as [number, number] },
			radiusMeters: 30,
			type: "emergency_shelter" as const,
			expectedArrivalOffset: 30,
			instructions: "Use during storms",
			nearbyWaterOrShelter: true,
			routePosition: 0.5,
			createdAt: "2026-09-04T00:00:00.000Z",
			updatedAt: "2026-09-04T00:00:00.000Z",
		};
		const hazards: RouteDangerZone[] = [
			{
				id: "point",
				routeId: "route-id",
				geometry: { type: "Point", coordinates: [108.455, 11.94] },
				radiusMeters: 40,
				description: "Rockfall",
				severity: "high",
				createdAt: "2026-09-04T00:00:00.000Z",
				updatedAt: "2026-09-04T00:00:00.000Z",
			},
			{
				id: "polygon",
				routeId: "route-id",
				geometry: {
					type: "Polygon",
					coordinates: [
						[
							[108.46, 11.94],
							[108.465, 11.945],
							[108.47, 11.94],
							[108.46, 11.94],
						],
					],
				},
				radiusMeters: null,
				description: "Landslide",
				severity: "medium",
				createdAt: "2026-09-04T00:00:00.000Z",
				updatedAt: "2026-09-04T00:00:00.000Z",
			},
		];
		render(
			<RouteCheckpointMap
				geometry={geometry}
				checkpoints={[checkpoint]}
				dangerZones={hazards}
				radiusMeters={30}
				onSelectLocation={vi.fn()}
			/>
		);
		const shelterMarker = screen.getByTestId("shelter-marker-1");
		const pointRadius = screen.getByTestId("persisted-hazard-point");
		const pointMarker = screen.getByTestId("persisted-hazard-point-marker-point");
		const polygon = screen.getByTestId("persisted-hazard-polygon");
		expect(shelterMarker).toHaveTextContent("S");
		expect(pointRadius).toHaveAttribute("fill", "#dc2626");
		expect(pointRadius).toHaveAttribute("fill-opacity", "0.44");
		expect(pointRadius).toHaveAttribute("stroke", "#172554");
		expect(pointRadius).toHaveAttribute("stroke-width", "0.9");
		expect(pointRadius).toHaveAttribute("data-severity", "high");
		expect(pointMarker).toHaveTextContent("!");
		expect(pointMarker).toHaveAttribute("data-severity", "high");
		expect(pointMarker).toHaveAccessibleName("Điểm nguy hiểm mức cao: Rockfall");
		expect(polygon).toHaveAttribute("fill-opacity", "0.28");
		expect(polygon).toHaveAttribute("stroke", "#991b1b");
		expect(polygon).toHaveAttribute("stroke-width", "0.45");
		expect(screen.getByLabelText("Chú giải an toàn")).toHaveTextContent("Nơi trú ẩn");
		expect(screen.getByLabelText("Chú giải an toàn")).toHaveTextContent("Nguy hiểm thấp");
		expect(screen.getByLabelText("Chú giải an toàn")).toHaveTextContent("Trung bình");
		expect(screen.getByLabelText("Chú giải an toàn")).toHaveTextContent("Cao");
	});

	it("supports Point preview and deterministic Polygon vertex selection", () => {
		const onSelect = vi.fn();
		const { rerender } = render(
			<RouteCheckpointMap
				geometry={geometry}
				checkpoints={[]}
				mode="hazard-point"
				proposedHazard={{ type: "Point", coordinates: [108.46, 11.94] }}
				proposedHazardRadiusMeters={50}
				radiusMeters={30}
				onSelectLocation={onSelect}
			/>
		);
		const preview = screen.getByTestId("proposed-hazard-preview");
		expect(preview).toHaveAttribute("fill", "#7c3aed");
		expect(preview).toHaveAttribute("fill-opacity", "0.25");
		expect(preview).toHaveAttribute("stroke", "#6d28d9");
		expect(preview).toHaveAttribute("stroke-dasharray", "1 1");
		rerender(
			<RouteCheckpointMap
				geometry={geometry}
				checkpoints={[]}
				mode="hazard-polygon"
				polygonVertices={[
					[108.455, 11.94],
					[108.46, 11.945],
				]}
				radiusMeters={30}
				onSelectLocation={onSelect}
			/>
		);
		const map = screen.getByLabelText("Bản đồ vẽ đa giác nguy hiểm");
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
		fireEvent.click(map, { clientX: 70, clientY: 40 });
		expect(onSelect).toHaveBeenCalledWith({ type: "Point", coordinates: expect.any(Array) });
		expect(screen.getByTestId("draft-hazard-polygon")).toBeInTheDocument();
		expect(screen.getByTestId("polygon-vertex-2")).toBeInTheDocument();
	});
});
