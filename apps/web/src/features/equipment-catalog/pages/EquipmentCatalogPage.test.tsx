import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEquipmentCatalog } from "../hooks/useEquipmentCatalog";
import { useUpdateEquipmentCatalogItem } from "../hooks/useUpdateEquipmentCatalogItem";
import type { EquipmentCatalogItem } from "../types";
import { EquipmentCatalogPage } from "./EquipmentCatalogPage";

vi.mock("../hooks/useEquipmentCatalog", () => ({ useEquipmentCatalog: vi.fn() }));
vi.mock("../hooks/useUpdateEquipmentCatalogItem", () => ({
	useUpdateEquipmentCatalogItem: vi.fn(),
}));

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

describe("EquipmentCatalogPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(useUpdateEquipmentCatalogItem).mockReturnValue({
			isSubmitting: false,
			error: null,
			submit: vi.fn(),
			reset: vi.fn(),
		});
	});

	it("shows an empty state when the Host has no items", () => {
		vi.mocked(useEquipmentCatalog).mockReturnValue({
			items: [],
			isLoading: false,
			error: "",
			retry: vi.fn(),
		});
		render(<EquipmentCatalogPage />);

		expect(screen.getByTestId("equipment-catalog-empty")).toBeInTheDocument();
	});

	it("shows the loading state", () => {
		vi.mocked(useEquipmentCatalog).mockReturnValue({
			items: [],
			isLoading: true,
			error: "",
			retry: vi.fn(),
		});
		render(<EquipmentCatalogPage />);

		expect(screen.getByTestId("equipment-catalog-loading")).toBeInTheDocument();
	});

	it("shows the error state with a retry action", () => {
		const retry = vi.fn();
		vi.mocked(useEquipmentCatalog).mockReturnValue({
			items: [],
			isLoading: false,
			error: "Không thể tải kho thiết bị. Vui lòng thử lại.",
			retry,
		});
		render(<EquipmentCatalogPage />);

		fireEvent.click(screen.getByRole("button", { name: /Tải lại/ }));
		expect(retry).toHaveBeenCalled();
	});

	it("opens the edit dialog for a selected item and reloads the list after a successful save", async () => {
		const retry = vi.fn();
		const submit = vi.fn().mockResolvedValue({ ...item, quantityTotal: 5 });
		vi.mocked(useEquipmentCatalog).mockReturnValue({
			items: [item],
			isLoading: false,
			error: "",
			retry,
		});
		vi.mocked(useUpdateEquipmentCatalogItem).mockReturnValue({
			isSubmitting: false,
			error: null,
			submit,
			reset: vi.fn(),
		});
		render(<EquipmentCatalogPage />);

		fireEvent.click(screen.getByRole("button", { name: "Sửa" }));
		expect(screen.getByRole("heading", { name: "Sửa thiết bị" })).toBeInTheDocument();

		fireEvent.change(screen.getByLabelText("Số lượng"), { target: { value: "5" } });
		fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

		await waitFor(() => expect(submit).toHaveBeenCalledWith("item-1", expect.any(Object)));
		await waitFor(() => expect(retry).toHaveBeenCalled());
		expect(screen.queryByRole("heading", { name: "Sửa thiết bị" })).not.toBeInTheDocument();
	});

	it("calls onCreateItem when the create button is clicked", () => {
		vi.mocked(useEquipmentCatalog).mockReturnValue({
			items: [],
			isLoading: false,
			error: "",
			retry: vi.fn(),
		});
		const onCreateItem = vi.fn();
		render(<EquipmentCatalogPage onCreateItem={onCreateItem} />);

		fireEvent.click(screen.getByRole("button", { name: "Thêm thiết bị" }));
		expect(onCreateItem).toHaveBeenCalled();
	});
});
