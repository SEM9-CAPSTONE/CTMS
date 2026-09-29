import { describe, expect, it, vi } from "vitest";
import { httpClient } from "../../../core/api";
import { bookingPaymentService } from "./booking-payment.service";

describe("bookingPaymentService", () => {
	it("calls POST /bookings/:bookingId/pay with payload and Idempotency-Key header", async () => {
		const bookingId = "11111111-1111-4111-8111-111111111111";
		const idempotencyKey = "test-idempotency-key-123";
		const input = { method: "CARD" };
		const mockResponse = {
			paymentId: "22222222-2222-4222-8222-222222222222",
			bookingId,
			paymentStatus: "succeeded",
			amount: "1500000.00",
			bookingStatus: "confirmed",
			bookingPaymentStatus: "paid",
			createdAt: "2026-09-29T12:00:00.000Z",
		};

		const postSpy = vi.spyOn(httpClient, "post").mockResolvedValue(mockResponse);

		const result = await bookingPaymentService.pay(bookingId, input, idempotencyKey);

		expect(postSpy).toHaveBeenCalledWith(`/bookings/${bookingId}/pay`, input, {
			headers: {
				"Idempotency-Key": idempotencyKey,
			},
		});
		expect(result).toEqual(mockResponse);

		postSpy.mockRestore();
	});
});
