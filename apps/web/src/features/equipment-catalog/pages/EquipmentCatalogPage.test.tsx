import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateEquipmentCatalogItem } from "../hooks/useCreateEquipmentCatalogItem";
import { useEquipmentCatalog } from "../hooks/useEquipmentCatalog";
import { useUpdateEquipmentCatalogItem } from "../hooks/useUpdateEquipmentCatalogItem";
import type { EquipmentCatalogItem } from "../types";
import { EquipmentCatalogPage } from "./EquipmentCatalogPage";

vi.mock("../hooks/useEquipmentCatalog", () => ({ useEquipmentCatalog: vi.fn() }));
vi.mock("../hooks/useCreateEquipmentCatalogItem", () => ({
	useCreateEquipmentCatalogItem: vi.fn(),
}));
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
		vi.mocked(useCreateEquipmentCatalogItem).mockReturnValue({
			isSubmitting: false,
			error: null,
			createdItem: null,
			submit: vi.fn(),
			retry: vi.fn(),
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

	it("opens the create form in a modal instead of navigating to a new page", () => {
		vi.mocked(useEquipmentCatalog).mockReturnValue({
			items: [],
			isLoading: false,
			error: "",
			retry: vi.fn(),
		});
		render(<EquipmentCatalogPage />);

		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Thêm thiết bị" }));

		const dialog = screen.getByRole("dialog", { name: "Thêm thiết bị vào kho" });
		expect(dialog).toBeInTheDocument();
		expect(screen.getByLabelText("Tên thiết bị")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("closes the create modal and reloads the list after a successful create", async () => {
		const retry = vi.fn();
		const submit = vi.fn().mockResolvedValue({ ...item, id: "item-2", name: "Trekking pole" });
		vi.mocked(useEquipmentCatalog).mockReturnValue({
			items: [item],
			isLoading: false,
			error: "",
			retry,
		});
		vi.mocked(useCreateEquipmentCatalogItem).mockReturnValue({
			isSubmitting: false,
			error: null,
			createdItem: null,
			submit,
			retry: vi.fn(),
			reset: vi.fn(),
		});
		render(<EquipmentCatalogPage />);

		fireEvent.click(screen.getByRole("button", { name: "Thêm thiết bị" }));
		fireEvent.change(screen.getByLabelText("Tên thiết bị"), { target: { value: "Trekking pole" } });
		fireEvent.change(screen.getByLabelText("Loại thiết bị"), { target: { value: "gear" } });
		fireEvent.change(screen.getByLabelText("Số lượng"), { target: { value: "4" } });
		fireEvent.change(screen.getByLabelText("Giá thuê mỗi ngày"), { target: { value: "30000" } });
		const dialog = screen.getByRole("dialog", { name: "Thêm thiết bị vào kho" });
		fireEvent.click(within(dialog).getByRole("button", { name: "Thêm thiết bị" }));

		await waitFor(() =>
			expect(submit).toHaveBeenCalledWith(
				expect.objectContaining({ name: "Trekking pole", quantityTotal: 4 })
			)
		);
		await waitFor(() => expect(retry).toHaveBeenCalled());
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("paginates the table with the shared Pagination component", () => {
		const items = Array.from({ length: 12 }, (_, index) => ({
			...item,
			id: `item-${index + 1}`,
			name: `Item ${index + 1}`,
		}));
		vi.mocked(useEquipmentCatalog).mockReturnValue({
			items,
			isLoading: false,
			error: "",
			retry: vi.fn(),
		});
		render(<EquipmentCatalogPage />);

		expect(screen.getByText("Item 10")).toBeInTheDocument();
		expect(screen.queryByText("Item 11")).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Tiếp theo" }));
		expect(screen.getByText("Item 11")).toBeInTheDocument();
		expect(screen.queryByText("Item 1")).not.toBeInTheDocument();
	});
});
