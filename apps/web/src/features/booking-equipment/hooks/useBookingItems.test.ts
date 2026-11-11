import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BookingItem } from "../types";

type TestingLibrary = typeof import("@testing-library/react");
type HookModule = typeof import("./useBookingItems");
type HttpErrorConstructor = typeof import("../../../core/api").HttpError;

let testingLibrary: TestingLibrary;
let hookModule: HookModule;
let HttpError: HttpErrorConstructor;
let listItemsMock: ReturnType<typeof vi.fn>;

const item = { id: "item-1", totalPrice: "100000.00" } as BookingItem;

describe("useBookingItems", () => {
	beforeEach(async () => {
		vi.resetModules();
		vi.doUnmock("../../../core/api");
		listItemsMock = vi.fn();
		vi.doMock("../services/booking-equipment.service", () => ({
			bookingEquipmentService: { listItems: listItemsMock },
		}));

		[testingLibrary, hookModule, { HttpError }] = await Promise.all([
			import("@testing-library/react"),
			import("./useBookingItems"),
			import("../../../core/api"),
		]);
	});

	afterEach(() => {
		testingLibrary.cleanup();
		vi.doUnmock("../services/booking-equipment.service");
		vi.resetModules();
	});

	it("loads the Booking's items on mount and reloads on retry", async () => {
		listItemsMock.mockResolvedValueOnce([item]).mockResolvedValueOnce([]);
		const { result } = testingLibrary.renderHook(() => hookModule.useBookingItems("booking-1"));

		await testingLibrary.waitFor(() => expect(result.current.items).toEqual([item]));

		await testingLibrary.act(async () => {
			await result.current.retry();
		});

		expect(result.current.items).toEqual([]);
	});

	it("maps a 403 into a permission message", async () => {
		listItemsMock.mockRejectedValueOnce(new HttpError("Forbidden", 403, null));

		const { result } = testingLibrary.renderHook(() => hookModule.useBookingItems("booking-1"));

		await testingLibrary.waitFor(() =>
			expect(result.current.error).toBe("Bạn không có quyền xem các thiết bị đã thêm.")
		);
	});
});
