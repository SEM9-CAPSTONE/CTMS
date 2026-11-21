import { useState } from "react";
import { toast } from "../../../shared/components/Toast";
import type { BookingDetails } from "../../booking-details/types";
import { useBookingRefund } from "../hooks/useBookingRefund";
import type { RefundRequestFormData } from "../schema/booking-refund.schema";
import { RefundRequestDialog } from "./RefundRequestDialog";
import { RefundStatusCard } from "./RefundStatusCard";

export interface BookingRefundPanelProps {
	booking: BookingDetails;
	onReload?: () => void;
}

export function BookingRefundPanel({ booking, onReload }: BookingRefundPanelProps) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const {
		refundInfo,
		isLoading,
		isError,
		error,
		clearError,
		isSubmitting,
		requestRefund,
		processObligation,
	} = useBookingRefund(booking.id);

	if (isLoading) {
		return (
			<section
				aria-label="Đang tải thông tin hoàn tiền"
				className="rounded-3xl bg-white p-6 shadow-sm"
			>
				<p className="text-sm font-semibold text-[#667a6d]">Đang tải thông tin hoàn tiền...</p>
			</section>
		);
	}

	if (isError || !refundInfo) {
		return null;
	}

	// Only show panel if booking is relevant for refunds:
	// either paid booking, cancelled, completed, or has existing refunds
	const isRelevant =
		booking.paymentStatus === "paid" ||
		booking.status === "cancelled" ||
		booking.status === "completed" ||
		refundInfo.refunds.length > 0;

	if (!isRelevant) {
		return null;
	}
	if (booking.status === "confirmed" && !refundInfo.origin && refundInfo.refunds.length === 0)
		return null;

	const handleSubmitRefund = async (formData: RefundRequestFormData) => {
		try {
			await requestRefund({
				reason: formData.reason,
				amount: formData.amount?.trim() ? formData.amount.trim() : undefined,
				origin: formData.origin,
				bankName: formData.bankName,
				accountNumber: formData.accountNumber,
				accountHolderName: formData.accountHolderName,
			});
			setDialogOpen(false);
			toast.success("Đã gửi yêu cầu hoàn tiền. Vui lòng chờ xét duyệt.");
			onReload?.();
		} catch {
			// Error is handled and surfaced by useBookingRefund
		}
	};

	const handleRetryObligation = async (obligationId: string) => {
		try {
			await processObligation(obligationId);
			onReload?.();
		} catch {
			// Error handled by hook
		}
	};

	return (
		<div className="space-y-4">
			<RefundStatusCard
				bookingStatus={booking.status}
				refundInfo={refundInfo}
				onRequestRefund={() => setDialogOpen(true)}
				onRetryObligation={handleRetryObligation}
				isSubmitting={isSubmitting}
			/>

			<RefundRequestDialog
				bookingStatus={booking.status}
				open={dialogOpen}
				isSubmitting={isSubmitting}
				error={error}
				maxRefundableAmount={refundInfo.remainingRefundableAmount}
				defaultOrigin={refundInfo.origin}
				onSubmit={handleSubmitRefund}
				onClose={() => setDialogOpen(false)}
				onClearError={clearError}
			/>
		</div>
	);
}
