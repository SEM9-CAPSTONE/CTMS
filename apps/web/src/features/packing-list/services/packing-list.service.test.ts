import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
	vi.restoreAllMocks();
	vi.resetModules();
});

describe("packingListService", () => {
	it("calls the packing-list endpoint for the given Booking", async () => {
		vi.resetModules();
		const get = vi.fn().mockResolvedValue({
			bookingId: "booking-1",
			tripId: "trip-1",
			context: {},
			items: [],
		});
		vi.doMock("../../../core/api", () => ({
			API_ENDPOINTS: {
				BOOKINGS: {
					PACKING_LIST: (bookingId: string) => `/bookings/${bookingId}/packing-list`,
				},
			},
			httpClient: { get },
		}));
		const { packingListService } = await import("./packing-list.service");

		await packingListService.getPackingList("booking-1");

		expect(get).toHaveBeenCalledWith("/bookings/booking-1/packing-list");
	});
});
