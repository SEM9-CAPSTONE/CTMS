import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EquipmentCatalogItem } from "../types";

type TestingLibrary = typeof import("@testing-library/react");
type EquipmentCatalogModule = typeof import("./useEquipmentCatalog");
type CoreApiModule = typeof import("../../../core/api");

let testingLibrary: TestingLibrary;
let equipmentCatalogModule: EquipmentCatalogModule;
let listMineMock: ReturnType<typeof vi.fn>;

const item = { id: "item-1", status: "active" } as EquipmentCatalogItem;
const reloadedItem = { id: "item-1", status: "inactive" } as EquipmentCatalogItem;

describe("useEquipmentCatalog", () => {
	beforeEach(async () => {
		vi.resetModules();
		vi.doUnmock("../../../core/api");
		listMineMock = vi.fn();
		vi.doMock("../services/equipment-catalog.service", () => ({
			equipmentCatalogService: { listMine: listMineMock },
		}));

		[testingLibrary, equipmentCatalogModule] = await Promise.all([
			import("@testing-library/react"),
			import("./useEquipmentCatalog"),
		]);
	});

	afterEach(() => {
		testingLibrary.cleanup();
		vi.doUnmock("../services/equipment-catalog.service");
		vi.resetModules();
	});

	it("loads the Host's own items on mount and reloads on retry", async () => {
		let resolveReload!: (items: EquipmentCatalogItem[]) => void;
		listMineMock.mockResolvedValueOnce([item]).mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveReload = resolve;
				})
		);
		const { result } = testingLibrary.renderHook(() =>
			equipmentCatalogModule.useEquipmentCatalog()
		);
		await testingLibrary.waitFor(() => expect(result.current.items).toEqual([item]));

		let reload!: Promise<void>;
		testingLibrary.act(() => {
			reload = result.current.retry();
		});
		expect(result.current.items).toEqual([item]);
		resolveReload([reloadedItem]);
		await testingLibrary.act(async () => reload);

		expect(result.current.items).toEqual([reloadedItem]);
	});

	it("maps a 403 into a permission message", async () => {
		const { HttpError } = (await vi.importActual("../../../core/api")) as CoreApiModule;
		listMineMock.mockRejectedValueOnce(new HttpError("Forbidden", 403, null));

		const { result } = testingLibrary.renderHook(() =>
			equipmentCatalogModule.useEquipmentCatalog()
		);

		await testingLibrary.waitFor(() =>
			expect(result.current.error).toBe("Bạn không có quyền xem kho thiết bị.")
		);
		expect(result.current.items).toEqual([]);
	});
});
