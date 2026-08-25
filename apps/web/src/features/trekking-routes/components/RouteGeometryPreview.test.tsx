import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouteGeometryPreview } from "./RouteGeometryPreview";

describe("RouteGeometryPreview", () => {
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
		expect(screen.getByText("Bắt đầu: 108.2, 16.05")).toBeInTheDocument();
		expect(screen.getByText("Kết thúc: 108.23, 16.08")).toBeInTheDocument();
	});
});
