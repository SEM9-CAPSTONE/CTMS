import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EquipmentCatalogItem } from "../types";
import { EditEquipmentCatalogItemDialog } from "./EditEquipmentCatalogItemDialog";

const item: EquipmentCatalogItem = {
	id: "item-1",
	hostId: "host-1",
	name: "4-person tent",
	category: "shelter",
	quantityTotal: 10,
	rentalPricePerDay: 50000,
	status: "active",
	maintenanceSchedule: null,
	createdAt: "2026-09-01T00:00:00.000Z",
	updatedAt: "2026-09-01T00:00:00.000Z",
};

describe("EditEquipmentCatalogItemDialog", () => {
	it("renders nothing when closed or without an item", () => {
		const { container } = render(
			<EditEquipmentCatalogItemDialog
				open={false}
				item={item}
				isSubmitting={false}
				errorMessage={null}
				onClose={vi.fn()}
				onConfirm={vi.fn()}
			/>
		);
		expect(container).toBeEmptyDOMElement();
	});

	it("prefills the current item's values and submits the mapped patch", async () => {
		const onConfirm = vi.fn().mockResolvedValue(undefined);
		render(
			<EditEquipmentCatalogItemDialog
				open
				item={item}
				isSubmitting={false}
				errorMessage={null}
				onClose={vi.fn()}
				onConfirm={onConfirm}
			/>
		);

		expect(screen.getByLabelText("Tên thiết bị")).toHaveValue("4-person tent");
		expect(screen.getByLabelText("Số lượng")).toHaveValue(10);

		fireEvent.change(screen.getByLabelText("Số lượng"), { target: { value: "5" } });
		fireEvent.change(screen.getByLabelText("Trạng thái"), { target: { value: "inactive" } });
		fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

		await waitFor(() =>
			expect(onConfirm).toHaveBeenCalledWith({
				name: "4-person tent",
				category: "shelter",
				quantityTotal: 5,
				rentalPricePerDay: 50000,
				status: "inactive",
				maintenanceSchedule: null,
			})
		);
	});

	it("shows the API error message and closes on cancel", () => {
		const onClose = vi.fn();
		render(
			<EditEquipmentCatalogItemDialog
				open
				item={item}
				isSubmitting={false}
				errorMessage="Bạn không có quyền sửa thiết bị này."
				onClose={onClose}
				onConfirm={vi.fn()}
			/>
		);

		expect(screen.getByRole("alert")).toHaveTextContent("Bạn không có quyền sửa thiết bị này.");
		fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
		expect(onClose).toHaveBeenCalled();
	});
});
