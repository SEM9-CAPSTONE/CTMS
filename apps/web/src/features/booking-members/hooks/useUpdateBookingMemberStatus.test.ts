import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import type { UpdateBookingMemberStatusRequest, UpdateBookingMemberStatusResponse } from "../types";
import { useUpdateBookingMemberStatus } from "./useUpdateBookingMemberStatus";

function response(
	memberId: string,
	status: "joined" | "no_show"
): UpdateBookingMemberStatusResponse {
	return {
		id: memberId,
		bookingId: "booking-1",
		userId: "user-1",
		isPrimary: true,
		memberStatus: status,
		checkedInAt: status === "joined" ? "2035-01-01T00:00:00.000Z" : null,
		noShowAt: status === "no_show" ? "2035-01-01T00:00:00.000Z" : null,
		leftAt: null,
		statusUpdatedBy: "actor-1",
		createdAt: "2034-01-01T00:00:00.000Z",
		updatedAt: "2035-01-01T00:00:00.000Z",
	};
}

describe("useUpdateBookingMemberStatus", () => {
	const createUpdateMock = () =>
		vi.fn<
			(
				tripId: string,
				bookingId: string,
				memberId: string,
				input: UpdateBookingMemberStatusRequest
			) => Promise<UpdateBookingMemberStatusResponse>
		>();
	let updateMemberStatus: ReturnType<typeof createUpdateMock>;

	beforeEach(() => {
		vi.clearAllMocks();
		updateMemberStatus = createUpdateMock();
	});

	it.each(["joined", "no_show"] as const)(
		"submits %s and refetches after success",
		async (status) => {
			const refetch = vi.fn().mockResolvedValue(undefined);
			updateMemberStatus.mockResolvedValue(response("member-1", status));
			const { result } = renderHook(() =>
				useUpdateBookingMemberStatus(refetch, updateMemberStatus)
			);
			let outcome: unknown;
			await act(async () => {
				outcome = await result.current.updateStatus("trip-1", "booking-1", "member-1", status);
			});
			expect(updateMemberStatus).toHaveBeenCalledWith("trip-1", "booking-1", "member-1", {
				status,
			});
			expect(outcome).toEqual({ response: response("member-1", status), error: null });
			expect(refetch).toHaveBeenCalledTimes(1);
		}
	);

	it("suppresses same-member duplicates while allowing another member", async () => {
		const resolvers = new Map<string, (value: UpdateBookingMemberStatusResponse) => void>();
		updateMemberStatus.mockImplementation(
			(_tripId, _bookingId, memberId) => new Promise((resolve) => resolvers.set(memberId, resolve))
		);
		const { result } = renderHook(() => useUpdateBookingMemberStatus(vi.fn(), updateMemberStatus));
		let first!: Promise<unknown>;
		let secondMember!: Promise<unknown>;
		act(() => {
			first = result.current.updateStatus("trip-1", "booking-1", "member-1", "joined");
			secondMember = result.current.updateStatus("trip-1", "booking-2", "member-2", "joined");
		});
		await act(async () =>
			expect(
				await result.current.updateStatus("trip-1", "booking-1", "member-1", "no_show")
			).toEqual({ response: null, error: null })
		);
		expect(updateMemberStatus).toHaveBeenCalledTimes(2);
		expect(result.current.pendingMemberIds).toEqual(new Set(["member-1", "member-2"]));
		await act(async () => {
			resolvers.get("member-1")?.(response("member-1", "joined"));
			resolvers.get("member-2")?.(response("member-2", "joined"));
			await Promise.all([first, secondMember]);
		});
	});

	it.each([
		[403, "forbidden", false],
		[404, "not_found", true],
		[409, "conflict", true],
		[422, "validation", false],
		[500, "retryable", true],
	] as const)("maps %s without fabricating status", async (status, kind, shouldRefetch) => {
		const refetch = vi.fn().mockResolvedValue(undefined);
		updateMemberStatus.mockRejectedValue(new HttpError("failed", status, null));
		const { result } = renderHook(() => useUpdateBookingMemberStatus(refetch, updateMemberStatus));
		await act(async () => {
			await result.current.updateStatus("trip-1", "booking-1", "member-1", "joined");
		});
		expect(result.current.errors["member-1"]?.kind).toBe(kind);
		expect(refetch).toHaveBeenCalledTimes(shouldRefetch ? 1 : 0);
		expect(result.current.pendingMemberIds.size).toBe(0);
	});

	it("refetches before retrying an uncertain request", async () => {
		const refetch = vi.fn().mockResolvedValue(undefined);
		updateMemberStatus
			.mockRejectedValueOnce(new Error("network"))
			.mockResolvedValueOnce(response("member-1", "joined"));
		const { result } = renderHook(() => useUpdateBookingMemberStatus(refetch, updateMemberStatus));
		await act(async () => {
			await result.current.updateStatus("trip-1", "booking-1", "member-1", "joined");
		});
		await act(async () => void (await result.current.retry("member-1")));
		await waitFor(() => expect(updateMemberStatus).toHaveBeenCalledTimes(2));
		expect(refetch).toHaveBeenCalledTimes(3);
	});
});
