import { Bell, X } from "lucide-react";
import { useRef } from "react";
import { useBookingCancellationNotices } from "../hooks/useBookingCancellationNotices";

export function BookingCancellationNotices() {
	const dialog = useRef<HTMLDialogElement>(null);
	const { query, markRead, unread } = useBookingCancellationNotices();
	return (
		<>
			<button
				type="button"
				aria-label={`Thông báo hủy đặt chỗ (${unread} chưa đọc)`}
				title="Thông báo"
				onClick={() => dialog.current?.showModal()}
				className="relative shrink-0 rounded-full p-2 text-[#164027] hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-700"
			>
				<Bell className="size-5" />
				{unread > 0 && (
					<span className="absolute -right-1 -top-1 rounded-full bg-rose-600 px-1.5 text-[10px] font-bold text-white">
						{unread}
					</span>
				)}
			</button>
			<dialog
				ref={dialog}
				aria-label="Thông báo hủy đặt chỗ"
				className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-emerald-200 bg-white p-5 text-sm text-[#10221b] shadow-xl backdrop:bg-black/40"
			>
				<div className="flex items-center justify-between gap-3">
					<h2 className="font-bold">Thông báo hủy đặt chỗ ({unread} chưa đọc)</h2>
					<button
						type="button"
						aria-label="Đóng thông báo"
						onClick={() => dialog.current?.close()}
						className="rounded-full p-2 hover:bg-emerald-50"
					>
						<X className="size-5" />
					</button>
				</div>
				{query.isLoading && <p className="mt-3">Đang tải thông báo...</p>}
				{query.isError && (
					<button type="button" onClick={() => void query.refetch()} className="mt-3 underline">
						Không tải được thông báo. Thử lại
					</button>
				)}
				{query.data?.length === 0 && <p className="mt-3">Chưa có thông báo hủy đặt chỗ.</p>}
				{markRead.isError && <p role="alert">Không thể đánh dấu đã đọc. Vui lòng thử lại.</p>}
				<ul className="mt-3 max-h-80 space-y-3 overflow-y-auto" aria-live="polite">
					{query.data?.map((notice) => (
						<li key={notice.id} className="rounded-lg bg-emerald-50 p-3">
							<p>
								<strong>{notice.camperName ?? "Camper"}</strong> đã hủy đặt chỗ cho{" "}
								<a className="font-bold underline" href={`/trips/${notice.tripId}`}>
									{notice.tripTitle}
								</a>
								.
							</p>
							<p className="mt-1 whitespace-pre-wrap">
								Lý do: {notice.reason ?? "Không có lý do trong dữ liệu cũ"}
							</p>
							{!notice.readAt && (
								<button
									type="button"
									disabled={markRead.isPending}
									onClick={() => markRead.mutate(notice.id)}
									className="mt-2 text-xs font-bold underline"
								>
									Đánh dấu đã đọc
								</button>
							)}
							<p className="mt-1 text-xs text-slate-600">
								Mã đơn: {notice.bookingId} · {new Date(notice.createdAt).toLocaleString("vi-VN")}
							</p>
						</li>
					))}
				</ul>
				<p className="mt-2 text-xs text-slate-500">
					50 thông báo gần nhất · Tự cập nhật mỗi 30 giây
				</p>
			</dialog>
		</>
	);
}
