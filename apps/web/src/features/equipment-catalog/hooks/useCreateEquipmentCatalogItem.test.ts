import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateEquipmentCatalogItemInput } from "../types";

type TestingLibrary = typeof import("@testing-library/react");
type HookModule = typeof import("./useCreateEquipmentCatalogItem");
type HttpErrorConstructor = typeof import("../../../core/api").HttpError;

let testingLibrary: TestingLibrary;
let hookModule: HookModule;
let HttpError: HttpErrorConstructor;
let createMock: ReturnType<typeof vi.fn>;

const payload: CreateEquipmentCatalogItemInput = {
	name: "4-person tent",
	category: "shelter",
	quantityTotal: 10,
	rentalPricePerDay: 50000,
};

describe("useCreateEquipmentCatalogItem", () => {
	beforeEach(async () => {
		vi.resetModules();
		vi.doUnmock("../../../core/api");
		createMock = vi.fn();
		vi.doMock("../services/equipment-catalog.service", () => ({
			equipmentCatalogService: {
				create: createMock,
				listMine: vi.fn(),
				getById: vi.fn(),
				update: vi.fn(),
			},
		}));

		[testingLibrary, hookModule, { HttpError }] = await Promise.all([
			import("@testing-library/react"),
			import("./useCreateEquipmentCatalogItem"),
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
		createMock.mockImplementation(
			() =>
				new Promise((done) => {
					resolve = done;
				})
		);

		const { result } = testingLibrary.renderHook(() => hookModule.useCreateEquipmentCatalogItem());
		let first!: Promise<unknown>;

		await testingLibrary.act(async () => {
			first = result.current.submit(payload);
			const second = await result.current.submit(payload);
			expect(second).toBeNull();
			resolve({ id: "item-1" } as never);
			await first;
		});

		expect(createMock).toHaveBeenCalledTimes(1);
	});

	it.each([401, 403, 422])("maps API status %s", (status) => {
		expect(
			hookModule.mapCreateEquipmentCatalogItemError(new HttpError("failure", status, {}))
		).toEqual(expect.objectContaining({ status }));
	});

	it("maps backend 422 field errors for the form", () => {
		const error = hookModule.mapCreateEquipmentCatalogItemError(
			new HttpError("invalid", 422, {
				message: [{ field: "quantityTotal", errors: ["quantityTotal must not be less than 0"] }],
			})
		);

		expect(error.fieldErrors).toEqual({
			quantityTotal: "quantityTotal must not be less than 0",
		});
	});

	it("keeps the last payload available for retry after a recoverable failure", async () => {
		createMock.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({
			id: "item-1",
		} as never);

		const { result } = testingLibrary.renderHook(() => hookModule.useCreateEquipmentCatalogItem());

		await testingLibrary.act(async () => {
			await result.current.submit(payload);
		});
		expect(result.current.error).not.toBeNull();

		await testingLibrary.act(async () => {
			await result.current.retry();
		});

		expect(createMock).toHaveBeenNthCalledWith(2, payload);
	});
});
