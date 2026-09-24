import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EquipmentCatalogItem } from "../types";
import { EquipmentCatalogList } from "./EquipmentCatalogList";

const items: EquipmentCatalogItem[] = [
	{
		id: "item-1",
		hostId: "host-1",
		name: "4-person tent",
		category: "shelter",
		quantityTotal: 10,
		rentalPricePerDay: 50000,
		status: "active",
		maintenanceSchedule: "Check zippers monthly",
		createdAt: "2026-09-01T00:00:00.000Z",
		updatedAt: "2026-09-01T00:00:00.000Z",
	},
];

describe("EquipmentCatalogList", () => {
	it("renders each item's fields and status badge", () => {
		render(<EquipmentCatalogList items={items} onEdit={vi.fn()} />);

		expect(screen.getByText("4-person tent")).toBeInTheDocument();
		expect(screen.getByText("shelter")).toBeInTheDocument();
		expect(screen.getByText("Đang hoạt động")).toBeInTheDocument();
		expect(screen.getByText("Số lượng: 10")).toBeInTheDocument();
		expect(screen.getByText("Check zippers monthly", { exact: false })).toBeInTheDocument();
	});

	it("calls onEdit with the clicked item", () => {
		const onEdit = vi.fn();
		render(<EquipmentCatalogList items={items} onEdit={onEdit} />);

		fireEvent.click(screen.getByRole("button", { name: "Sửa" }));

		expect(onEdit).toHaveBeenCalledWith(items[0]);
	});
});
