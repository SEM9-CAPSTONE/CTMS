import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BookingRefundInfo } from "../types";
import { RefundStatusCard } from "./RefundStatusCard";

describe("RefundStatusCard", () => {
	const baseInfo: BookingRefundInfo = {
		bookingId: "b-1",
		isEligible: true,
		chargeAmount: "1000000.00",
		totalRefundedAmount: "0.00",
		remainingRefundableAmount: "1000000.00",
		refunds: [],
		settlementBlocked: false,
		awaitingResolution: false,
		applicableWindow: {
			description: "Trong vòng 24 giờ kể từ khi hoàn thành chuyến đi",
			deadline: "2030-05-02T12:00:00Z",
			isExpired: false,
		},
	};

	it("renders financial summary and opens refund request modal when eligible", () => {
		const onOpen = vi.fn();
		render(
			<RefundStatusCard refundInfo={baseInfo} onRequestRefund={onOpen} isSubmitting={false} />
		);

		expect(screen.getByText("Thông tin hoàn tiền")).toBeInTheDocument();
		expect(screen.getByTestId("remaining-refundable-amount")).toBeInTheDocument();
		expect(
			screen.getByText("Trong vòng 24 giờ kể từ khi hoàn thành chuyến đi")
		).toBeInTheDocument();

		const button = screen.getByTestId("open-refund-request-modal");
		expect(button).toBeInTheDocument();
		fireEvent.click(button);
		expect(onOpen).toHaveBeenCalledTimes(1);
	});

	it("displays pending status notice and suppresses false success", () => {
		const pendingInfo: BookingRefundInfo = {
			...baseInfo,
			refunds: [
				{
					id: "r-pending-1",
					amount: "500000.00",
					status: "pending",
					createdAt: "2030-05-01T10:00:00Z",
				},
			],
		};

		render(
			<RefundStatusCard refundInfo={pendingInfo} onRequestRefund={vi.fn()} isSubmitting={false} />
		);

		expect(screen.getByText("Đang chờ chuyển tiền hoàn")).toBeInTheDocument();
		expect(screen.getAllByTestId("refund-status-badge-pending").length).toBeGreaterThanOrEqual(1);
		// Must not show as completed / succeeded
		expect(screen.queryByTestId("refund-status-badge-succeeded")).not.toBeInTheDocument();
	});

	it("displays settlement blocked alert when claim is active", () => {
		const blockedInfo: BookingRefundInfo = {
			...baseInfo,
			settlementBlocked: true,
		};

		render(
			<RefundStatusCard refundInfo={blockedInfo} onRequestRefund={vi.fn()} isSubmitting={false} />
		);

		expect(screen.getByText(/Yêu cầu đang được kiểm tra/)).toBeInTheDocument();
	});

	it("renders retry button for failed refund transaction", () => {
		const failedInfo: BookingRefundInfo = {
			...baseInfo,
			refunds: [
				{
					id: "r-failed-1",
					amount: "500000.00",
					status: "failed",
					createdAt: "2030-05-01T10:00:00Z",
				},
			],
		};
		const onRetry = vi.fn();

		render(
			<RefundStatusCard
				refundInfo={failedInfo}
				onRequestRefund={vi.fn()}
				onRetryObligation={onRetry}
				isSubmitting={false}
			/>
		);

		const retryBtn = screen.getByRole("button", { name: "Thử lại" });
		expect(retryBtn).toBeInTheDocument();
		fireEvent.click(retryBtn);
		expect(onRetry).toHaveBeenCalledWith("r-failed-1");
	});

	it("shows expired notice when window is expired and disables request", () => {
		const expiredInfo: BookingRefundInfo = {
			...baseInfo,
			isEligible: false,
			applicableWindow: {
				description: "Trong vòng 24 giờ kể từ khi hoàn thành chuyến đi",
				deadline: "2030-05-02T12:00:00Z",
				isExpired: true,
			},
		};

		render(
			<RefundStatusCard refundInfo={expiredInfo} onRequestRefund={vi.fn()} isSubmitting={false} />
		);

		expect(screen.getByText("(Đã hết hạn)")).toBeInTheDocument();
		expect(screen.queryByTestId("open-refund-request-modal")).not.toBeInTheDocument();
	});

	it("shows full refund notice and suppresses request button when fully refunded", () => {
		const fullyRefundedInfo: BookingRefundInfo = {
			...baseInfo,
			isEligible: false,
			chargeAmount: "500000.00",
			totalRefundedAmount: "500000.00",
			remainingRefundableAmount: "0.00",
			refunds: [
				{
					id: "r-succeeded-1",
					amount: "500000.00",
					status: "succeeded",
					createdAt: "2026-10-14T22:39:00Z",
					providerReference: "PAYOS-REF-500000",
				},
			],
		};

		render(
			<RefundStatusCard
				refundInfo={fullyRefundedInfo}
				onRequestRefund={vi.fn()}
				isSubmitting={false}
			/>
		);

		expect(screen.getByText("Toàn bộ số tiền đã thanh toán đã được hoàn tất.")).toBeInTheDocument();
		expect(screen.queryByTestId("open-refund-request-modal")).not.toBeInTheDocument();
	});
	it("presents an automatic cancellation refund without asking the Camper to submit a request", () => {
		render(
			<RefundStatusCard
				refundInfo={{
					...baseInfo,
					origin: "camper_cancellation",
					isEligible: false,
					remainingRefundableAmount: "0.00",
					refunds: [
						{
							id: "r-cancel-1",
							amount: "1000000.00",
							status: "pending",
							reviewStatus: null,
							createdAt: "2030-05-01T10:00:00Z",
						},
					],
				}}
				bookingStatus="cancelled"
				onRequestRefund={vi.fn()}
				isSubmitting={false}
			/>
		);

		expect(screen.getByText("Hoàn tiền sau khi hủy đặt chỗ")).toBeInTheDocument();
		expect(screen.getByText("1. Hủy đặt chỗ")).toBeInTheDocument();
		expect(screen.getByText("Đã hủy")).toBeInTheDocument();
		expect(screen.getByText("Khoản hoàn")).toBeInTheDocument();
		expect(screen.getByText(/Ngày tạo:/)).toBeInTheDocument();
		expect(screen.queryByText("1. Gửi yêu cầu")).not.toBeInTheDocument();
		expect(screen.queryByText("Yêu cầu đã gửi")).not.toBeInTheDocument();
		expect(screen.queryByTestId("open-refund-request-modal")).not.toBeInTheDocument();
	});
});
