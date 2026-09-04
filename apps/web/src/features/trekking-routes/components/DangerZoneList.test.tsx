import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RouteDangerZone } from "../types";
import { DangerZoneList } from "./DangerZoneList";

const base = {
	routeId: "route-id",
	description: "Loose rock",
	createdAt: "2026-09-04T00:00:00.000Z",
	updatedAt: "2026-09-04T00:00:00.000Z",
};

describe("DangerZoneList", () => {
	it("renders an explicit empty state", () => {
		render(<DangerZoneList items={[]} />);
		expect(screen.getByTestId("danger-zones-empty")).toBeInTheDocument();
	});

	it("renders Point and Polygon descriptions with readable severity", () => {
		const items: RouteDangerZone[] = [
			{
				...base,
				id: "point",
				geometry: { type: "Point", coordinates: [108.46, 11.94] },
				radiusMeters: 30,
				severity: "low",
			},
			{
				...base,
				id: "polygon",
				geometry: {
					type: "Polygon",
					coordinates: [
						[
							[108.45, 11.94],
							[108.46, 11.95],
							[108.47, 11.94],
							[108.45, 11.94],
						],
					],
				},
				radiusMeters: null,
				severity: "high",
			},
		];
		render(<DangerZoneList items={items} />);
		expect(screen.getByText("Bán kính 30 m")).toBeInTheDocument();
		expect(screen.getByText("Ranh giới đa giác")).toBeInTheDocument();
		expect(screen.getByText("Mức độ Thấp")).toBeInTheDocument();
		expect(screen.getByText("Mức độ Cao")).toBeInTheDocument();
	});
});
