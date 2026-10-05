import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { useTripMemberRoster } from "../hooks/useTripMemberRoster";
import type { useUpdateBookingMemberStatus } from "../hooks/useUpdateBookingMemberStatus";
import type {
	BookingMemberStatus,
	RosterBookingStatus,
	RosterTripStatus,
	TripMemberRosterResponse,
} from "../types";
import { TripMemberRoster } from "./TripMemberRoster";

const refetch = vi.fn().mockResolvedValue(undefined);
const updateStatus = vi.fn().mockResolvedValue({ response: null, error: null });
const retry = vi.fn();
let rosterHookResult: ReturnType<typeof useTripMemberRoster>;
let mutationHookResult: ReturnType<typeof useUpdateBookingMemberStatus>;

function TestTripMemberRoster() {
	return (
		<TripMemberRoster
			tripId="trip-1"
			useRoster={() => rosterHookResult}
			useStatusMutation={() => mutationHookResult}
		/>
	);
}

function roster(
	memberStatus: BookingMemberStatus = "registered",
	bookingStatus: RosterBookingStatus = "confirmed",
	tripStatus: RosterTripStatus = "published"
): TripMemberRosterResponse {
	return {
		tripId: "trip-1",
		status: tripStatus,
		startsAt: "2035-01-01T00:00:00.000Z",
		members: [
			{
				memberId: "member-1",
				bookingId: "booking-1",
				userId: "raw-user-id-must-not-render",
				displayName: "Nguyễn An",
				email: "an@example.com",
				isPrimary: true,
				memberStatus,
				bookingStatus,
				checkedInAt: memberStatus === "joined" ? "2035-01-01T00:00:00.000Z" : null,
				noShowAt: memberStatus === "no_show" ? "2035-01-01T00:00:00.000Z" : null,
				leftAt: memberStatus === "left" ? "2035-01-01T00:00:00.000Z" : null,
				statusUpdatedBy: "raw-actor-id-must-not-render",
			} as never,
		],
	};
}

function setHooks(
	data: TripMemberRosterResponse | null,
	options: { loading?: boolean; pending?: string[] } = {}
) {
	rosterHookResult = {
		data,
		isLoading: options.loading ?? false,
		error: null,
		refetch,
	};
	mutationHookResult = {
		updateStatus,
		retry,
		pendingMemberIds: new Set(options.pending ?? []),
		errors: {},
		accessRevoked: false,
	};
}

describe("TripMemberRoster", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setHooks(roster());
	});

	it("renders loading and empty states", () => {
		setHooks(null, { loading: true });
		const { rerender } = render(<TestTripMemberRoster />);
		expect(screen.getByText("Đang tải danh sách thành viên...")).toBeInTheDocument();
		setHooks({ ...roster(), members: [] });
		rerender(<TestTripMemberRoster />);
		expect(screen.getByText("Chuyến đi chưa có thành viên trong danh sách.")).toBeInTheDocument();
	});

	it.each(["published", "ongoing"] as const)(
		"shows both actions for a registered confirmed member on an eligible %s Trip",
		(tripStatus) => {
			setHooks(roster("registered", "confirmed", tripStatus));
			render(<TestTripMemberRoster />);
			expect(screen.getByRole("button", { name: "Đánh dấu Nguyễn An đã tham gia" })).toBeEnabled();
			expect(
				screen.getByRole("button", { name: "Đánh dấu Nguyễn An không tham gia" })
			).toBeEnabled();
		}
	);

	it.each([
		"pending_payment",
		"pending_reconfirmation",
		"cancelled",
		"expired",
		"completed",
	] as const)("keeps a registered member read-only for Booking %s", (bookingStatus) => {
		setHooks(roster("registered", bookingStatus, "published"));
		render(<TestTripMemberRoster />);
		expect(screen.queryByRole("button", { name: /Đánh dấu Nguyễn An/ })).not.toBeInTheDocument();
		expect(screen.getByText(/Đơn đặt chỗ hiện không đủ điều kiện/)).toBeInTheDocument();
	});

	it.each(["draft", "pending_approval", "cancelled", "completed"] as const)(
		"keeps the roster read-only for Trip %s",
		(tripStatus) => {
			setHooks(roster("registered", "confirmed", tripStatus));
			render(<TestTripMemberRoster />);
			expect(screen.queryByRole("button", { name: /Đánh dấu Nguyễn An/ })).not.toBeInTheDocument();
			expect(screen.getByText(/Chuyến đi hiện không cho phép/)).toBeInTheDocument();
		}
	);

	it.each([
		["joined", "Đã tham gia"],
		["no_show", "Không tham gia"],
		["removed", "Đã xóa"],
		["left", "Đã rời chuyến"],
	] as const)("renders %s as a completed read-only state", (status, label) => {
		setHooks(roster(status));
		render(<TestTripMemberRoster />);
		expect(screen.getByText(label)).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /Đánh dấu Nguyễn An/ })).not.toBeInTheDocument();
	});

	it("renders minimum identity and primary indicator without raw IDs", () => {
		render(<TestTripMemberRoster />);
		expect(screen.getByText("Nguyễn An")).toBeInTheDocument();
		expect(screen.getByText("an@example.com")).toBeInTheDocument();
		expect(screen.getByText("Người đặt chính")).toBeInTheDocument();
		expect(screen.queryByText("raw-user-id-must-not-render")).not.toBeInTheDocument();
		expect(screen.queryByText("raw-actor-id-must-not-render")).not.toBeInTheDocument();
	});

	it("disables both controls only for the pending row", () => {
		const data = roster();
		data.members.push({
			...data.members[0],
			memberId: "member-2",
			bookingId: "booking-2",
			displayName: "Trần Bình",
		});
		setHooks(data, { pending: ["member-1"] });
		render(<TestTripMemberRoster />);
		const first = screen.getByText("Nguyễn An").closest("li");
		const second = screen.getByText("Trần Bình").closest("li");
		expect(first).not.toBeNull();
		expect(second).not.toBeNull();
		expect(
			within(first as HTMLElement)
				.getAllByRole("button")
				.every((button) => button.hasAttribute("disabled"))
		).toBe(true);
		expect(
			within(second as HTMLElement)
				.getAllByRole("button")
				.every((button) => !button.hasAttribute("disabled"))
		).toBe(true);
	});

	it("submits joined directly and confirms no-show before submitting", async () => {
		render(<TestTripMemberRoster />);
		fireEvent.click(screen.getByRole("button", { name: "Đánh dấu Nguyễn An đã tham gia" }));
		expect(updateStatus).toHaveBeenCalledWith("trip-1", "booking-1", "member-1", "joined");
		fireEvent.click(screen.getByRole("button", { name: "Đánh dấu Nguyễn An không tham gia" }));
		expect(screen.getByRole("heading", { name: "Xác nhận không tham gia" })).toBeInTheDocument();
		fireEvent.click(screen.getByTestId("confirm-modal-submit"));
		expect(updateStatus).toHaveBeenCalledWith("trip-1", "booking-1", "member-1", "no_show");
	});
});
