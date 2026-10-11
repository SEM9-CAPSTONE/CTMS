import { beforeEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "../../../core/api";
import { bookingRefundService } from "./booking-refund.service";

describe("bookingRefundService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("fetches refund info via GET /bookings/:id/refunds", async () => {
		const mockResponse = {
			bookingId: "b-1",
			isEligible: true,
			totalRefundedAmount: "0.00",
			remainingRefundableAmount: "1000000.00",
			refunds: [],
			settlementBlocked: false,
			awaitingResolution: false,
		};
		vi.spyOn(httpClient, "get").mockResolvedValue(mockResponse);

		const result = await bookingRefundService.getRefundInfo("b-1");
		expect(httpClient.get).toHaveBeenCalledWith("/bookings/b-1/refunds");
		expect(result).toBe(mockResponse);
	});

	it("posts refund request via POST /bookings/:id/refunds with idempotency header", async () => {
		const mockResponse = {
			refundId: "r-1",
			bookingId: "b-1",
			parentPaymentId: "p-1",
			amount: "500000.00",
			status: "pending",
			transactionStatus: "pending",
			policySource: "camper_complaint_resolution",
			createdAt: "2030-05-01T12:00:00Z",
		};
		vi.spyOn(httpClient, "post").mockResolvedValue(mockResponse);

		const payload = {
			reason: "Chuyến đi không đúng cam kết",
			amount: "500000.00",
		};

		const result = await bookingRefundService.requestRefund("b-1", payload, "key-uuid-1");
		expect(httpClient.post).toHaveBeenCalledWith("/bookings/b-1/refunds", payload, {
			headers: { "idempotency-key": "key-uuid-1" },
		});
		expect(result).toBe(mockResponse);
	});

	it("processes refund obligation via POST /bookings/:id/refunds/:obligationId/process", async () => {
		const mockResponse = {
			refundId: "r-1",
			bookingId: "b-1",
			parentPaymentId: "p-1",
			amount: "500000.00",
			status: "succeeded",
			transactionStatus: "succeeded",
			policySource: "booking_cancellation_policy",
			createdAt: "2030-05-01T12:00:00Z",
		};
		vi.spyOn(httpClient, "post").mockResolvedValue(mockResponse);

		const result = await bookingRefundService.processObligation("b-1", "ob-1", "key-uuid-2");
		expect(httpClient.post).toHaveBeenCalledWith(
			"/bookings/b-1/refunds/ob-1/process",
			{},
			{ headers: { "idempotency-key": "key-uuid-2" } }
		);
		expect(result).toBe(mockResponse);
	});
});
