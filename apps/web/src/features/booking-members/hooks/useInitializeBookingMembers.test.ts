import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bookingMembersService } from "../services/booking-members.service";
import { useInitializeBookingMembers } from "./useInitializeBookingMembers";

const FIRST = "22222222-2222-4222-8222-222222222222";
const SECOND = "33333333-3333-4333-8333-333333333333";

describe("useInitializeBookingMembers", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(bookingMembersService, "initialize");
	});

	it("reuses the key when an unchanged payload is retried", async () => {
		vi.mocked(bookingMembersService.initialize)
			.mockRejectedValueOnce(new Error("network"))
			.mockResolvedValueOnce({ bookingId: "booking-1", members: [] });
		const { result } = renderHook(() => useInitializeBookingMembers());
		await act(
			async () => void (await result.current.submit("booking-1", { members: [{ userId: FIRST }] }))
		);
		await act(async () => void (await result.current.retry()));
		expect(vi.mocked(bookingMembersService.initialize).mock.calls[0][2]).toBe(
			vi.mocked(bookingMembersService.initialize).mock.calls[1][2]
		);
	});

	it("creates a new key for a changed participant set", async () => {
		vi.mocked(bookingMembersService.initialize).mockRejectedValue(new Error("network"));
		const { result } = renderHook(() => useInitializeBookingMembers());
		await act(
			async () => void (await result.current.submit("booking-1", { members: [{ userId: FIRST }] }))
		);
		await act(
			async () => void (await result.current.submit("booking-1", { members: [{ userId: SECOND }] }))
		);
		expect(vi.mocked(bookingMembersService.initialize).mock.calls[0][2]).not.toBe(
			vi.mocked(bookingMembersService.initialize).mock.calls[1][2]
		);
	});

	it("creates a new logical attempt after reset", async () => {
		vi.mocked(bookingMembersService.initialize).mockRejectedValue(new Error("network"));
		const { result } = renderHook(() => useInitializeBookingMembers());
		await act(
			async () => void (await result.current.submit("booking-1", { members: [{ userId: FIRST }] }))
		);
		const firstKey = vi.mocked(bookingMembersService.initialize).mock.calls[0][2];
		act(() => result.current.reset());
		await act(
			async () => void (await result.current.submit("booking-1", { members: [{ userId: FIRST }] }))
		);
		expect(vi.mocked(bookingMembersService.initialize).mock.calls[1][2]).not.toBe(firstKey);
	});

	it("sorts participant IDs and blocks concurrent submission", async () => {
		let finish: (value: { bookingId: string; members: [] }) => void = () => {};
		vi.mocked(bookingMembersService.initialize).mockReturnValue(
			new Promise((resolve) => {
				finish = resolve;
			})
		);
		const { result } = renderHook(() => useInitializeBookingMembers());
		let first: Promise<unknown>;
		act(() => {
			first = result.current.submit("booking-1", {
				members: [{ userId: SECOND }, { userId: FIRST }],
			});
		});
		await act(async () =>
			expect(await result.current.submit("booking-1", { members: [] })).toBeNull()
		);
		expect(bookingMembersService.initialize).toHaveBeenCalledTimes(1);
		expect(vi.mocked(bookingMembersService.initialize).mock.calls[0][1]).toEqual({
			members: [{ userId: FIRST }, { userId: SECOND }],
		});
		await act(async () => {
			finish({ bookingId: "booking-1", members: [] });
			await first;
		});
	});
});
