import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { bookingCompletionService } from "../services/booking-completion.service";
import { useCompleteBooking } from "./useCompleteBooking";

describe("useCompleteBooking", () => {
	it("completes booking successfully", async () => {
		const onSuccess = vi.fn();
		const responseData = {
			id: "booking-1",
			status: "completed",
			completedAt: "2026-10-11T12:00:00.000Z",
		};
		vi.spyOn(bookingCompletionService, "completeBooking").mockResolvedValue(responseData);

		const { result } = renderHook(() => useCompleteBooking(onSuccess));

		let res: unknown;
		await act(async () => {
			res = await result.current.completeBooking("booking-1");
		});

		expect(res).toEqual(responseData);
		expect(result.current.result).toEqual(responseData);
		expect(result.current.error).toBeNull();
		expect(onSuccess).toHaveBeenCalledWith(responseData);
	});

	it("handles conflict error with backend message", async () => {
		const conflictError = new HttpError("Conflict", 409, {
			message:
				"Tất cả thành viên trong đơn đặt chỗ phải ở trạng thái đã tham gia hoặc không tham gia.",
		});
		vi.spyOn(bookingCompletionService, "completeBooking").mockRejectedValue(conflictError);

		const { result } = renderHook(() => useCompleteBooking());

		await act(async () => {
			const res = await result.current.completeBooking("booking-1");
			expect(res).toBeNull();
		});

		expect(result.current.result).toBeNull();
		expect(result.current.error?.kind).toBe("conflict");
		expect(result.current.error?.message).toBe(
			"Tất cả thành viên trong đơn đặt chỗ phải ở trạng thái đã tham gia hoặc không tham gia."
		);
	});
});
