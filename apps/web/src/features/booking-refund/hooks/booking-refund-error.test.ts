import { describe, expect, it } from "vitest";
import { HttpError } from "../../../core/api";
import { mapBookingRefundError } from "./booking-refund-error";

describe("mapBookingRefundError", () => {
	it("maps network or non-HttpError to retryable error", () => {
		const mapped = mapBookingRefundError(new Error("Network disconnect"));
		expect(mapped.kind).toBe("retryable");
		expect(mapped.canRetry).toBe(true);
	});

	it("maps 401 and 403 to forbidden error", () => {
		const err401 = new HttpError("Unauthorized", 401, {});
		expect(mapBookingRefundError(err401).kind).toBe("forbidden");

		const err403 = new HttpError("Forbidden", 403, {});
		expect(mapBookingRefundError(err403).kind).toBe("forbidden");
		expect(mapBookingRefundError(err403).canRetry).toBe(false);
	});

	it("maps 404 to not_found error", () => {
		const err404 = new HttpError("Booking not found", 404, {});
		expect(mapBookingRefundError(err404).kind).toBe("not_found");
	});

	it("maps 409 window errors correctly", () => {
		const windowErr = new HttpError("Refund window has expired", 409, {});
		const mapped = mapBookingRefundError(windowErr);
		expect(mapped.kind).toBe("conflict_window");
		expect(mapped.canRetry).toBe(false);
	});

	it("maps 409 amount cap errors correctly", () => {
		const capErr = new HttpError("Requested refund exceeds remaining refundable amount", 409, {});
		const mapped = mapBookingRefundError(capErr);
		expect(mapped.kind).toBe("conflict_cap");
		expect(mapped.canRetry).toBe(true);
	});

	it("maps 409 provider error correctly", () => {
		const providerErr = new HttpError("Provider failed to process refund", 409, {});
		const mapped = mapBookingRefundError(providerErr);
		expect(mapped.kind).toBe("provider_error");
		expect(mapped.canRetry).toBe(true);
	});

	it("maps 422 to validation error", () => {
		const valErr = new HttpError("Invalid amount format", 422, {});
		const mapped = mapBookingRefundError(valErr);
		expect(mapped.kind).toBe("validation");
	});

	it("maps 500+ to retryable error", () => {
		const srvErr = new HttpError("Internal Server Error", 500, {});
		const mapped = mapBookingRefundError(srvErr);
		expect(mapped.kind).toBe("retryable");
		expect(mapped.canRetry).toBe(true);
	});
});
