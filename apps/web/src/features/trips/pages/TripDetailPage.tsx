import { ArrowLeft, Compass, Loader2, RefreshCw } from "lucide-react";
import { useCallback } from "react";
import { TripDetailView } from "../components/TripDetailView";
import { useBookTrip } from "../hooks/useBookTrip";
import { useTripDetail } from "../hooks/useTripDetail";

export interface TripDetailPageProps {
	tripId: string;
	onBackToList: () => void;
	onBackHome?: () => void;
	onBook?: (tripId: string, numPeople: number) => void | Promise<void>;
}

export function TripDetailPage({ tripId, onBackToList, onBackHome, onBook }: TripDetailPageProps) {
	const { trip, isLoading, error, isNotFound, retry } = useTripDetail(tripId);
	const {
		book,
		retry: retryBooking,
		clearConflict,
		isBooking,
		isSuccess: isBookingSuccess,
		error: bookingError,
		isConflict,
	} = useBookTrip();

	const handleBook = useCallback(
		async (targetTripId: string, numPeople: number) => {
			if (onBook) {
				await onBook(targetTripId, numPeople);
				return;
			}
			const result = await book({ tripId: targetTripId, numPeople });
			if (result) {
				await retry();
			}
		},
		[book, onBook, retry]
	);

	const handleConflictReload = useCallback(async () => {
		clearConflict();
		await retry();
	}, [clearConflict, retry]);

	return (
		<div className="min-h-screen bg-[#f4f7f2] font-sans text-[#10221b] antialiased">
			{/* Top Header */}
			<header className="border-b border-[#dfe8df] bg-white sticky top-0 z-20 backdrop-blur-sm bg-white/95">
				<div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
					<div className="flex items-center gap-4">
						<button
							type="button"
							aria-label="Quay lại danh sách chuyến đi"
							onClick={onBackToList}
							className="rounded-2xl border border-[#dfe8df] p-2.5 text-[#55685a] transition hover:bg-[#f6f9f6] hover:text-[#164027]"
						>
							<ArrowLeft className="size-5" />
						</button>

						<div>
							<h1 className="text-lg font-extrabold text-[#10221b] sm:text-xl">
								Chi tiết chuyến đi
							</h1>
							<p className="text-xs font-semibold text-[#667a6d]">
								Thông tin lộ trình, thời gian và điều khoản tham gia
							</p>
						</div>
					</div>

					{onBackHome && (
						<button
							type="button"
							onClick={onBackHome}
							className="text-xs font-bold text-[#55685a] hover:text-[#164027]"
						>
							Trang chủ
						</button>
					)}
				</div>
			</header>

			{/* Main Content */}
			<main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
				{isLoading && (
					<div
						data-testid="trip-detail-loading"
						className="flex flex-col items-center justify-center gap-3 rounded-3xl bg-white p-16 text-sm font-bold text-[#164027] shadow-sm"
					>
						<Loader2 className="size-6 animate-spin" />
						<span>Đang tải thông tin chi tiết chuyến đi...</span>
					</div>
				)}

				{!isLoading && isNotFound && (
					<div
						data-testid="trip-not-found"
						className="rounded-3xl border border-dashed border-[#dfe8df] bg-white p-16 text-center shadow-sm"
					>
						<div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#164027]/5 text-[#164027]">
							<Compass className="size-7" />
						</div>
						<h3 className="mt-4 text-lg font-extrabold text-[#10221b]">
							Chuyến đi không tồn tại hoặc đã kết thúc
						</h3>
						<p className="mt-1.5 text-xs text-[#667a6d]">
							Chuyến đi bạn đang tìm kiếm có thể đã bị gỡ bỏ hoặc thay đổi lịch trình.
						</p>
						<button
							type="button"
							onClick={onBackToList}
							className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-[#164027] px-6 py-3 text-xs font-bold text-white transition hover:bg-[#0f2e1c]"
						>
							<ArrowLeft className="size-4" />
							<span>Xem các chuyến đi khác</span>
						</button>
					</div>
				)}

				{!isLoading && !isNotFound && error && (
					<div
						role="alert"
						className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-800 shadow-sm"
					>
						<p className="font-extrabold">{error}</p>
						<p className="mt-1 text-xs text-rose-600">
							Vui lòng kiểm tra lại kết nối mạng và thử tải lại.
						</p>
						<div className="mt-5 flex justify-center gap-3">
							<button
								type="button"
								onClick={onBackToList}
								className="rounded-2xl border border-rose-300 px-5 py-2.5 text-xs font-bold text-rose-800 transition hover:bg-rose-100"
							>
								Quay lại danh sách
							</button>
							<button
								type="button"
								onClick={retry}
								className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-rose-700 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-rose-800"
							>
								<RefreshCw className="size-4" />
								<span>Tải lại</span>
							</button>
						</div>
					</div>
				)}

				{!isLoading && !error && trip && (
					<TripDetailView
						trip={trip}
						onBack={onBackToList}
						onBook={handleBook}
						isBooking={isBooking}
						bookingError={bookingError}
						isConflict={isConflict}
						isBookingSuccess={isBookingSuccess}
						onConflictDismiss={clearConflict}
						onConflictReload={handleConflictReload}
						onConflictRetry={retryBooking}
					/>
				)}
			</main>
		</div>
	);
}
