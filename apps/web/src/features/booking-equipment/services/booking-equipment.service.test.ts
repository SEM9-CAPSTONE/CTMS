import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
	vi.restoreAllMocks();
	vi.resetModules();
});

describe("bookingEquipmentService", () => {
	it("calls the dedicated for-trip/list/add endpoints", async () => {
		vi.resetModules();
		const get = vi.fn().mockResolvedValue([]);
		const post = vi
			.fn()
			.mockResolvedValue({ item: { id: "item-1" }, booking: { id: "booking-1" } });
		vi.doMock("../../../core/api", () => ({
			API_ENDPOINTS: {
				EQUIPMENT_CATALOG: {
					FOR_TRIP: (tripId: string) => `/equipment-catalog/for-trip/${tripId}`,
				},
				BOOKINGS: {
					ITEMS: (bookingId: string) => `/bookings/${bookingId}/items`,
				},
			},
			httpClient: { get, post },
		}));
		const { bookingEquipmentService } = await import("./booking-equipment.service");

		await bookingEquipmentService.listForTrip("trip-1");
		await bookingEquipmentService.addItem(
			"booking-1",
			{ equipmentCatalogItemId: "item-1", quantity: 2 },
			"idem-1"
		);
		await bookingEquipmentService.listItems("booking-1");

		expect(get).toHaveBeenCalledWith("/equipment-catalog/for-trip/trip-1");
		expect(post).toHaveBeenCalledWith(
			"/bookings/booking-1/items",
			{ equipmentCatalogItemId: "item-1", quantity: 2 },
			{ headers: { "Idempotency-Key": "idem-1" } }
		);
		expect(get).toHaveBeenCalledWith("/bookings/booking-1/items");
	});
});
