import { describe, expect, it, vi } from "vitest";
import { API_ENDPOINTS, httpClient } from "../../../core/api";
import { bookingCompletionService } from "./booking-completion.service";

describe("bookingCompletionService", () => {
	it("calls completeBooking with correct endpoint", async () => {
		const postSpy = vi.spyOn(httpClient, "post").mockResolvedValue({
			id: "booking-123",
			status: "completed",
			completedAt: "2026-10-11T12:00:00.000Z",
		});

		const res = await bookingCompletionService.completeBooking("booking-123");
		expect(postSpy).toHaveBeenCalledWith(API_ENDPOINTS.BOOKINGS.COMPLETE("booking-123"));
		expect(res.status).toBe("completed");
		postSpy.mockRestore();
	});

	it("calls completeTripBookings with correct endpoint", async () => {
		const postSpy = vi.spyOn(httpClient, "post").mockResolvedValue({
			tripId: "trip-123",
			totalBookings: 2,
			completedCount: 2,
			skippedCount: 0,
			completedBookingIds: ["booking-1", "booking-2"],
		});

		const res = await bookingCompletionService.completeTripBookings("trip-123");
		expect(postSpy).toHaveBeenCalledWith(API_ENDPOINTS.BOOKINGS.COMPLETE_TRIP_BOOKINGS("trip-123"));
		expect(res.completedCount).toBe(2);
		postSpy.mockRestore();
	});
});
