import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
	vi.restoreAllMocks();
	vi.resetModules();
});

describe("equipmentCatalogService", () => {
	it("calls the dedicated create/list/detail/update endpoints", async () => {
		vi.resetModules();
		const get = vi.fn().mockResolvedValue([]);
		const post = vi.fn().mockResolvedValue({ id: "item-1" });
		const patch = vi.fn().mockResolvedValue({ id: "item-1", status: "inactive" });
		vi.doMock("../../../core/api", () => ({
			API_ENDPOINTS: {
				EQUIPMENT_CATALOG: {
					CREATE: "/equipment-catalog",
					MINE: "/equipment-catalog/mine",
					DETAIL: (id: string) => `/equipment-catalog/${id}`,
				},
			},
			httpClient: { get, post, patch },
		}));
		const { equipmentCatalogService } = await import("./equipment-catalog.service");

		await equipmentCatalogService.listMine();
		await equipmentCatalogService.create({
			name: "4-person tent",
			category: "shelter",
			quantityTotal: 10,
			rentalPricePerDay: 50000,
		});
		await equipmentCatalogService.getById("item-1");
		await equipmentCatalogService.update("item-1", { status: "inactive" });

		expect(get).toHaveBeenCalledWith("/equipment-catalog/mine");
		expect(post).toHaveBeenCalledWith("/equipment-catalog", {
			name: "4-person tent",
			category: "shelter",
			quantityTotal: 10,
			rentalPricePerDay: 50000,
		});
		expect(get).toHaveBeenCalledWith("/equipment-catalog/item-1");
		expect(patch).toHaveBeenCalledWith("/equipment-catalog/item-1", { status: "inactive" });
	});
});
