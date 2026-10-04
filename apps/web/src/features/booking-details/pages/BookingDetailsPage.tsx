import { AlertTriangle, Loader2, Lock, RefreshCw, SearchX } from "lucide-react";
import { useEffect, useMemo } from "react";
import { BookingCancellationPanel } from "../../booking-cancellation/components/BookingCancellationPanel";
import { useCancelBooking } from "../../booking-cancellation/hooks/useCancelBooking";
import type { CancelBookingRequest } from "../../booking-cancellation/types";
import { BookingDetailsView } from "../components/BookingDetailsView";
import { useBookingDetails } from "../hooks/useBookingDetails";
import type { BookingDetails } from "../types";

export interface BookingDetailsPageProps {
	bookingId: string;
	onBack: () => void;
	backLabel?: string;
	onBookingLoaded?: (booking: BookingDetails) => void;
}

export function BookingDetailsPage(props: BookingDetailsPageProps) {
	return <BookingDetailsContent key={props.bookingId} {...props} />;
}

function BookingDetailsContent({
	bookingId,
	onBack,
	backLabel = "Quay lại đơn đặt chỗ",
	onBookingLoaded,
}: BookingDetailsPageProps) {
	const { booking, isLoading, error, retry, reload, isRefreshing, refreshError } =
		useBookingDetails(bookingId);
	const cancellation = useCancelBooking(bookingId);
	// A confirmed PATCH result remains authoritative even if the following GET fails.
	const displayedBooking = useMemo(
		() =>
			booking && cancellation.result
				? {
						...booking,
						status: cancellation.result.status,
						paymentStatus: cancellation.result.paymentStatus,
					}
				: booking,
		[booking, cancellation.result]
	);
	async function handleCancel(input: CancelBookingRequest) {
		const response = await cancellation.submit(input);
		if (response) await reload();
	}

	useEffect(() => {
		if (displayedBooking) onBookingLoaded?.(displayedBooking);
	}, [displayedBooking, onBookingLoaded]);

	if (isLoading) {
		return (
			<main className="flex min-h-[70vh] items-center justify-center bg-[#f4f7f2] p-6">
				<h1 className="sr-only">Chi tiết đơn đặt chỗ</h1>
				<output
					aria-live="polite"
					className="flex items-center gap-3 rounded-3xl bg-white p-8 text-sm font-bold text-[#164027] shadow-sm"
				>
					<Loader2 className="size-5 animate-spin" /> Đang tải chi tiết đơn đặt chỗ...
				</output>
			</main>
		);
	}

	if (error) {
		const isForbidden = error.kind === "forbidden";
		const isNotFound = error.kind === "not_found";
		const isInvalid = error.kind === "invalid_reference";
		const Icon = isForbidden ? Lock : isNotFound ? SearchX : AlertTriangle;
		const title = isForbidden
			? "Không thể xem đơn đặt chỗ"
			: isNotFound
				? "Không tìm thấy đơn đặt chỗ"
				: isInvalid
					? "Mã đơn đặt chỗ không hợp lệ"
					: "Không thể tải chi tiết đơn đặt chỗ";

		return (
			<main className="flex min-h-[70vh] items-center justify-center bg-[#f4f7f2] p-6">
				<section
					role="alert"
					className="w-full max-w-xl rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm"
				>
					<Icon className="mx-auto size-10 text-rose-700" />
					<h1 className="mt-4 text-2xl font-extrabold text-[#10221b]">{title}</h1>
					<p className="mt-2 text-sm text-[#667a6d]">{error.message}</p>
					<div className="mt-6 flex flex-wrap justify-center gap-3">
						<button
							type="button"
							onClick={onBack}
							className="rounded-xl border border-[#cbd9ce] px-4 py-2 text-sm font-bold text-[#164027]"
						>
							{backLabel}
						</button>
						{error.canRetry && (
							<button
								type="button"
								onClick={() => void retry()}
								className="inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2 text-sm font-bold text-white"
							>
								<RefreshCw className="size-4" /> Thử lại
							</button>
						)}
					</div>
				</section>
			</main>
		);
	}

	return displayedBooking ? (
		<BookingDetailsView
			booking={displayedBooking}
			onBack={onBack}
			backLabel={backLabel}
			cancellationPanel={
				<div className="mt-6 space-y-3">
					<BookingCancellationPanel
						booking={displayedBooking}
						result={cancellation.result}
						error={cancellation.error}
						isSubmitting={cancellation.isSubmitting}
						isRefreshing={isRefreshing}
						onSubmit={handleCancel}
						onReload={() => void reload()}
						onBack={onBack}
					/>
					{isRefreshing && (
						<output className="block text-sm" aria-live="polite">
							Đang tải lại chi tiết đơn...
						</output>
					)}
					{refreshError && (
						<div
							role="alert"
							className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm"
						>
							<p>
								Chưa tải lại được chi tiết đơn.{" "}
								{cancellation.result
									? "Kết quả hủy đã xác nhận ở trên vẫn được giữ nguyên."
									: refreshError.message}
							</p>
							<button
								type="button"
								onClick={() => void reload()}
								disabled={isRefreshing}
								className="mt-2 rounded-lg border px-3 py-2"
							>
								Tải lại chi tiết
							</button>
						</div>
					)}
				</div>
			}
		/>
	) : null;
}
