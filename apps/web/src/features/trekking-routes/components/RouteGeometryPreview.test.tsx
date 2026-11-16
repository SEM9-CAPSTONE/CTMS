import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RouteDangerZone } from "../types";
import { RouteGeometryPreview } from "./RouteGeometryPreview";

describe("RouteGeometryPreview", () => {
	it("shows danger zone details from fallback markers and polygon fills", () => {
		vi.stubEnv("VITE_MAPTILER_API_KEY", "");
		const point: RouteDangerZone = {
			id: "point",
			routeId: "route",
			geometry: { type: "Point", coordinates: [108.2, 16.05] },
			severity: "high",
			radiusMeters: 50,
			description: "Lối mòn sát mép vực",
			createdAt: "2026-11-16T00:00:00Z",
			updatedAt: "2026-11-16T00:00:00Z",
		};
		const polygon: RouteDangerZone = {
			...point,
			id: "polygon",
			geometry: {
				type: "Polygon",
				coordinates: [
					[
						[108.2, 16.05],
						[108.21, 16.06],
						[108.22, 16.05],
						[108.2, 16.05],
					],
				],
			},
			radiusMeters: null,
			severity: "medium",
			description: "Đá dễ sạt lở",
		};
		render(
			<RouteGeometryPreview
				geometry={{
					type: "LineString",
					coordinates: [
						[108.2, 16.05],
						[108.23, 16.08],
					],
				}}
				dangerZones={[point, polygon]}
			/>
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Điểm nguy hiểm mức cao: Lối mòn sát mép vực" })
		);
		expect(screen.getByText("Cao", { selector: "dd" })).toBeVisible();
		expect(screen.getByText("50 m")).toBeVisible();
		fireEvent.click(screen.getByTestId("route-preview-hazard-polygon"));
		expect(screen.getByText("Trung bình", { selector: "dd" })).toBeVisible();
		expect(screen.getByText("Đá dễ sạt lở")).toBeVisible();
		expect(screen.queryByText(/Bán kính ghi nhận/)).not.toBeInTheDocument();
	});
	afterEach(() => vi.unstubAllEnvs());

	it("renders the full route geometry in the no-key fallback", () => {
		vi.stubEnv("VITE_MAPTILER_API_KEY", "");
		render(
			<RouteGeometryPreview
				geometry={{
					type: "LineString",
					coordinates: [
						[108.2, 16.05],
						[108.21, 16.06],
						[108.23, 16.08],
					],
				}}
			/>
		);

		const line = screen.getByTestId("route-preview-line");
		expect(line.getAttribute("points")?.trim().split(/\s+/)).toHaveLength(3);
		expect(screen.queryByText(/Bắt đầu:|Kết thúc:/)).not.toBeInTheDocument();
	});
});
