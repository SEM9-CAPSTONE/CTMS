import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreateEquipmentCatalogItemForm } from "./CreateEquipmentCatalogItemForm";

describe("CreateEquipmentCatalogItemForm", () => {
	it("validates fields and submits the exact mapped payload", async () => {
		const submit = vi.fn().mockResolvedValue(null);
		render(
			<CreateEquipmentCatalogItemForm
				isSubmitting={false}
				error={null}
				onSubmit={submit}
				onRetry={vi.fn()}
			/>
		);

		fireEvent.change(screen.getByLabelText("Tên thiết bị"), {
			target: { value: "  4-person tent  " },
		});
		fireEvent.change(screen.getByLabelText("Loại thiết bị"), {
			target: { value: "  shelter  " },
		});
		fireEvent.change(screen.getByLabelText("Số lượng"), { target: { value: "10" } });
		fireEvent.change(screen.getByLabelText("Giá thuê mỗi ngày"), { target: { value: "50000" } });
		fireEvent.click(screen.getByRole("button", { name: "Thêm thiết bị" }));

		await waitFor(() =>
			expect(submit).toHaveBeenCalledWith({
				name: "4-person tent",
				category: "shelter",
				quantityTotal: 10,
				rentalPricePerDay: 50000,
			})
		);
	});

	it("shows an inline validation error and does not submit for a blank name", async () => {
		const submit = vi.fn();
		render(
			<CreateEquipmentCatalogItemForm
				isSubmitting={false}
				error={null}
				onSubmit={submit}
				onRetry={vi.fn()}
			/>
		);

		fireEvent.change(screen.getByLabelText("Loại thiết bị"), { target: { value: "shelter" } });
		fireEvent.change(screen.getByLabelText("Số lượng"), { target: { value: "10" } });
		fireEvent.change(screen.getByLabelText("Giá thuê mỗi ngày"), { target: { value: "50000" } });
		fireEvent.click(screen.getByRole("button", { name: "Thêm thiết bị" }));

		await waitFor(() => expect(screen.getByText("Tên thiết bị là bắt buộc")).toBeInTheDocument());
		expect(submit).not.toHaveBeenCalled();
	});

	it("shows the API error banner with a retry action", () => {
		const retry = vi.fn();
		render(
			<CreateEquipmentCatalogItemForm
				isSubmitting={false}
				error={{ status: 500, message: "Không thể tạo thiết bị.", canRetry: true, fieldErrors: {} }}
				onSubmit={vi.fn()}
				onRetry={retry}
			/>
		);

		expect(screen.getByRole("alert")).toHaveTextContent("Không thể tạo thiết bị.");
		fireEvent.click(screen.getByRole("button", { name: /Thử lại/ }));
		expect(retry).toHaveBeenCalled();
	});
});
