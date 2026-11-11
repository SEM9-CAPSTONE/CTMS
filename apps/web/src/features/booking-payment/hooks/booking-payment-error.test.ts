import { describe, expect, it } from "vitest";
import { HttpError } from "../../../core/api";
import { mapBookingPaymentError } from "./booking-payment-error";

describe("mapBookingPaymentError", () => {
	it("maps network or unknown errors to retryable error", () => {
		const result = mapBookingPaymentError(new Error("Network failed"));
		expect(result.canRetry).toBe(true);
		expect(result.isConflict).toBe(false);
		expect(result.message).toContain("Không thể kết nối");
	});

	it("maps 401 error", () => {
		const error = new HttpError("Unauthorized", 401, {});
		const result = mapBookingPaymentError(error);
		expect(result.status).toBe(401);
		expect(result.isConflict).toBe(false);
		expect(result.canRetry).toBe(false);
		expect(result.message).toContain("Phiên đăng nhập đã hết hạn");
	});

	it("maps 403 error", () => {
		const error = new HttpError("Forbidden", 403, {});
		const result = mapBookingPaymentError(error);
		expect(result.status).toBe(403);
		expect(result.isConflict).toBe(false);
		expect(result.canRetry).toBe(false);
		expect(result.message).toContain("Chỉ người đặt chỗ mới có quyền thanh toán");
	});

	it("maps 404 error", () => {
		const error = new HttpError("Not Found", 404, {});
		const result = mapBookingPaymentError(error);
		expect(result.status).toBe(404);
		expect(result.isConflict).toBe(false);
		expect(result.canRetry).toBe(false);
		expect(result.message).toContain("Không tìm thấy thông tin đặt chỗ");
	});

	it("maps 409 conflict error with custom message", () => {
		const error = new HttpError("Conflict", 409, {
			message: "Booking has already been paid and confirmed",
		});
		const result = mapBookingPaymentError(error);
		expect(result.status).toBe(409);
		expect(result.isConflict).toBe(true);
		expect(result.canRetry).toBe(false);
		expect(result.message).toBe("Booking has already been paid and confirmed");
	});

	it("maps 422 error and extracts field errors", () => {
		const error = new HttpError("Unprocessable", 422, {
			message: [
				{
					field: "method",
					errors: ["method must not be empty"],
				},
			],
		});
		const result = mapBookingPaymentError(error);
		expect(result.status).toBe(422);
		expect(result.isConflict).toBe(false);
		expect(result.canRetry).toBe(false);
		expect(result.fieldErrors.method).toBe("method must not be empty");
	});

	it("maps 500 server error as retryable", () => {
		const error = new HttpError("Server error", 500, {});
		const result = mapBookingPaymentError(error);
		expect(result.status).toBe(500);
		expect(result.canRetry).toBe(true);
	});
});
