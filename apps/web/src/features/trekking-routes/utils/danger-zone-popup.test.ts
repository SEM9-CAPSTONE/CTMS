import { describe, expect, it } from "vitest";
import type { RouteDangerZone } from "../types";
import { dangerZonePopupContent } from "./danger-zone-popup";

const zone: RouteDangerZone = {
	id: "11111111-1111-4111-8111-111111111111",
	routeId: "22222222-2222-4222-8222-222222222222",
	geometry: { type: "Point", coordinates: [108.3, 16.1] },
	radiusMeters: 50,
	description: "Lối mòn sát mép vực ở Dốc Vọng Cảnh\nTrơn trượt sau mưa.",
	severity: "high",
	createdAt: "2026-11-15T00:00:00Z",
	updatedAt: "2026-11-16T03:45:00Z",
};

describe("dangerZonePopupContent", () => {
	it.each([
		["low", "Thấp"],
		["medium", "Trung bình"],
		["high", "Cao"],
	] as const)(
		"renders %s severity, radius and local update time without identifiers",
		(severity, label) => {
			const content = dangerZonePopupContent({ ...zone, severity });
			expect(content).toHaveTextContent("Điểm nguy hiểm");
			expect(content).toHaveTextContent(`Mức độ: ${label}`);
			expect(content.textContent).toContain(zone.description);
			expect(content).toHaveTextContent("Bán kính: 50 m");
			expect(content).toHaveTextContent("Cập nhật: 16/11/2026 10:45");
			expect(content.outerHTML).not.toContain(zone.id);
			expect(content.outerHTML).not.toContain(zone.routeId);
		}
	);
	it("omits radius for a polygon and treats descriptions as plain text", () => {
		const description = '<img src=x onerror="alert(1)">\nĐá dễ sạt lở.';
		const content = dangerZonePopupContent({
			...zone,
			geometry: { type: "Polygon", coordinates: [] },
			radiusMeters: null,
			description,
		});
		expect(content.textContent).toContain(description);
		expect(content.querySelector("img")).toBeNull();
		expect(content).not.toHaveTextContent("Bán kính:");
		expect(content.querySelector("p.whitespace-pre-wrap")).not.toBeNull();
	});
});
