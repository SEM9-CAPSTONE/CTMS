import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { bookingCancellationService } from "../services/booking-cancellation.service";
import { cancellationFixture } from "../test-fixtures";
import type { CancelBookingResponse } from "../types";
import { useCancelBooking } from "./useCancelBooking";

afterEach(() => vi.restoreAllMocks());
it("blocks same-tick duplicate submissions and normalizes the reason", async () => {
	let resolve!: (response: CancelBookingResponse) => void;
	const call = vi.spyOn(bookingCancellationService, "cancel").mockImplementation(
		() =>
			new Promise((done) => {
				resolve = done;
			})
	);
	const { result } = renderHook(() => useCancelBooking(cancellationFixture.bookingId));
	let request!: Promise<CancelBookingResponse | null>;
	act(() => {
		request = result.current.submit({ reason: " reason " });
		void result.current.submit({ reason: "again" });
	});
	expect(call).toHaveBeenCalledTimes(1);
	expect(call).toHaveBeenCalledWith(cancellationFixture.bookingId, { reason: "reason" });
	expect(result.current.isSubmitting).toBe(true);
	await act(async () => {
		resolve(cancellationFixture);
		await request;
	});
	expect(result.current.result).toEqual(cancellationFixture);
	expect(result.current.isSubmitting).toBe(false);
});
it("allows explicit retry after uncertain failure without inventing success", async () => {
	const call = vi
		.spyOn(bookingCancellationService, "cancel")
		.mockRejectedValueOnce(new Error("network"))
		.mockResolvedValue(cancellationFixture);
	const { result } = renderHook(() => useCancelBooking(cancellationFixture.bookingId));
	await act(async () => {
		await result.current.submit({ reason: "   " });
	});
	expect(result.current.result).toBeNull();
	expect(result.current.error?.kind).toBe("uncertain");
	expect(call).toHaveBeenLastCalledWith(cancellationFixture.bookingId, {});
	await act(async () => {
		await result.current.submit({});
	});
	expect(result.current.result).toEqual(cancellationFixture);
});
it("ignores responses after a Booking change or unmount", async () => {
	let resolve!: (response: CancelBookingResponse) => void;
	vi.spyOn(bookingCancellationService, "cancel").mockImplementation(
		() =>
			new Promise((done) => {
				resolve = done;
			})
	);
	const { result, rerender, unmount } = renderHook(({ id }) => useCancelBooking(id), {
		initialProps: { id: cancellationFixture.bookingId },
	});
	let pending!: Promise<CancelBookingResponse | null>;
	act(() => {
		pending = result.current.submit({});
	});
	rerender({ id: "other" });
	await act(async () => {
		resolve(cancellationFixture);
		expect(await pending).toBeNull();
	});
	expect(result.current.result).toBeNull();
	act(() => {
		pending = result.current.submit({});
	});
	unmount();
	await act(async () => {
		resolve(cancellationFixture);
		expect(await pending).toBeNull();
	});
});
