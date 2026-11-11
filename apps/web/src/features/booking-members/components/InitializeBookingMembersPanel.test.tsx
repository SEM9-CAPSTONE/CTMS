import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BookTripResponse } from "../../trips/types";
import { useInitializeBookingMembers } from "../hooks/useInitializeBookingMembers";
import { useResolveBookingMemberCandidate } from "../hooks/useResolveBookingMemberCandidate";
import { InitializeBookingMembersPanel } from "./InitializeBookingMembersPanel";

vi.mock("../hooks/useInitializeBookingMembers", () => ({ useInitializeBookingMembers: vi.fn() }));
vi.mock("../hooks/useResolveBookingMemberCandidate", () => ({
	useResolveBookingMemberCandidate: vi.fn(),
}));

const OWNER = "11111111-1111-4111-8111-111111111111";
const MEMBER = "22222222-2222-4222-8222-222222222222";
const booking: BookTripResponse = {
	id: "77777777-7777-4777-8777-777777777777",
	tripId: "88888888-8888-4888-8888-888888888888",
	userId: OWNER,
	numPeople: 2,
	status: "pending_payment",
	paymentStatus: "unpaid",
	holdExpiresAt: "2099-09-01T00:15:00.000Z",
	tripStartsAtSnapshot: "2099-09-02T00:00:00.000Z",
	tripEndsAtSnapshot: "2099-09-03T00:00:00.000Z",
	basePrice: "100.00",
	totalAmount: "100.00",
	cancellationPolicySnapshot: null,
	createdAt: "2029-09-01T00:00:00.000Z",
};

const submit = vi.fn();
const retry = vi.fn();
const resolveCandidate = vi.fn();

