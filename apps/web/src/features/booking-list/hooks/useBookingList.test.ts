import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { bookingListService } from "../services/booking-list.service";
import type { BookingListItem } from "../types";
import { mapBookingListError, useBookingList } from "./useBookingList";

const booking = { id: "booking-1", totalAmount: "1700000.00" } as BookingListItem;

describe("useBookingList", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(bookingListService, "getMyBookings");
	});

	it("loads success and supports an empty owner list", async () => {
		vi.mocked(bookingListService.getMyBookings).mockResolvedValueOnce([booking]);
		const first = renderHook(() => useBookingList());
		expect(first.result.current.isLoading).toBe(true);
		await waitFor(() => expect(first.result.current.bookings).toEqual([booking]));
		first.unmount();

		vi.mocked(bookingListService.getMyBookings).mockResolvedValueOnce([]);
		const second = renderHook(() => useBookingList());
		await waitFor(() => expect(second.result.current.isLoading).toBe(false));
		expect(second.result.current.bookings).toEqual([]);
	});

	it("maps authorization, server, and unexpected failures", () => {
		expect(mapBookingListError(new HttpError("unauthorized", 401, {}))).toMatchObject({
			kind: "unauthenticated",
			canRetry: false,
		});
		expect(mapBookingListError(new HttpError("forbidden", 403, {}))).toMatchObject({
			kind: "forbidden",
			canRetry: false,
		});
		expect(mapBookingListError(new HttpError("server", 503, {}))).toMatchObject({
			kind: "retryable",
			canRetry: true,
		});
		expect(mapBookingListError(new HttpError("bad", 400, {})).kind).toBe("unexpected");
	});

	it("maps a network error and retries", async () => {
		vi.mocked(bookingListService.getMyBookings)
			.mockRejectedValueOnce(new TypeError("Failed to fetch"))
			.mockResolvedValueOnce([booking]);
		const { result } = renderHook(() => useBookingList());
		await waitFor(() => expect(result.current.error?.kind).toBe("retryable"));
		await act(async () => void (await result.current.retry()));
		expect(result.current.bookings).toEqual([booking]);
		expect(result.current.error).toBeNull();
	});

	it("keeps the newest request and ignores a stale response", async () => {
		let finishFirst: (value: BookingListItem[]) => void = () => {};
		vi.mocked(bookingListService.getMyBookings)
			.mockReturnValueOnce(
				new Promise((resolve) => {
					finishFirst = resolve;
				})
			)
			.mockResolvedValueOnce([{ ...booking, id: "booking-2" }]);
		const { result } = renderHook(() => useBookingList());
		await act(async () => void (await result.current.retry()));
		expect(result.current.bookings[0].id).toBe("booking-2");
		await act(async () => finishFirst([booking]));
		expect(result.current.bookings[0].id).toBe("booking-2");
	});

	it("does not update after unmount", async () => {
		let finish: (value: BookingListItem[]) => void = () => {};
		vi.mocked(bookingListService.getMyBookings).mockReturnValue(
			new Promise((resolve) => {
				finish = resolve;
			})
		);
		const { unmount } = renderHook(() => useBookingList());
		unmount();
		await act(async () => finish([booking]));
		expect(bookingListService.getMyBookings).toHaveBeenCalledTimes(1);
	});
});
