import { Bell } from "lucide-react";
import { useState } from "react";
import { departureReasonLabel, departureTime } from "../copy";
import { useDepartureInbox } from "../hooks/useDepartureInbox";

/** Server filters by recipient and current ownership; never infer ownership from a Trip ID. */
export function DepartureInbox({ actor }: { actor: string }) {
	const [open, setOpen] = useState(false);
	const { inbox, read, forbidden } = useDepartureInbox(actor);
	const items = inbox.isError ? [] : (inbox.data ?? []);
	const unread = items.filter((item) => !item.readAt && !item.resolved).length;
	return (
		<section className="mx-4 my-3 rounded-2xl border border-amber-200 bg-white p-4 text-sm">
			<button
				type="button"
				className="flex min-h-12 items-center gap-2 font-bold"
				aria-expanded={open}
				onClick={() => {
					setOpen(!open);
					if (!open) void inbox.refetch();
				}}
			>
				<Bell className="size-5" /> Thông báo khởi hành{" "}
				<span aria-label="Chưa đọc">({unread})</span>
			</button>
			{open && (
				<div className="space-y-3">
					<p>50 thông báo gần nhất; tự cập nhật mỗi phút và khi quay lại trang.</p>
					<p>Đã đọc không có nghĩa là đã gỡ chặn khởi hành.</p>
					{inbox.isPending && <output>Đang tải thông báo…</output>}
					{inbox.isError && (
						<p role="alert">
							{forbidden
								? "Bạn không có quyền xem thông báo này."
								: "Không tải được thông báo. Kiểm tra kết nối rồi thử lại."}
						</p>
					)}
					<button type="button" className="min-h-12 underline" onClick={() => void inbox.refetch()}>
						Tải lại
					</button>
					{!inbox.isPending && !inbox.isError && items.length === 0 && (
						<p>Chưa có thông báo chặn khởi hành.</p>
					)}
					<ul className="max-h-96 space-y-3 overflow-y-auto">
						{items.map((item) => (
							<li key={item.id} className="rounded-xl border p-3">
								<p className="font-bold">
									{item.resolved
										? "Đã xử lý · Chuyến đã kết thúc"
										: item.active
											? "Chưa sẵn sàng khởi hành"
											: "Thông báo trước đây · Đã thay đổi"}
								</p>
								<p className="font-semibold">{item.tripTitle ?? `Chuyến ${item.tripId}`}</p>
								{item.startsAt && <p>Khởi hành: {departureTime(item.startsAt)}</p>}
								<p>{departureReasonLabel(item.reasonCode)}</p>
								<time dateTime={item.createdAt}>{departureTime(item.createdAt)}</time>
								<div className="flex flex-wrap gap-4">
									<a
										className="flex min-h-12 items-center underline"
										href={`/trips/${item.tripId}`}
									>
										Xem chuyến đi
									</a>
									{!item.readAt && !item.resolved && (
										<button
											className="min-h-12 underline"
											type="button"
											disabled={read.isPending}
											onClick={() => read.mutate(item.id)}
										>
											Đánh dấu đã đọc
										</button>
									)}
									{item.readAt && <span className="flex min-h-12 items-center">Đã đọc</span>}
								</div>
							</li>
						))}
					</ul>
					{read.isError && (
						<p role="alert">Không thể đánh dấu đã đọc. Quyền truy cập có thể đã thay đổi.</p>
					)}
				</div>
			)}
		</section>
	);
}