describe("InitializeBookingMembersPanel", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(useInitializeBookingMembers).mockReturnValue({
			submit,
			retry,
			reset: vi.fn(),
			isSubmitting: false,
			result: null,
			error: null,
		});
		vi.mocked(useResolveBookingMemberCandidate).mockReturnValue({
			resolve: resolveCandidate,
			reset: vi.fn(),
			isResolving: false,
			error: null,
		});
	});

	it("renders a compact trigger button on sidebar and opens modal popup when clicked", () => {
		render(<InitializeBookingMembersPanel booking={booking} />);
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Xác nhận danh sách người tham gia" })
		).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Xác nhận danh sách người tham gia" }));
		expect(screen.getByRole("dialog")).toBeInTheDocument();
		expect(screen.getByText("Bạn — Người đặt chỗ chính")).toBeInTheDocument();
	});

	it("shows the owner as primary and the required additional count", () => {
		render(<InitializeBookingMembersPanel booking={booking} defaultOpen />);
		expect(screen.getByText("Bạn — Người đặt chỗ chính")).toBeInTheDocument();
		expect(screen.getByText(/Tổng: 2.*Còn lại: 1/)).toBeInTheDocument();
		expect(screen.getByLabelText("Email người tham gia 1")).toBeInTheDocument();
	});

	it("initializes an owner-only Booking with an empty member list", async () => {
		render(<InitializeBookingMembersPanel booking={{ ...booking, numPeople: 1 }} defaultOpen />);
		expect(screen.getByText("Đặt chỗ này không cần thêm người tham gia.")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Xác nhận người tham gia" }));
		await waitFor(() => expect(submit).toHaveBeenCalledWith(booking.id, { members: [] }));
	});

	it("validates email accessibly before resolving", () => {
		render(<InitializeBookingMembersPanel booking={booking} defaultOpen />);
		const input = screen.getByLabelText("Email người tham gia 1");
		fireEvent.change(input, { target: { value: "invalid" } });
		fireEvent.click(screen.getByRole("button", { name: "Xác nhận email" }));
		expect(input).toHaveAttribute("aria-invalid", "true");
		expect(screen.getByRole("alert")).toHaveTextContent("Email người tham gia không hợp lệ");
		expect(resolveCandidate).not.toHaveBeenCalled();
	});

	it("resolves a participant and submits the authoritative user id", async () => {
		resolveCandidate.mockResolvedValue({ userId: MEMBER, email: "camper2@ctms.local" });
		render(<InitializeBookingMembersPanel booking={booking} defaultOpen />);
		fireEvent.change(screen.getByLabelText("Email người tham gia 1"), {
			target: { value: "  CAMPER2@CTMS.LOCAL  " },
		});
		fireEvent.click(screen.getByRole("button", { name: "Xác nhận email" }));
		await screen.findByText("Đã xác nhận: camper2@ctms.local");
		expect(resolveCandidate).toHaveBeenCalledWith(booking.id, "camper2@ctms.local");
		fireEvent.click(screen.getByRole("button", { name: "Xác nhận danh sách" }));
		await waitFor(() =>
			expect(submit).toHaveBeenCalledWith(booking.id, { members: [{ userId: MEMBER }] })
		);
	});

	it("rejects the Booking owner and duplicate resolved participants", async () => {
		resolveCandidate
			.mockResolvedValueOnce({ userId: OWNER, email: "owner@example.com" })
			.mockResolvedValueOnce({ userId: MEMBER, email: "first@example.com" })
			.mockResolvedValueOnce({ userId: MEMBER, email: "second@example.com" });
		const threePersonBooking = { ...booking, numPeople: 3 };
		render(<InitializeBookingMembersPanel booking={threePersonBooking} defaultOpen />);

		const inputs = screen.getAllByRole("textbox");
		fireEvent.change(inputs[0], { target: { value: "owner@example.com" } });
		fireEvent.click(screen.getAllByRole("button", { name: "Xác nhận email" })[0]);
		await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("tự động thêm"));

		fireEvent.change(inputs[0], { target: { value: "first@example.com" } });
		fireEvent.click(screen.getAllByRole("button", { name: "Xác nhận email" })[0]);
		await screen.findByText("Đã xác nhận: first@example.com");
		fireEvent.change(inputs[1], { target: { value: "second@example.com" } });
		fireEvent.click(screen.getAllByRole("button", { name: "Xác nhận email" })[0]);
		await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("đã được chọn"));
		expect(submit).not.toHaveBeenCalled();
	});

	it("blocks terminal and started Bookings", () => {
		const { rerender } = render(
			<InitializeBookingMembersPanel booking={{ ...booking, status: "cancelled" }} />
		);
		expect(screen.getByRole("alert")).toHaveTextContent("không còn đủ điều kiện");
		rerender(
			<InitializeBookingMembersPanel
				booking={{ ...booking, tripStartsAtSnapshot: "2020-01-01T00:00:00.000Z" }}
			/>
		);
		expect(screen.getByRole("alert")).toHaveTextContent("đã bắt đầu");
	});

	it("allows both pending-payment and confirmed Bookings", () => {
		const { rerender } = render(<InitializeBookingMembersPanel booking={booking} defaultOpen />);
		expect(screen.getByRole("heading", { name: "Xác nhận người tham gia" })).toBeInTheDocument();
		rerender(
			<InitializeBookingMembersPanel booking={{ ...booking, status: "confirmed" }} defaultOpen />
		);
		expect(screen.getByRole("heading", { name: "Xác nhận người tham gia" })).toBeInTheDocument();
	});

	it("announces resolver and initialization loading states", () => {
		vi.mocked(useResolveBookingMemberCandidate).mockReturnValue({
			resolve: resolveCandidate,
			reset: vi.fn(),
			isResolving: true,
			error: null,
		});
		const { rerender } = render(<InitializeBookingMembersPanel booking={booking} defaultOpen />);
		expect(screen.getByRole("status")).toHaveTextContent("Đang xử lý danh sách người tham gia");

		vi.mocked(useResolveBookingMemberCandidate).mockReturnValue({
			resolve: resolveCandidate,
			reset: vi.fn(),
			isResolving: false,
			error: null,
		});
		vi.mocked(useInitializeBookingMembers).mockReturnValue({
			submit,
			retry,
			reset: vi.fn(),
			isSubmitting: true,
			result: null,
			error: null,
		});
		rerender(<InitializeBookingMembersPanel booking={booking} defaultOpen />);
		expect(screen.getByRole("status")).toHaveTextContent("Đang xử lý danh sách người tham gia");
		expect(screen.getByRole("button", { name: "Đang xác nhận..." })).toBeDisabled();
	});

	it("shows conflict and retryable network states", () => {
		vi.mocked(useInitializeBookingMembers).mockReturnValue({
			submit,
			retry,
			reset: vi.fn(),
			isSubmitting: false,
			result: null,
			error: {
				status: 409,
				message: "Booking member roster is already initialized",
				isConflict: true,
				canRetry: false,
				fieldErrors: {},
			},
		});
		const { rerender } = render(<InitializeBookingMembersPanel booking={booking} defaultOpen />);
		expect(screen.getByRole("alert")).toHaveTextContent("được xác nhận trước đó");

		vi.mocked(useInitializeBookingMembers).mockReturnValue({
			submit,
			retry,
			reset: vi.fn(),
			isSubmitting: false,
			result: null,
			error: { message: "Mất kết nối", isConflict: false, canRetry: true, fieldErrors: {} },
		});
		rerender(<InitializeBookingMembersPanel booking={booking} defaultOpen />);
		fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
		expect(retry).toHaveBeenCalled();
	});

	it("renders the authoritative roster success with current-session labels", () => {
		vi.mocked(useInitializeBookingMembers).mockReturnValue({
			submit,
			retry,
			reset: vi.fn(),
			isSubmitting: false,
			result: {
				bookingId: booking.id,
				members: [
					{
						id: "m-1",
						userId: OWNER,
						isPrimary: true,
						memberStatus: "registered",
						createdAt: "x",
						updatedAt: "x",
					},
				],
			},
			error: null,
		});
		render(<InitializeBookingMembersPanel booking={booking} defaultOpen />);
		expect(screen.getByRole("status")).toHaveTextContent(
			"Danh sách người tham gia đã được xác nhận"
		);
		expect(screen.getByRole("status")).toHaveClass("block");
		expect(screen.getByRole("status")).toHaveTextContent("Bạn");
		expect(screen.getByRole("status")).toHaveTextContent("Người đặt chỗ chính");
	});

	it("renders an authoritative confirmed roster restored from Booking Details", () => {
		render(
			<InitializeBookingMembersPanel
				booking={booking}
				defaultOpen
				confirmedRoster={{
					bookingId: booking.id,
					members: [
						{
							id: "m-owner",
							userId: OWNER,
							isPrimary: true,
							memberStatus: "registered",
							createdAt: "x",
							updatedAt: "x",
						},
						{
							id: "m-member",
							userId: MEMBER,
							isPrimary: false,
							memberStatus: "registered",
							createdAt: "x",
							updatedAt: "x",
						},
					],
				}}
				confirmedLabelsByUserId={new Map([[MEMBER, "person@example.com"]])}
			/>
		);

		expect(screen.getByRole("status")).toHaveTextContent(
			"Danh sách người tham gia đã được xác nhận"
		);
		expect(screen.getByRole("status")).toHaveTextContent("person@example.com");
		expect(screen.queryByLabelText("Email người tham gia 1")).not.toBeInTheDocument();
		expect(submit).not.toHaveBeenCalled();
	});
});
