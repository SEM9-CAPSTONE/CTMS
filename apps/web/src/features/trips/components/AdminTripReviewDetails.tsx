import { ImageOff } from "lucide-react";
import { useState } from "react";
import { type AdminTripReview, TRIP_STATUS_LABELS } from "../types";

const OUTCOME_LABELS = {
	pending: "Chờ duyệt",
	approved: "Đã phê duyệt",
	returned_for_revision: "Trả về chỉnh sửa",
	auto_rejected: "Tự động từ chối",
} as const;

interface Props {
	trip: AdminTripReview;
	onReview: () => void;
}

function formatDateTime(value: string): string {
	return new Date(value).toLocaleString("vi-VN");
}

function formatPrice(value: number): string {
	return value === 0 ? "Miễn phí" : `${value.toLocaleString("vi-VN")} đ`;
}

const TRIP_TYPE_LABELS: Record<AdminTripReview["tripType"], string> = {
	day_trip: "Trong ngày",
	overnight: "Qua đêm",
};

const WAYPOINT_TYPE_LABELS: Record<string, string> = {
	start: "Điểm bắt đầu",
	checkpoint: "Điểm kiểm tra",
	rest: "Điểm nghỉ",
	meal: "Bữa ăn",
	activity: "Hoạt động",
	overnight: "Cắm trại qua đêm",
	finish: "Điểm kết thúc",
};

function CoverImage({ title, url }: { title: string; url: string | null }) {
	// Tracks the URL that failed so switching to another Trip retries its own image.
	const [failedUrl, setFailedUrl] = useState<string | null>(null);

	if (!url) {
		return (
			<div className="flex h-48 items-center justify-center gap-2 rounded-xl bg-[#f4f7f2] text-sm font-bold text-[#667a6d]">
				<ImageOff className="size-4" />
				Host chưa tải ảnh bìa.
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{failedUrl === url ? (
				<div className="flex h-48 items-center justify-center gap-2 rounded-xl bg-amber-50 text-sm font-bold text-amber-800">
					<ImageOff className="size-4" />
					Không tải được ảnh bìa.
				</div>
			) : (
				<img
					src={url}
					alt={`Ảnh bìa ${title}`}
					className="h-64 w-full rounded-xl object-cover"
					onError={() => setFailedUrl(url)}
				/>
			)}
			<a
				href={url}
				target="_blank"
				rel="noopener noreferrer"
				className="inline-block text-xs font-bold text-[#164027] underline"
			>
				Xem ảnh gốc
			</a>
		</div>
	);
}

export function AdminTripReviewDetails({ trip, onReview }: Props) {
	const canReview = trip.reviewOutcome === "pending" && trip.status === "pending_approval";
	return (
		<div className="space-y-5">
			<section className="rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm">
				<h2 className="mb-3 font-extrabold">Ảnh bìa</h2>
				<CoverImage title={trip.title} url={trip.coverImageUrl} />
			</section>
			<section className="rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div>
						<h2 className="text-xl font-extrabold">{trip.title}</h2>
						{trip.description && <p className="mt-1 text-sm text-[#667a6d]">{trip.description}</p>}
					</div>
					{canReview ? (
						<button
							type="button"
							onClick={onReview}
							className="rounded-xl bg-[#164027] px-5 py-2.5 text-sm font-extrabold text-white hover:bg-[#276143]"
						>
							Ra quyết định
						</button>
					) : (
						<span className="rounded-xl bg-[#f4f7f2] px-4 py-2 text-sm font-bold text-[#667a6d]">
							Chỉ xem
						</span>
					)}
				</div>
				<div className="mt-5 grid gap-3 sm:grid-cols-3">
					<div className="rounded-xl bg-[#f4f7f2] p-3">
						<p className="text-xs text-[#667a6d]">Kết quả xét duyệt</p>
						<strong>{OUTCOME_LABELS[trip.reviewOutcome]}</strong>
					</div>
					<div className="rounded-xl bg-[#f4f7f2] p-3">
						<p className="text-xs text-[#667a6d]">Trạng thái hiện tại</p>
						<strong>{TRIP_STATUS_LABELS[trip.status]}</strong>
					</div>
					<div className="rounded-xl bg-[#f4f7f2] p-3">
						<p className="text-xs text-[#667a6d]">Loại trip</p>
						<strong>{TRIP_TYPE_LABELS[trip.tripType]}</strong>
					</div>
					<div className="rounded-xl bg-[#f4f7f2] p-3">
						<p className="text-xs text-[#667a6d]">Số đêm</p>
						<strong>{trip.durationNights}</strong>
					</div>
					<div className="rounded-xl bg-[#f4f7f2] p-3">
						<p className="text-xs text-[#667a6d]">Bắt đầu</p>
						<strong>{formatDateTime(trip.startsAt)}</strong>
					</div>
					<div className="rounded-xl bg-[#f4f7f2] p-3">
						<p className="text-xs text-[#667a6d]">Kết thúc</p>
						<strong>{formatDateTime(trip.endsAt)}</strong>
					</div>
					<div className="rounded-xl bg-[#f4f7f2] p-3">
						<p className="text-xs text-[#667a6d]">Hạn đăng ký</p>
						<strong>{formatDateTime(trip.bookingDeadline)}</strong>
					</div>
					<div className="rounded-xl bg-[#f4f7f2] p-3">
						<p className="text-xs text-[#667a6d]">Sức chứa</p>
						<strong>
							{trip.capacityMin}
							{trip.capacityMax != null ? `–${trip.capacityMax}` : "+"} khách
						</strong>
					</div>
					<div className="rounded-xl bg-[#f4f7f2] p-3">
						<p className="text-xs text-[#667a6d]">Giá / người</p>
						<strong>{formatPrice(trip.pricePerPerson)}</strong>
					</div>
					<div className="rounded-xl bg-[#f4f7f2] p-3">
						<p className="text-xs text-[#667a6d]">Route ID</p>
						<strong className="break-all">{trip.routeId}</strong>
					</div>
				</div>
			</section>
			<section className="rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm">
				<h2 className="font-extrabold">Lịch trình điểm dừng</h2>
				{trip.waypoints.length === 0 ? (
					<p className="mt-2 text-sm text-[#667a6d]">Chưa có điểm dừng nào.</p>
				) : (
					<ol className="mt-3 space-y-2">
						{[...trip.waypoints]
							.sort(
								(first, second) =>
									new Date(first.plannedAt ?? 0).getTime() -
									new Date(second.plannedAt ?? 0).getTime()
							)
							.map((waypoint, index) => (
								<li
									key={waypoint.id}
									className="flex items-center justify-between rounded-xl border border-[#e0ebe0] p-3 text-sm"
								>
									<span className="font-bold text-[#10221b]">
										{index + 1}. {waypoint.name}
									</span>
									<span className="text-xs font-bold text-[#667a6d]">
										{WAYPOINT_TYPE_LABELS[waypoint.type] ?? waypoint.type}
										{waypoint.plannedAt ? ` · ${formatDateTime(waypoint.plannedAt)}` : ""}
									</span>
								</li>
							))}
					</ol>
				)}
			</section>
		</div>
	);
}
