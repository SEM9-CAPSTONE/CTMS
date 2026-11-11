import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type TestingLibrary = typeof import("@testing-library/react");
type HookModule = typeof import("./useUpdateEquipmentCatalogItem");
type HttpErrorConstructor = typeof import("../../../core/api").HttpError;

let testingLibrary: TestingLibrary;
let hookModule: HookModule;
let HttpError: HttpErrorConstructor;
let updateMock: ReturnType<typeof vi.fn>;

describe("useUpdateEquipmentCatalogItem", () => {
	beforeEach(async () => {
		vi.resetModules();
		vi.doUnmock("../../../core/api");
		updateMock = vi.fn();
		vi.doMock("../services/equipment-catalog.service", () => ({
			equipmentCatalogService: {
				create: vi.fn(),
				listMine: vi.fn(),
				getById: vi.fn(),
				update: updateMock,
			},
		}));

		[testingLibrary, hookModule, { HttpError }] = await Promise.all([
			import("@testing-library/react"),
			import("./useUpdateEquipmentCatalogItem"),
			import("../../../core/api"),
		]);
	});

	afterEach(() => {
		testingLibrary.cleanup();
		vi.doUnmock("../services/equipment-catalog.service");
		vi.resetModules();
	});

	it("prevents duplicate submissions while a request is running", async () => {
		let resolve!: (value: never) => void;
		updateMock.mockImplementation(
			() =>
				new Promise((done) => {
					resolve = done;
				})
		);

		const { result } = testingLibrary.renderHook(() => hookModule.useUpdateEquipmentCatalogItem());
		let first!: Promise<unknown>;

		await testingLibrary.act(async () => {
			first = result.current.submit("item-1", { quantityTotal: 5 });
			const second = await result.current.submit("item-1", { quantityTotal: 5 });
			expect(second).toBeNull();
			resolve({ id: "item-1", quantityTotal: 5 } as never);
			await first;
		});

		expect(updateMock).toHaveBeenCalledTimes(1);
	});

	it.each([403, 404, 422])("maps API status %s", (status) => {
		expect(
			hookModule.mapUpdateEquipmentCatalogItemError(new HttpError("failure", status, {}))
		).toEqual(expect.objectContaining({ status }));
	});

	it("resolves with the updated item on success", async () => {
		updateMock.mockResolvedValueOnce({ id: "item-1", quantityTotal: 5 } as never);

		const { result } = testingLibrary.renderHook(() => hookModule.useUpdateEquipmentCatalogItem());
		let updated!: unknown;
		await testingLibrary.act(async () => {
			updated = await result.current.submit("item-1", { quantityTotal: 5 });
		});

		expect(updated).toEqual({ id: "item-1", quantityTotal: 5 });
		expect(updateMock).toHaveBeenCalledWith("item-1", { quantityTotal: 5 });
	});

	it("resets the error", async () => {
		updateMock.mockRejectedValueOnce(new HttpError("failure", 404, {}));
		const { result } = testingLibrary.renderHook(() => hookModule.useUpdateEquipmentCatalogItem());

		await testingLibrary.act(async () => {
			await result.current.submit("missing", {});
		});
		expect(result.current.error).not.toBeNull();

		testingLibrary.act(() => result.current.reset());
		expect(result.current.error).toBeNull();
	});
});
