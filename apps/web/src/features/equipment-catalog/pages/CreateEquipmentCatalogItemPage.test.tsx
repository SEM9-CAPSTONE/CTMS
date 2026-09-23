import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const creation = {
	isSubmitting: false,
	error: null,
	createdItem: null,
	submit: vi.fn(),
	retry: vi.fn(),
	reset: vi.fn(),
};

describe("CreateEquipmentCatalogItemPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders the create form for the intended Host flow", async () => {
		vi.resetModules();
		vi.doMock("../hooks/useCreateEquipmentCatalogItem", () => ({
			useCreateEquipmentCatalogItem: () => creation,
		}));
		vi.doMock("../components/CreateEquipmentCatalogItemForm", () => ({
			CreateEquipmentCatalogItemForm: () => <div data-testid="equipment-catalog-form" />,
		}));
		const { CreateEquipmentCatalogItemPage } = await import("./CreateEquipmentCatalogItemPage");

		render(<CreateEquipmentCatalogItemPage />);

		expect(screen.getByTestId("equipment-catalog-form")).toBeInTheDocument();
	});

	it("renders authoritative server state after success", async () => {
		vi.resetModules();
		vi.doMock("../hooks/useCreateEquipmentCatalogItem", () => ({
			useCreateEquipmentCatalogItem: () => ({
				...creation,
				createdItem: {
					id: "item-1",
					name: "4-person tent",
					status: "active",
					quantityTotal: 10,
				},
			}),
		}));
		const { CreateEquipmentCatalogItemPage } = await import("./CreateEquipmentCatalogItemPage");

		render(<CreateEquipmentCatalogItemPage />);

		expect(screen.getByTestId("server-item-status")).toHaveTextContent("active");
		expect(screen.getByTestId("server-item-quantity")).toHaveTextContent("10");
	});
});
