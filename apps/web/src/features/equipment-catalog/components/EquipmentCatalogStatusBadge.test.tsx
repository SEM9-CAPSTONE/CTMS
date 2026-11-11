import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EquipmentCatalogStatusBadge } from "./EquipmentCatalogStatusBadge";

describe("EquipmentCatalogStatusBadge", () => {
	it.each([
		["active", "Đang hoạt động"],
		["inactive", "Ngừng hoạt động"],
		["retired", "Đã ngừng sử dụng"],
	] as const)("renders the Vietnamese label for status %s", (status, label) => {
		render(<EquipmentCatalogStatusBadge status={status} />);
		expect(screen.getByText(label)).toBeInTheDocument();
	});
});
