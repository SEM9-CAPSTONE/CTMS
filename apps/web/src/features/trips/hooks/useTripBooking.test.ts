import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { bookingDetailsService } from "../../booking-details/services/booking-details.service";
import type { BookingDetails } from "../../booking-details/types";
import { bookingListService } from "../../booking-list/services/booking-list.service";
import type { BookingListItem } from "../../booking-list/types";
import { useTripBooking } from "./useTripBooking";

const older = {
	id: "booking-older",
	tripId: "trip-1",
	createdAt: "2030-01-01T00:00:00.000Z",
} as BookingListItem;
const newest = {
	...older,
	id: "booking-newest",
	createdAt: "2030-01-02T00:00:00.000Z",
};
const details = {
	id: newest.id,
	tripId: newest.tripId,
	status: "cancelled",
	members: [],
	equipmentItems: [],
} as unknown as BookingDetails;

describe("useTripBooking", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(bookingListService, "getMyBookings");
		vi.spyOn(bookingDetailsService, "getBookingDetails");
	});

	it("restores the first matching Booking from the API's canonical newest-first order", async () => {
		vi.mocked(bookingListService.getMyBookings).mockResolvedValue([
			{ ...newest, tripId: "another-trip" },
			newest,
			older,
		]);
		vi.mocked(bookingDetailsService.getBookingDetails).mockResolvedValue(details);

		const { result } = renderHook(() => useTripBooking("trip-1", true));
		await waitFor(() => expect(result.current.booking).toBe(details));

		expect(bookingDetailsService.getBookingDetails).toHaveBeenCalledTimes(1);
		expect(bookingDetailsService.getBookingDetails).toHaveBeenCalledWith("booking-newest");
	});

	it("restores an expired Booking exactly as returned by the server", async () => {
		const expired = { ...details, status: "expired", paymentStatus: "paid" } as BookingDetails;
		vi.mocked(bookingListService.getMyBookings).mockResolvedValue([newest]);
		vi.mocked(bookingDetailsService.getBookingDetails).mockResolvedValue(expired);

		const { result } = renderHook(() => useTripBooking("trip-1", true));
		await waitFor(() => expect(result.current.booking).toBe(expired));

		expect(result.current.booking?.status).toBe("expired");
		expect(result.current.booking?.paymentStatus).toBe("paid");
	});

	it("reports a successful authoritative absence without loading details", async () => {
		vi.mocked(bookingListService.getMyBookings).mockResolvedValue([
			{ ...newest, tripId: "another-trip" },
		]);

		const { result } = renderHook(() => useTripBooking("trip-1", true));
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		expect(result.current.booking).toBeNull();
		expect(result.current.error).toBeNull();
		expect(bookingDetailsService.getBookingDetails).not.toHaveBeenCalled();
	});

	it("does not request owner Bookings when restoration is disabled", async () => {
		const { result } = renderHook(() => useTripBooking("trip-1", false));
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(bookingListService.getMyBookings).not.toHaveBeenCalled();
	});

	it("surfaces a retryable list failure and retries without fabricating absence", async () => {
		vi.mocked(bookingListService.getMyBookings)
			.mockRejectedValueOnce(new HttpError("server", 503, {}))
			.mockResolvedValueOnce([newest]);
		vi.mocked(bookingDetailsService.getBookingDetails).mockResolvedValue(details);

		const { result } = renderHook(() => useTripBooking("trip-1", true));
		await waitFor(() => expect(result.current.error?.kind).toBe("retryable"));
		expect(result.current.booking).toBeNull();

		await act(async () => void (await result.current.retry()));
		expect(result.current.booking).toBe(details);
		expect(result.current.error).toBeNull();
	});
});
