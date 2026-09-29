import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { bookingDetailsService } from "../services/booking-details.service";
import type { BookingDetails } from "../types";
import { mapBookingDetailsError, useBookingDetails } from "./useBookingDetails";

const details = { id: "booking-1", members: [], equipmentItems: [] } as unknown as BookingDetails;

describe("useBookingDetails", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(bookingDetailsService, "getBookingDetails");
	});

	it("loads a Booking and exposes success", async () => {
		vi.mocked(bookingDetailsService.getBookingDetails).mockResolvedValue(details);
		const { result } = renderHook(() => useBookingDetails("booking-1"));
		expect(result.current.isLoading).toBe(true);
		await waitFor(() => expect(result.current.booking).toBe(details));
		expect(result.current.error).toBeNull();
		expect(result.current.isLoading).toBe(false);
	});

	it.each([
		[403, "forbidden", false],
		[404, "not_found", false],
		[422, "invalid_reference", false],
		[503, "retryable", true],
	] as const)("maps HTTP %s", async (status, kind, canRetry) => {
		vi.mocked(bookingDetailsService.getBookingDetails).mockRejectedValue(
			new HttpError("failed", status, {})
		);
		const { result } = renderHook(() => useBookingDetails("booking-1"));
		await waitFor(() => expect(result.current.error?.kind).toBe(kind));
		expect(result.current.error?.canRetry).toBe(canRetry);
	});

	it("maps a network failure and retries", async () => {
		vi.mocked(bookingDetailsService.getBookingDetails)
			.mockRejectedValueOnce(new TypeError("Failed to fetch"))
			.mockResolvedValueOnce(details);
		const { result } = renderHook(() => useBookingDetails("booking-1"));
		await waitFor(() => expect(result.current.error?.kind).toBe("retryable"));
		await act(async () => void (await result.current.retry()));
		expect(result.current.booking).toBe(details);
		expect(result.current.error).toBeNull();
	});

	it("loads a changed Booking id and ignores the stale response", async () => {
		let finishFirst: (value: BookingDetails) => void = () => {};
		vi.mocked(bookingDetailsService.getBookingDetails)
			.mockReturnValueOnce(
				new Promise((resolve) => {
					finishFirst = resolve;
				})
			)
			.mockResolvedValueOnce({ ...details, id: "booking-2" });
		const { result, rerender } = renderHook(({ id }) => useBookingDetails(id), {
			initialProps: { id: "booking-1" },
		});
		rerender({ id: "booking-2" });
		await waitFor(() => expect(result.current.booking?.id).toBe("booking-2"));
		await act(async () => finishFirst(details));
		expect(result.current.booking?.id).toBe("booking-2");
	});

	it("does not update after unmount", async () => {
		let finish: (value: BookingDetails) => void = () => {};
		vi.mocked(bookingDetailsService.getBookingDetails).mockReturnValue(
			new Promise((resolve) => {
				finish = resolve;
			})
		);
		const { unmount } = renderHook(() => useBookingDetails("booking-1"));
		unmount();
		await act(async () => finish(details));
		expect(bookingDetailsService.getBookingDetails).toHaveBeenCalledTimes(1);
	});

	it("classifies unauthenticated and unexpected client errors", () => {
		expect(mapBookingDetailsError(new HttpError("unauthorized", 401, {})).kind).toBe(
			"unauthenticated"
		);
		expect(mapBookingDetailsError(new HttpError("bad", 400, {})).kind).toBe("unexpected");
	});
});
