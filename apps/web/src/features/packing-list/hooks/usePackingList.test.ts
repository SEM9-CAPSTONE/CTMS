import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PackingListResponse } from "../types";

type TestingLibrary = typeof import("@testing-library/react");
type HookModule = typeof import("./usePackingList");
type HttpErrorConstructor = typeof import("../../../core/api").HttpError;

let testingLibrary: TestingLibrary;
let hookModule: HookModule;
let HttpError: HttpErrorConstructor;
let getPackingListMock: ReturnType<typeof vi.fn>;

function response(overrides: Partial<PackingListResponse> = {}): PackingListResponse {
	return {
		bookingId: "booking-1",
		tripId: "trip-1",
		context: {
			durationNights: 0,
			tripType: "day_trip",
			difficulty: null,
			memberCount: 1,
			weatherRiskLevel: null,
		},
		items: [],
		...overrides,
	};
}

describe("usePackingList", () => {
	beforeEach(async () => {
		vi.resetModules();
		vi.doUnmock("../../../core/api");
		getPackingListMock = vi.fn();
		vi.doMock("../services/packing-list.service", () => ({
			packingListService: { getPackingList: getPackingListMock },
		}));

		[testingLibrary, hookModule, { HttpError }] = await Promise.all([
			import("@testing-library/react"),
			import("./usePackingList"),
			import("../../../core/api"),
		]);
	});

	afterEach(() => {
		testingLibrary.cleanup();
		vi.doUnmock("../services/packing-list.service");
		vi.resetModules();
	});

	it("loads the Booking's packing list on mount and reloads on retry", async () => {
		getPackingListMock.mockResolvedValueOnce(response({ items: [] })).mockResolvedValueOnce(
			response({
				items: [
					{
						id: "id-documents",
						name: "Giấy tờ tùy thân",
						category: "essential",
						required: true,
						reason: "Luôn cần mang theo",
						alreadyCovered: false,
					},
				],
			})
		);
		const { result } = testingLibrary.renderHook(() => hookModule.usePackingList("booking-1"));

		await testingLibrary.waitFor(() => expect(result.current.packingList?.items).toEqual([]));

		await testingLibrary.act(async () => {
			await result.current.retry();
		});

		expect(result.current.packingList?.items).toHaveLength(1);
	});

	it("refetches when refreshKey changes", async () => {
		getPackingListMock.mockResolvedValue(response());
		const { rerender } = testingLibrary.renderHook(
			({ refreshKey }) => hookModule.usePackingList("booking-1", refreshKey),
			{ initialProps: { refreshKey: 0 } }
		);

		await testingLibrary.waitFor(() => expect(getPackingListMock).toHaveBeenCalledTimes(1));

		rerender({ refreshKey: 1 });

		await testingLibrary.waitFor(() => expect(getPackingListMock).toHaveBeenCalledTimes(2));
	});

	it("maps a 409 into a trip-context-unavailable message", async () => {
		getPackingListMock.mockRejectedValueOnce(new HttpError("Conflict", 409, null));

		const { result } = testingLibrary.renderHook(() => hookModule.usePackingList("booking-1"));

		await testingLibrary.waitFor(() =>
			expect(result.current.error).toBe(
				"Không thể tạo packing list vì thông tin chuyến đi không còn khả dụng."
			)
		);
	});
});
