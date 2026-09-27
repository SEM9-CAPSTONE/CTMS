import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TripEquipmentOption } from "../types";

type TestingLibrary = typeof import("@testing-library/react");
type HookModule = typeof import("./useTripEquipmentOptions");
type HttpErrorConstructor = typeof import("../../../core/api").HttpError;

let testingLibrary: TestingLibrary;
let hookModule: HookModule;
let HttpError: HttpErrorConstructor;
let listForTripMock: ReturnType<typeof vi.fn>;

const option = { id: "item-1", name: "4-person tent" } as TripEquipmentOption;

describe("useTripEquipmentOptions", () => {
	beforeEach(async () => {
		vi.resetModules();
		vi.doUnmock("../../../core/api");
		listForTripMock = vi.fn();
		vi.doMock("../services/booking-equipment.service", () => ({
			bookingEquipmentService: { listForTrip: listForTripMock },
		}));

		[testingLibrary, hookModule, { HttpError }] = await Promise.all([
			import("@testing-library/react"),
			import("./useTripEquipmentOptions"),
			import("../../../core/api"),
		]);
	});

	afterEach(() => {
		testingLibrary.cleanup();
		vi.doUnmock("../services/booking-equipment.service");
		vi.resetModules();
	});

	it("loads the Trip's equipment options on mount", async () => {
		listForTripMock.mockResolvedValueOnce([option]);
		const { result } = testingLibrary.renderHook(() =>
			hookModule.useTripEquipmentOptions("trip-1")
		);

		await testingLibrary.waitFor(() => expect(result.current.items).toEqual([option]));
		expect(listForTripMock).toHaveBeenCalledWith("trip-1");
	});

	it("does not fetch when tripId is undefined", () => {
		testingLibrary.renderHook(() => hookModule.useTripEquipmentOptions(undefined));
		expect(listForTripMock).not.toHaveBeenCalled();
	});

	it("maps a 404 into a not-found message", async () => {
		listForTripMock.mockRejectedValueOnce(new HttpError("Not Found", 404, null));

		const { result } = testingLibrary.renderHook(() =>
			hookModule.useTripEquipmentOptions("trip-1")
		);

		await testingLibrary.waitFor(() =>
			expect(result.current.error).toBe("Không tìm thấy chuyến đi này.")
		);
	});

	it("reloads on retry", async () => {
		listForTripMock.mockResolvedValueOnce([option]).mockResolvedValueOnce([]);
		const { result } = testingLibrary.renderHook(() =>
			hookModule.useTripEquipmentOptions("trip-1")
		);
		await testingLibrary.waitFor(() => expect(result.current.items).toEqual([option]));

		await testingLibrary.act(async () => {
			await result.current.retry();
		});

		expect(result.current.items).toEqual([]);
	});
});
