import type { Trip } from "../types";

interface Props {
	trip: Trip;
	onReview: () => void;
}

function formatDateTime(value: string): string {
	return new Date(value).toLocaleString("vi-VN");
}

function formatPrice(value: number): string {
	return value === 0 ? "Miễn phí" : `${value.toLocaleString("vi-VN")} đ`;
}

const TRIP_TYPE_LABELS: Record<Trip["tripType"], string> = {
	day_trip: "Trong ngày",
	overnight: "Qua đêm",
};

const WAYPOINT_TYPE_LABELS: Record<string, string> = {
	start: "Điểm bắt đầu",
	checkpoint: "Checkpoint",
	rest: "Điểm nghỉ",
	meal: "Bữa ăn",
	activity: "Hoạt động",
	overnight: "Cắm trại qua đêm",
	finish: "Điểm kết thúc",
};

export function AdminTripReviewDetails({ trip, onReview }: Props) {
	return (
		<div className="space-y-5">
			<section className="rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div>
						<h2 className="text-xl font-extrabold">{trip.title}</h2>
						{trip.description && <p className="mt-1 text-sm text-[#667a6d]">{trip.description}</p>}
					</div>
					<button
						type="button"
						onClick={onReview}
						className="rounded-xl bg-[#164027] px-5 py-2.5 text-sm font-extrabold text-white hover:bg-[#276143]"
					>
						Ra quyết định
					</button>
				</div>
				<div className="mt-5 grid gap-3 sm:grid-cols-3">
					<div className="rounded-xl bg-[#f4f7f2] p-3">
						<p className="text-xs text-[#667a6d]">Trạng thái</p>
						<strong>Chờ duyệt</strong>
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
				<h2 className="font-extrabold">Waypoint theo thứ tự trip</h2>
				{trip.waypoints.length === 0 ? (
					<p className="mt-2 text-sm text-[#667a6d]">Chưa có waypoint nào.</p>
				) : (
					<ol className="mt-3 space-y-2">
						{[...trip.waypoints]
							.sort((first, second) => first.sequenceOrder - second.sequenceOrder)
							.map((waypoint) => (
								<li
									key={waypoint.id}
									className="flex items-center justify-between rounded-xl border border-[#e0ebe0] p-3 text-sm"
								>
									<span className="font-bold text-[#10221b]">
										{waypoint.sequenceOrder}. {waypoint.name}
									</span>
									<span className="text-xs font-bold text-[#667a6d]">
										{WAYPOINT_TYPE_LABELS[waypoint.type] ?? waypoint.type} · Ngày{" "}
										{waypoint.dayNumber}
									</span>
								</li>
							))}
					</ol>
				)}
			</section>
		</div>
	);
}
