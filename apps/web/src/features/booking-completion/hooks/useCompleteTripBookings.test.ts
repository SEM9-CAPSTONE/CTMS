import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { bookingCompletionService } from "../services/booking-completion.service";
import { useCompleteTripBookings } from "./useCompleteTripBookings";

describe("useCompleteTripBookings", () => {
	it("completes trip bookings successfully", async () => {
		const onSuccess = vi.fn();
		const responseData = {
			tripId: "trip-1",
			totalBookings: 3,
			completedCount: 2,
			skippedCount: 1,
			completedBookingIds: ["b-1", "b-2"],
		};
		vi.spyOn(bookingCompletionService, "completeTripBookings").mockResolvedValue(responseData);

		const { result } = renderHook(() => useCompleteTripBookings(onSuccess));

		let res: unknown;
		await act(async () => {
			res = await result.current.completeTripBookings("trip-1");
		});

		expect(res).toEqual(responseData);
		expect(result.current.result).toEqual(responseData);
		expect(result.current.error).toBeNull();
		expect(onSuccess).toHaveBeenCalledWith(responseData);
	});

	it("handles failure and returns null", async () => {
		vi.spyOn(bookingCompletionService, "completeTripBookings").mockRejectedValue(
			new HttpError("Internal Server Error", 500, {})
		);

		const { result } = renderHook(() => useCompleteTripBookings());

		await act(async () => {
			const res = await result.current.completeTripBookings("trip-1");
			expect(res).toBeNull();
		});

		expect(result.current.result).toBeNull();
		expect(result.current.error?.kind).toBe("uncertain");
	});
});
