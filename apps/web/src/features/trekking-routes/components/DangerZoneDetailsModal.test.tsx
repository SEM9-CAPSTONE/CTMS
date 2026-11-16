import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RouteDangerZone } from "../types";
import { DangerZoneDetailsModal } from "./DangerZoneDetailsModal";

const zone: RouteDangerZone = {
	id: "11111111-1111-4111-8111-111111111111",
	routeId: "22222222-2222-4222-8222-222222222222",
	geometry: { type: "Point", coordinates: [108.29, 16.11] },
	radiusMeters: 50,
	description: "Đi theo cọc tiêu đỏ, tránh mép vực.",
	severity: "high",
	createdAt: "2026-11-16T00:00:00Z",
	updatedAt: "2026-11-16T03:45:00Z",
};
describe("DangerZoneDetailsModal", () => {
	it("uses the shared modal outside the map, separates display radius and preserves recorded facts", () => {
		const close = vi.fn();
		const { container } = render(<DangerZoneDetailsModal zone={zone} onClose={close} />);
		const dialog = screen.getByRole("dialog", { name: "Thông tin điểm nguy hiểm" });
		expect(container).not.toContainElement(dialog);
		expect(dialog).toHaveTextContent("Bán kính ghi nhận50 m");
		expect(dialog).toHaveTextContent("Vòng đánh dấu trên bản đồ5 m");
		expect(dialog).toHaveTextContent(zone.description);
		expect(dialog).toHaveTextContent("16/11/2026");
		expect(dialog).toHaveTextContent("10:45");
		expect(dialog.outerHTML).not.toContain(zone.id);
		expect(dialog.outerHTML).not.toContain(zone.routeId);
		expect(screen.getByRole("button", { name: "Đóng thông tin" })).toHaveFocus();
		fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
		expect(close).toHaveBeenCalledOnce();
	});
	it("renders descriptions as text, omits a polygon radius and closes on Escape", () => {
		const close = vi.fn();
		const polygon: RouteDangerZone = {
			...zone,
			geometry: {
				type: "Polygon",
				coordinates: [
					[
						[108, 16],
						[109, 16],
						[109, 17],
						[108, 16],
					],
				],
			},
			radiusMeters: null,
			description: 'Đá dễ sạt lở <img src=x onerror="alert(1)">',
		};
		render(<DangerZoneDetailsModal zone={polygon} onClose={close} />);
		const dialog = screen.getByRole("dialog");
		expect(dialog).toHaveTextContent(polygon.description);
		expect(dialog.querySelector("img")).toBeNull();
		expect(dialog).not.toHaveTextContent("Bán kính");
		fireEvent.keyDown(window, { key: "Escape" });
		expect(close).toHaveBeenCalledOnce();
	});
});
