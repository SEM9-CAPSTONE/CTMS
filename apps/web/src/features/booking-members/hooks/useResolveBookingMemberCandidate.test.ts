import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { bookingMembersService } from "../services/booking-members.service";
import { useResolveBookingMemberCandidate } from "./useResolveBookingMemberCandidate";

describe("useResolveBookingMemberCandidate", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(bookingMembersService, "resolveCandidate");
	});

	it("resolves an exact email", async () => {
		const candidate = {
			userId: "22222222-2222-4222-8222-222222222222",
			email: "person@example.com",
		};
		vi.mocked(bookingMembersService.resolveCandidate).mockResolvedValue(candidate);
		const { result } = renderHook(() => useResolveBookingMemberCandidate());
		await act(async () =>
			expect(await result.current.resolve("booking-1", candidate.email)).toEqual(candidate)
		);
	});

	it("renders the privacy-safe backend error through hook state", async () => {
		vi.mocked(bookingMembersService.resolveCandidate).mockRejectedValue(
			new HttpError("Not found", 404, { message: "Eligible participant not found" })
		);
		const { result } = renderHook(() => useResolveBookingMemberCandidate());
		await act(async () => void (await result.current.resolve("booking-1", "missing@example.com")));
		expect(result.current.error?.message).toBe(
			"Không tìm thấy người tham gia phù hợp với email này (người dùng phải có tài khoản và đang hoạt động)."
		);
	});

	it("ignores a stale response after reset", async () => {
		let finish: (candidate: { userId: string; email: string }) => void = () => {};
		vi.mocked(bookingMembersService.resolveCandidate).mockReturnValue(
			new Promise((resolve) => {
				finish = resolve;
			})
		);
		const { result } = renderHook(() => useResolveBookingMemberCandidate());
		let pending: Promise<unknown>;
		act(() => {
			pending = result.current.resolve("booking-1", "person@example.com");
			result.current.reset();
		});
		await act(async () => {
			finish({
				userId: "22222222-2222-4222-8222-222222222222",
				email: "person@example.com",
			});
			expect(await pending).toBeNull();
		});
		expect(result.current.error).toBeNull();
		expect(result.current.isResolving).toBe(false);
	});
});
