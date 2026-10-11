import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { BookingDetails } from "../../booking-details/types";
import { bookingRefundService } from "../services/booking-refund.service";
import { BookingRefundPanel } from "./BookingRefundPanel";

describe("BookingRefundPanel", () => {
	beforeAll(() => {
		HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
			this.setAttribute("open", "");
		});
		HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
			this.removeAttribute("open");
		});
	});

	const mockBooking: BookingDetails = {
		id: "b-test-1",
		tripId: "t-1",
		userId: "u-1",
		numPeople: 2,
		status: "completed",
		paymentStatus: "paid",
		holdExpiresAt: null,
		tripStartsAtSnapshot: "2030-05-01T08:00:00Z",
		tripEndsAtSnapshot: "2030-05-03T18:00:00Z",
		basePrice: "1000000.00",
		totalAmount: "1000000.00",
		cancellationPolicySnapshot: null,
		createdAt: "2030-04-20T10:00:00Z",
		tripPresentation: null,
		members: [],
		equipmentItems: [],
	};

	const mockRefundInfo = {
		bookingId: "b-test-1",
		isEligible: true,
		chargeAmount: "1000000.00",
		totalRefundedAmount: "0.00",
		remainingRefundableAmount: "1000000.00",
		refunds: [],
		settlementBlocked: false,
		awaitingResolution: false,
		applicableWindow: {
			description: "Trong vòng 24 giờ kể từ khi hoàn thành chuyến đi",
			deadline: "2030-05-04T18:00:00Z",
			isExpired: false,
		},
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(bookingRefundService, "getRefundInfo").mockResolvedValue(mockRefundInfo);
		vi.spyOn(bookingRefundService, "requestRefund").mockResolvedValue({
			refundId: "r-1",
			bookingId: "b-test-1",
			parentPaymentId: "p-1",
			amount: "500000.00",
			status: "pending",
			transactionStatus: "pending",
			policySource: "camper_complaint_resolution",
			createdAt: "2030-05-03T19:00:00Z",
		});
	});

	it("renders refund information card once loaded", async () => {
		render(<BookingRefundPanel booking={mockBooking} />);

		expect(await screen.findByText("Thông tin hoàn tiền")).toBeInTheDocument();
		expect(screen.getByTestId("open-refund-request-modal")).toBeInTheDocument();
	});

	it("opens modal and submits refund request, calling onReload on completion", async () => {
		const user = userEvent.setup();
		const onReload = vi.fn();
		render(<BookingRefundPanel booking={mockBooking} onReload={onReload} />);

		const openBtn = await screen.findByTestId("open-refund-request-modal");
		await user.click(openBtn);

		expect(screen.getByText("Yêu cầu hoàn tiền & Khiếu nại")).toBeInTheDocument();

		const reasonInput = screen.getByPlaceholderText(/Mô tả chi tiết lý do yêu cầu hoàn tiền/i);
		await user.type(reasonInput, "Hướng dẫn viên không đến điểm hẹn");

		const submitBtn = screen.getByTestId("submit-refund-button");
		await user.click(submitBtn);

		await waitFor(() => {
			expect(bookingRefundService.requestRefund).toHaveBeenCalledWith(
				"b-test-1",
				expect.objectContaining({
					reason: "Hướng dẫn viên không đến điểm hẹn",
				}),
				expect.any(String)
			);
			expect(onReload).toHaveBeenCalledTimes(1);
		});
	});

	it("renders nothing when booking is not relevant for refunds", async () => {
		vi.mocked(bookingRefundService.getRefundInfo).mockResolvedValue({
			...mockRefundInfo,
			refunds: [],
		});

		const irrelevantBooking: BookingDetails = {
			...mockBooking,
			status: "pending_payment",
			paymentStatus: "unpaid",
		};

		const { container } = render(<BookingRefundPanel booking={irrelevantBooking} />);
		await waitFor(() => {
			expect(container).toBeEmptyDOMElement();
		});
	});
});
