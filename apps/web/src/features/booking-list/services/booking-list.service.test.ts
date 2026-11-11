import { afterEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "../../../core/api";
import type { BookingListItem } from "../types";
import { bookingListService } from "./booking-list.service";

afterEach(() => vi.restoreAllMocks());

describe("bookingListService", () => {
	it("gets the owner Booking list without transforming wire values", async () => {
		const response = [{ id: "booking-1", totalAmount: "1700000.00" }] as BookingListItem[];
		const get = vi.spyOn(httpClient, "get").mockResolvedValue(response);

		await expect(bookingListService.getMyBookings()).resolves.toBe(response);
		expect(get).toHaveBeenCalledWith("/bookings");
		expect(response[0].totalAmount).toBe("1700000.00");
	});
});
