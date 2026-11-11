import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AddBookingItemInput } from "../types";

type TestingLibrary = typeof import("@testing-library/react");
type HookModule = typeof import("./useAddBookingItem");
type HttpErrorConstructor = typeof import("../../../core/api").HttpError;

let testingLibrary: TestingLibrary;
let hookModule: HookModule;
let HttpError: HttpErrorConstructor;
let addItemMock: ReturnType<typeof vi.fn>;

const input: AddBookingItemInput = { equipmentCatalogItemId: "item-1", quantity: 2 };

describe("useAddBookingItem", () => {
	beforeEach(async () => {
		vi.resetModules();
		vi.doUnmock("../../../core/api");
		addItemMock = vi.fn();
		vi.doMock("../services/booking-equipment.service", () => ({
			bookingEquipmentService: { addItem: addItemMock },
		}));

		[testingLibrary, hookModule, { HttpError }] = await Promise.all([
			import("@testing-library/react"),
			import("./useAddBookingItem"),
			import("../../../core/api"),
		]);
	});

	afterEach(() => {
		testingLibrary.cleanup();
		vi.doUnmock("../services/booking-equipment.service");
		vi.resetModules();
	});

	it("prevents duplicate submissions while a request is running", async () => {
		let resolve!: (value: never) => void;
		addItemMock.mockImplementation(
			() =>
				new Promise((done) => {
					resolve = done;
				})
		);

		const { result } = testingLibrary.renderHook(() => hookModule.useAddBookingItem());
		let first!: Promise<unknown>;

		await testingLibrary.act(async () => {
			first = result.current.submit("booking-1", input);
			const second = await result.current.submit("booking-1", input);
			expect(second).toBeNull();
			resolve({ item: { id: "item-1" }, booking: { id: "booking-1", totalAmount: "1" } } as never);
			await first;
		});

		expect(addItemMock).toHaveBeenCalledTimes(1);
	});

	it("submits with a fresh idempotency key each call", async () => {
		addItemMock.mockResolvedValue({
			item: { id: "item-1" },
			booking: { id: "booking-1", totalAmount: "1" },
		});

		const { result } = testingLibrary.renderHook(() => hookModule.useAddBookingItem());
		await testingLibrary.act(async () => {
			await result.current.submit("booking-1", input);
		});
		await testingLibrary.act(async () => {
			await result.current.submit("booking-1", input);
		});

		const firstKey = addItemMock.mock.calls[0][2];
		const secondKey = addItemMock.mock.calls[1][2];
		expect(firstKey).not.toBe(secondKey);
		expect(addItemMock).toHaveBeenNthCalledWith(1, "booking-1", input, firstKey);
	});

	it.each([403, 404, 409, 422])("maps API status %s", async (status) => {
		addItemMock.mockRejectedValueOnce(new HttpError("failure", status, {}));
		const { result } = testingLibrary.renderHook(() => hookModule.useAddBookingItem());

		await testingLibrary.act(async () => {
			await result.current.submit("booking-1", input);
		});

		expect(result.current.error).toMatchObject({ status, isConflict: status === 409 });
	});

	it("resolves with the item and updated booking on success", async () => {
		addItemMock.mockResolvedValue({
			item: { id: "item-1", quantity: 2 },
			booking: { id: "booking-1", totalAmount: "200000.00" },
		});
		const { result } = testingLibrary.renderHook(() => hookModule.useAddBookingItem());

		let response!: unknown;
		await testingLibrary.act(async () => {
			response = await result.current.submit("booking-1", input);
		});

		expect(response).toEqual({
			item: { id: "item-1", quantity: 2 },
			booking: { id: "booking-1", totalAmount: "200000.00" },
		});
		expect(result.current.error).toBeNull();
	});
});
