import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { bookingPaymentService } from "../services/booking-payment.service";
import { usePayBooking } from "./usePayBooking";

describe("usePayBooking", () => {
	const bookingId = "11111111-1111-4111-8111-111111111111";
	const successResponse = {
		paymentId: "22222222-2222-4222-8222-222222222222",
		bookingId,
		paymentStatus: "succeeded" as const,
		amount: "1500000.00",
		bookingStatus: "confirmed" as const,
		bookingPaymentStatus: "paid" as const,
		createdAt: "2026-09-29T12:00:00.000Z",
	};

	it("successfully pays for booking and stores result", async () => {
		const paySpy = vi.spyOn(bookingPaymentService, "pay").mockResolvedValue(successResponse);

		const { result } = renderHook(() => usePayBooking());

		let response: unknown;
		await act(async () => {
			response = await result.current.submit(bookingId, { method: "CARD" });
		});

		expect(response).toEqual(successResponse);
		expect(result.current.result).toEqual(successResponse);
		expect(result.current.error).toBeNull();
		expect(result.current.isSubmitting).toBe(false);
		expect(paySpy).toHaveBeenCalledWith(bookingId, { method: "CARD" }, expect.any(String));

		paySpy.mockRestore();
	});

	it("captures error when payment fails", async () => {
		const paySpy = vi
			.spyOn(bookingPaymentService, "pay")
			.mockRejectedValue(new HttpError("Conflict", 409, { message: "Already paid" }));

		const { result } = renderHook(() => usePayBooking());

		await act(async () => {
			await result.current.submit(bookingId, { method: "CARD" });
		});

		expect(result.current.result).toBeNull();
		expect(result.current.error?.isConflict).toBe(true);
		expect(result.current.error?.message).toBe("Already paid");

		paySpy.mockRestore();
	});

	it("reuses the same idempotency key on retry", async () => {
		const paySpy = vi
			.spyOn(bookingPaymentService, "pay")
			.mockRejectedValueOnce(new HttpError("Server error", 500, {}))
			.mockResolvedValueOnce(successResponse);

		const { result } = renderHook(() => usePayBooking());

		await act(async () => {
			await result.current.submit(bookingId, { method: "CARD" });
		});

		expect(result.current.error?.canRetry).toBe(true);
		const firstKey = paySpy.mock.calls[0][2];

		await act(async () => {
			await result.current.retry();
		});

		expect(paySpy).toHaveBeenCalledTimes(2);
		const secondKey = paySpy.mock.calls[1][2];
		expect(firstKey).toBe(secondKey);
		expect(result.current.result).toEqual(successResponse);

		paySpy.mockRestore();
	});

	it("prevents duplicate submissions while in-flight", async () => {
		let resolveCall: (val: typeof successResponse) => void = () => {};
		const pendingPromise = new Promise<typeof successResponse>((resolve) => {
			resolveCall = resolve;
		});

		const paySpy = vi.spyOn(bookingPaymentService, "pay").mockImplementation(() => pendingPromise);

		const { result } = renderHook(() => usePayBooking());

		let firstCall: Promise<unknown>;
		act(() => {
			firstCall = result.current.submit(bookingId, { method: "CARD" });
		});

		expect(result.current.isSubmitting).toBe(true);

		let secondCall: Promise<unknown> = Promise.resolve(null);
		act(() => {
			secondCall = result.current.submit(bookingId, { method: "CARD" });
		});

		const secondResult = await secondCall;
		expect(secondResult).toBeNull();
		expect(paySpy).toHaveBeenCalledTimes(1);

		await act(async () => {
			resolveCall(successResponse);
			await firstCall;
		});

		expect(result.current.isSubmitting).toBe(false);
		expect(result.current.result).toEqual(successResponse);

		paySpy.mockRestore();
	});

	it("resets state when reset is called", async () => {
		vi.spyOn(bookingPaymentService, "pay").mockResolvedValue(successResponse);

		const { result } = renderHook(() => usePayBooking());

		await act(async () => {
			await result.current.submit(bookingId, { method: "CARD" });
		});

		expect(result.current.result).not.toBeNull();

		act(() => {
			result.current.reset();
		});

		expect(result.current.result).toBeNull();
		expect(result.current.error).toBeNull();
	});
});
