import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { BookingListView } from "../components/BookingListView";
import { useBookingList } from "../hooks/useBookingList";

export function BookingListPage({
	onViewDetails,
}: {
	onViewDetails: (bookingId: string) => void;
}) {
	const { bookings, isLoading, error, retry } = useBookingList();
	if (isLoading) {
		return (
			<main className="flex min-h-[70vh] items-center justify-center bg-[#f4f7f2] p-6">
				<h1 className="sr-only">Đơn đặt chỗ của bạn</h1>
				<output
					aria-live="polite"
					className="flex items-center gap-3 rounded-3xl bg-white p-8 text-sm font-bold text-[#164027] shadow-sm"
				>
					<Loader2 className="size-5 animate-spin" /> Đang tải danh sách đơn đặt chỗ...
				</output>
			</main>
		);
	}
	if (error) {
		return (
			<main className="flex min-h-[70vh] items-center justify-center bg-[#f4f7f2] p-6">
				<section
					role="alert"
					className="w-full max-w-xl rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm"
				>
					<AlertTriangle className="mx-auto size-10 text-rose-700" />
					<h1 className="mt-4 text-2xl font-extrabold">Không thể tải đơn đặt chỗ</h1>
					<p className="mt-2 text-sm text-[#667a6d]">{error.message}</p>
					{error.canRetry && (
						<button
							type="button"
							onClick={() => void retry()}
							className="mt-6 inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2 text-sm font-bold text-white"
						>
							<RefreshCw className="size-4" /> Thử lại
						</button>
					)}
				</section>
			</main>
		);
	}
	return <BookingListView bookings={bookings} onViewDetails={onViewDetails} />;
}
