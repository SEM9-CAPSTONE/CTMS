import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import type { BookTripResponse } from "../types";
import { useBookTrip } from "./useBookTrip";

vi.mock("../services/trips.service", () => ({
	tripsService: {
		create: vi.fn(),
		search: vi.fn(),
		getById: vi.fn(),
		book: vi.fn(),
	},
}));

const mockBookingResponse: BookTripResponse = {
	id: "booking-123",
	tripId: "trip-999",
	userId: "user-1",
	numPeople: 2,
	status: "pending_payment",
	paymentStatus: "unpaid",
	holdExpiresAt: "2026-09-26T12:15:00.000Z",
	tripStartsAtSnapshot: "2026-10-01T01:00:00.000Z",
	tripEndsAtSnapshot: "2026-10-01T10:00:00.000Z",
	basePrice: "1000000.00",
	cancellationPolicySnapshot: null,
	createdAt: "2026-09-26T12:00:00.000Z",
};

describe("useBookTrip", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("completes booking successfully and sets isSuccess to true", async () => {
		vi.mocked(tripsService.book).mockResolvedValueOnce(mockBookingResponse);

		const { result } = renderHook(() => useBookTrip());

		expect(result.current.isBooking).toBe(false);
		expect(result.current.isSuccess).toBe(false);

		let response: BookTripResponse | null = null;
		await act(async () => {
			response = await result.current.book({ tripId: "trip-999", numPeople: 2 });
		});

		expect(response).toEqual(mockBookingResponse);
		expect(result.current.isSuccess).toBe(true);
		expect(result.current.booking).toEqual(mockBookingResponse);
		expect(result.current.error).toBeNull();
		expect(result.current.isConflict).toBe(false);
		expect(tripsService.book).toHaveBeenCalledWith(
			{ tripId: "trip-999", numPeople: 2 },
			expect.any(String)
		);
	});

	it("handles 409 conflict and marks isConflict as true (BR-210)", async () => {
		vi.mocked(tripsService.book).mockRejectedValueOnce(
			new HttpError("Conflict: trip overbooked", 409, {
				message: "Trip has only 1 seat remaining, but 2 were requested.",
			})
		);

		const { result } = renderHook(() => useBookTrip());

		await act(async () => {
			await result.current.book({ tripId: "trip-999", numPeople: 2 });
		});

		expect(result.current.isBooking).toBe(false);
		expect(result.current.isSuccess).toBe(false);
		expect(result.current.isConflict).toBe(true);
		expect(result.current.error).toContain("Trip has only 1 seat remaining");
		expect(result.current.lastInput).toEqual({ tripId: "trip-999", numPeople: 2 });
	});

	it("uses default Vietnamese conflict message when 409 errorData has no message", async () => {
		vi.mocked(tripsService.book).mockRejectedValueOnce(new HttpError("Conflict", 409, {}));

		const { result } = renderHook(() => useBookTrip());

		await act(async () => {
			await result.current.book({ tripId: "trip-999", numPeople: 1 });
		});

		expect(result.current.isConflict).toBe(true);
		expect(result.current.error).toContain("Chuyến đi không còn đủ chỗ trống");
	});

	it("handles 422 validation error and extracts field errors", async () => {
		vi.mocked(tripsService.book).mockRejectedValueOnce(
			new HttpError("Validation failed", 422, {
				message: [
					{
						field: "numPeople",
						errors: ["Số lượng khách phải lớn hơn 0"],
					},
				],
			})
		);

		const { result } = renderHook(() => useBookTrip());

		await act(async () => {
			await result.current.book({ tripId: "trip-999", numPeople: 0 });
		});

		expect(result.current.isConflict).toBe(false);
		expect(result.current.fieldErrors.numPeople).toBe("Số lượng khách phải lớn hơn 0");
		expect(result.current.error).toContain("numPeople: Số lượng khách phải lớn hơn 0");
	});

	it("handles 401 unauthenticated and 403 unauthorized errors", async () => {
		vi.mocked(tripsService.book).mockRejectedValueOnce(new HttpError("Unauthorized", 401, {}));

		const { result } = renderHook(() => useBookTrip());

		await act(async () => {
			await result.current.book({ tripId: "trip-999", numPeople: 1 });
		});

		expect(result.current.error).toContain("Phiên đăng nhập đã hết hạn");

		vi.mocked(tripsService.book).mockRejectedValueOnce(new HttpError("Forbidden", 403, {}));

		await act(async () => {
			await result.current.book({ tripId: "trip-999", numPeople: 1 });
		});

		expect(result.current.error).toContain("Bạn không có quyền");
	});

	it("handles network error and allows retry", async () => {
		vi.mocked(tripsService.book).mockRejectedValueOnce(new Error("Network connection lost"));

		const { result } = renderHook(() => useBookTrip());

		await act(async () => {
			await result.current.book({ tripId: "trip-999", numPeople: 1 });
		});

		expect(result.current.error).toContain("Lỗi kết nối mạng");
		expect(result.current.isConflict).toBe(false);

		// Now succeed on retry
		vi.mocked(tripsService.book).mockResolvedValueOnce(mockBookingResponse);

		await act(async () => {
			await result.current.retry();
		});

		expect(result.current.isSuccess).toBe(true);
		expect(result.current.error).toBeNull();
		expect(result.current.booking).toEqual(mockBookingResponse);
		expect(vi.mocked(tripsService.book).mock.calls[1][1]).toBe(
			vi.mocked(tripsService.book).mock.calls[0][1]
		);

		await act(async () => {
			await result.current.retry();
		});
		expect(tripsService.book).toHaveBeenCalledTimes(2);
	});

	it("resets state and clears conflict error", async () => {
		vi.mocked(tripsService.book).mockRejectedValueOnce(new HttpError("Conflict", 409, {}));

		const { result } = renderHook(() => useBookTrip());

		await act(async () => {
			await result.current.book({ tripId: "trip-999", numPeople: 1 });
		});

		expect(result.current.isConflict).toBe(true);

		act(() => {
			result.current.clearConflict();
		});

		expect(result.current.isConflict).toBe(false);
		expect(result.current.error).toBeNull();

		act(() => {
			result.current.reset();
		});

		expect(result.current.booking).toBeNull();
		expect(result.current.isSuccess).toBe(false);
		expect(result.current.lastInput).toBeNull();
	});

	it("prevents duplicate concurrent in-flight requests", async () => {
		let resolveBook: (value: BookTripResponse) => void = () => {};
		const pendingPromise = new Promise<BookTripResponse>((resolve) => {
			resolveBook = resolve;
		});

		vi.mocked(tripsService.book).mockReturnValueOnce(pendingPromise);

		const { result } = renderHook(() => useBookTrip());

		// Start first call
		let promise1: Promise<BookTripResponse | null>;
		act(() => {
			promise1 = result.current.book({ tripId: "trip-999", numPeople: 1 });
		});

		expect(result.current.isBooking).toBe(true);

		// Attempt second call while first is in flight
		let call2Result: BookTripResponse | null = null;
		await act(async () => {
			call2Result = await result.current.book({ tripId: "trip-999", numPeople: 1 });
		});

		expect(call2Result).toBeNull();
		expect(tripsService.book).toHaveBeenCalledTimes(1);
		const firstAttemptKey = vi.mocked(tripsService.book).mock.calls[0][1];

		// Resolve first call
		await act(async () => {
			resolveBook(mockBookingResponse);
			await promise1;
		});

		expect(result.current.isBooking).toBe(false);
		expect(result.current.isSuccess).toBe(true);
		expect(vi.mocked(tripsService.book).mock.calls[0][1]).toBe(firstAttemptKey);
	});
});
