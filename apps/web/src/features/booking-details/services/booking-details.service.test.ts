import { afterEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "../../../core/api";
import type { BookingDetails } from "../types";
import { bookingDetailsService } from "./booking-details.service";

afterEach(() => vi.restoreAllMocks());

describe("bookingDetailsService", () => {
	it("gets the exact Booking detail endpoint without transforming wire money", async () => {
		const response = {
			id: "booking-1",
			basePrice: "1500000.00",
			totalAmount: "1700000.00",
			equipmentItems: [{ unitPrice: "50000.00", totalPrice: "200000.00" }],
		} as BookingDetails;
		const get = vi.spyOn(httpClient, "get").mockResolvedValue(response);

		await expect(bookingDetailsService.getBookingDetails("booking-1")).resolves.toBe(response);
		expect(get).toHaveBeenCalledWith("/bookings/booking-1");
		expect(response.totalAmount).toBe("1700000.00");
		expect(response.equipmentItems[0].totalPrice).toBe("200000.00");
	});
});
