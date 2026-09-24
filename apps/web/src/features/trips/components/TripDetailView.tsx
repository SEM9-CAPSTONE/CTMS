import {
	AlertCircle,
	ArrowLeft,
	Calendar,
	Check,
	Clock,
	FileText,
	Info,
	MapPin,
	Navigation,
	ShieldAlert,
	ShieldCheck,
	Users,
	X,
} from "lucide-react";
import { useMemo } from "react";
import type { TripDetails } from "../types";
import { formatDateRange, formatVND, getDifficultyBadge, getWeatherRiskBadge } from "./TripCard";

export interface TripDetailViewProps {
	trip: TripDetails;
	onBack?: () => void;
	onBook?: (tripId: string) => void;
}

export function formatDateTime(isoString: string | null | undefined): string {
	if (!isoString) return "Chưa cập nhật";
	const d = new Date(isoString);
	return d.toLocaleDateString("vi-VN", {
		hour: "2-digit",
		minute: "2-digit",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

export function formatWaypointType(type: string): string {
	switch (type) {
		case "start":
			return "Khởi hành";
		case "checkpoint":
			return "Trạm dừng";
		case "rest":
			return "Nghỉ chân";
		case "meal":
			return "Ăn uống";
		case "activity":
			return "Hoạt động";
		case "overnight":
			return "Cắm trại qua đêm";
		case "finish":
			return "Điểm kết thúc";
		default:
			return type;
	}
}

export function TripDetailView({ trip, onBack, onBook }: TripDetailViewProps) {
	const difficulty = getDifficultyBadge(trip.difficulty ?? null);
	const weather = getWeatherRiskBadge(trip.weatherRiskLevel ?? null);
	const WeatherIcon = weather.icon;

	const sortedWaypoints = useMemo(() => {
		if (!trip.waypoints || !Array.isArray(trip.waypoints)) return [];
		return [...trip.waypoints].sort((a, b) => {
			if (a.dayNumber !== b.dayNumber) {
				return a.dayNumber - b.dayNumber;
			}
			return a.sequenceOrder - b.sequenceOrder;
		});
	}, [trip.waypoints]);

	const includesList = useMemo<string[]>(() => {
		if (!trip.includes) return [];
		if (Array.isArray(trip.includes.items)) {
			return (trip.includes.items as unknown[]).filter(
				(item): item is string => typeof item === "string"
			);
		}
		return [];
	}, [trip.includes]);

	const excludesList = useMemo<string[]>(() => {
		if (!trip.excludes) return [];
		if (Array.isArray(trip.excludes.items)) {
			return (trip.excludes.items as unknown[]).filter(
				(item): item is string => typeof item === "string"
			);
		}
		return [];
	}, [trip.excludes]);

	const isBookingClosed = new Date(trip.bookingDeadline) <= new Date();
	const isSoldOut = trip.remainingSeats === 0 || !trip.isBookable;

	return (
		<div className="space-y-8">
			{/* Top Navigation Bar */}
			{onBack && (
				<button
					type="button"
					onClick={onBack}
					className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-[#55685a] transition hover:text-[#164027]"
				>
					<ArrowLeft className="size-4" />
					<span>Quay lại danh sách chuyến đi</span>
				</button>
			)}

			{/* Hero Section */}
			<div className="overflow-hidden rounded-3xl border border-[#dfe8df] bg-white shadow-sm">
				<div className="relative aspect-[21/9] w-full min-h-[260px] bg-slate-100">
					<img
						src={
							trip.coverImageUrl ||
							"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80"
						}
						alt={trip.title}
						className="h-full w-full object-cover"
					/>
					<div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

					<div className="absolute bottom-6 left-6 right-6 flex flex-col gap-2 text-white">
						<div className="flex flex-wrap items-center gap-2">
							<span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-md">
								{trip.tripType === "day_trip"
									? "Chuyến đi trong ngày"
									: `Chuyến đi qua đêm (${trip.durationNights} đêm)`}
							</span>
							<span
								className={`rounded-full border px-3 py-1 text-xs font-bold backdrop-blur-md ${difficulty.className}`}
							>
								Độ khó: {difficulty.label}
							</span>
							<span
								className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold backdrop-blur-md ${weather.className}`}
							>
								<WeatherIcon className="size-3.5" />
								<span>{weather.label}</span>
							</span>
						</div>

						<h1 className="text-2xl font-extrabold sm:text-3xl lg:text-4xl">{trip.title}</h1>
					</div>
				</div>

				{/* Key Highlights Bar */}
				<div className="grid gap-4 border-t border-[#dfe8df] p-6 sm:grid-cols-2 lg:grid-cols-4">
					<div className="flex items-start gap-3">
						<div className="rounded-2xl bg-[#164027]/5 p-3 text-[#164027]">
							<Calendar className="size-5" />
						</div>
						<div>
							<p className="text-xs font-semibold text-[#667a6d]">Thời gian chuyến đi</p>
							<p className="mt-0.5 text-sm font-bold text-[#10221b]">
								{formatDateRange(trip.startsAt, trip.endsAt)}
							</p>
						</div>
					</div>

					<div className="flex items-start gap-3">
						<div className="rounded-2xl bg-[#164027]/5 p-3 text-[#164027]">
							<MapPin className="size-5" />
						</div>
						<div>
							<p className="text-xs font-semibold text-[#667a6d]">Điểm tập trung</p>
							<p className="mt-0.5 text-sm font-bold text-[#10221b]">
								[{trip.meetingPoint.coordinates[0].toFixed(3)},{" "}
								{trip.meetingPoint.coordinates[1].toFixed(3)}]
							</p>
							{trip.meetingAt && (
								<p className="text-[11px] text-[#667a6d]">
									Giờ hẹn: {formatDateTime(trip.meetingAt)}
								</p>
							)}
						</div>
					</div>

					<div className="flex items-start gap-3">
						<div className="rounded-2xl bg-[#164027]/5 p-3 text-[#164027]">
							<Users className="size-5" />
						</div>
						<div>
							<p className="text-xs font-semibold text-[#667a6d]">Chỗ trống / Sức chứa</p>
							<p className="mt-0.5 text-sm font-bold text-[#10221b]">
								{trip.remainingSeats !== null ? (
									trip.remainingSeats > 0 ? (
										<span className="text-emerald-700">Còn {trip.remainingSeats} chỗ</span>
									) : (
										<span className="text-rose-600">Đã hết chỗ</span>
									)
								) : (
									`${trip.seatsTaken} người đã tham gia`
								)}
							</p>
							<p className="text-[11px] text-[#667a6d]">
								Tối thiểu {trip.capacityMin}
								{trip.capacityMax ? ` - Tối đa ${trip.capacityMax}` : ""} người
							</p>
						</div>
					</div>

					<div className="flex items-start gap-3">
						<div className="rounded-2xl bg-[#164027]/5 p-3 text-[#164027]">
							<Clock className="size-5" />
						</div>
						<div>
							<p className="text-xs font-semibold text-[#667a6d]">Hạn chốt đặt chỗ</p>
							<p className="mt-0.5 text-sm font-bold text-[#10221b]">
								{formatDateTime(trip.bookingDeadline)}
							</p>
							{isBookingClosed && (
								<p className="text-[11px] font-bold text-rose-600">Đã hết hạn đặt vé</p>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Main Content & Booking Panel Grid */}
			<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
				{/* Left Column: Description, Timeline, Inclusions */}
				<div className="space-y-8">
					{/* Description */}
					{trip.description && (
						<section className="rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-sm">
							<h2 className="flex items-center gap-2 text-lg font-extrabold text-[#10221b]">
								<Info className="size-5 text-[#164027]" />
								<span>Giới thiệu hành trình</span>
							</h2>
							<p className="mt-3 text-sm text-[#4f6356] leading-relaxed whitespace-pre-line">
								{trip.description}
							</p>
						</section>
					)}

					{/* Weather Risk Notice */}
					{trip.weatherRiskLevel && trip.weatherRiskLevel !== "green" && (
						<div
							className={`flex items-start gap-3 rounded-2xl border p-4 text-xs font-medium ${
								trip.weatherRiskLevel === "red"
									? "border-rose-200 bg-rose-50 text-rose-800"
									: "border-amber-200 bg-amber-50 text-amber-800"
							}`}
						>
							<ShieldAlert className="size-5 shrink-0" />
							<div>
								<p className="font-extrabold">Lưu ý an toàn thời tiết:</p>
								<p className="mt-0.5">
									Khu vực tuyến đường này hiện có mức độ rủi ro thời tiết{" "}
									<strong>{weather.label}</strong>. Hãy trang bị đầy đủ áo mưa, đồ ấm và tuân thủ
									tuyệt đối chỉ dẫn của Hướng dẫn viên trong suốt chuyến đi.
								</p>
							</div>
						</div>
					)}

					{/* Waypoints / Itinerary Timeline */}
					<section className="rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-sm">
						<h2 className="flex items-center gap-2 text-lg font-extrabold text-[#10221b]">
							<Navigation className="size-5 text-[#164027]" />
							<span>Lộ trình & Điểm dừng ({sortedWaypoints.length} điểm)</span>
						</h2>

						{sortedWaypoints.length === 0 ? (
							<p className="mt-4 text-xs text-[#667a6d]">Lộ trình chi tiết đang được cập nhật.</p>
						) : (
							<div className="mt-6 space-y-6">
								{sortedWaypoints.map((wp, index) => (
									<div key={wp.id || index} className="relative flex gap-4">
										{/* Line connecting milestones */}
										{index < sortedWaypoints.length - 1 && (
											<div className="absolute top-8 left-4 -ml-px h-full w-0.5 bg-[#e5eee5]" />
										)}

										{/* Milestone Badge */}
										<div className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-[#164027] bg-white text-xs font-extrabold text-[#164027] shadow-xs">
											{wp.sequenceOrder}
										</div>

										{/* Milestone Details */}
										<div className="flex-1 pb-2">
											<div className="flex flex-wrap items-center gap-2">
												<h4 className="text-sm font-extrabold text-[#10221b]">{wp.name}</h4>
												<span className="rounded-md bg-[#edf3ed] px-2 py-0.5 text-[11px] font-bold text-[#55685a]">
													{formatWaypointType(wp.type)}
												</span>
												<span className="text-[11px] font-semibold text-[#8fa096]">
													Ngày {wp.dayNumber}
												</span>
											</div>

											<div className="mt-1.5 flex flex-wrap gap-4 text-xs text-[#667a6d]">
												{wp.plannedAt && (
													<span className="flex items-center gap-1">
														<Clock className="size-3.5" />
														<span>{formatDateTime(wp.plannedAt)}</span>
													</span>
												)}
												{wp.durationMinutes && <span>Thời lượng: {wp.durationMinutes} phút</span>}
												<span>
													Tọa độ: [{wp.location.coordinates[0].toFixed(3)},{" "}
													{wp.location.coordinates[1].toFixed(3)}]
												</span>
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</section>

					{/* Includes & Excludes */}
					<section className="grid gap-6 sm:grid-cols-2">
						{/* Inclusions */}
						<div className="rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-sm">
							<h3 className="flex items-center gap-2 text-base font-extrabold text-[#164027]">
								<ShieldCheck className="size-5 text-emerald-700" />
								<span>Dịch vụ bao gồm</span>
							</h3>
							{includesList.length > 0 ? (
								<ul className="mt-4 space-y-2.5 text-xs text-[#4f6356]">
									{includesList.map((item) => (
										<li key={item} className="flex items-start gap-2">
											<Check className="size-4 shrink-0 text-emerald-700" />
											<span>{item}</span>
										</li>
									))}
								</ul>
							) : (
								<p className="mt-3 text-xs text-[#667a6d]">Theo thỏa thuận tiêu chuẩn.</p>
							)}
						</div>

						{/* Exclusions */}
						<div className="rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-sm">
							<h3 className="flex items-center gap-2 text-base font-extrabold text-rose-800">
								<AlertCircle className="size-5 text-rose-700" />
								<span>Không bao gồm</span>
							</h3>
							{excludesList.length > 0 ? (
								<ul className="mt-4 space-y-2.5 text-xs text-[#4f6356]">
									{excludesList.map((item) => (
										<li key={item} className="flex items-start gap-2">
											<X className="size-4 shrink-0 text-rose-600" />
											<span>{item}</span>
										</li>
									))}
								</ul>
							) : (
								<p className="mt-3 text-xs text-[#667a6d]">Chi phí cá nhân ngoài chương trình.</p>
							)}
						</div>
					</section>

					{/* Cancellation Policy */}
					{trip.cancellationPolicy && (
						<section className="rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-sm">
							<h3 className="flex items-center gap-2 text-base font-extrabold text-[#10221b]">
								<FileText className="size-5 text-[#164027]" />
								<span>Chính sách hoàn hủy</span>
							</h3>
							<div className="mt-3 text-xs text-[#4f6356] leading-relaxed">
								{typeof trip.cancellationPolicy.policy === "string"
									? trip.cancellationPolicy.policy
									: JSON.stringify(trip.cancellationPolicy)}
							</div>
						</section>
					)}
				</div>

				{/* Right Column: Sticky Booking Action Card */}
				<div>
					<div className="sticky top-6 rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-sm">
						<p className="text-xs font-semibold text-[#8fa096]">Giá trọn gói mỗi khách</p>
						<p className="mt-1 text-3xl font-extrabold text-[#164027]">
							{formatVND(trip.pricePerPerson)}
						</p>

						<div className="mt-5 space-y-3 border-t border-[#edf3ed] pt-4 text-xs">
							<div className="flex justify-between">
								<span className="text-[#667a6d]">Trạng thái:</span>
								<span className="font-bold text-[#164027]">
									{trip.status === "published" ? "Đang mở đăng ký" : trip.status}
								</span>
							</div>

							<div className="flex justify-between">
								<span className="text-[#667a6d]">Chỗ còn trống:</span>
								<span className="font-bold">
									{trip.remainingSeats !== null
										? trip.remainingSeats > 0
											? `${trip.remainingSeats} chỗ`
											: "Hết chỗ"
										: "Liên hệ"}
								</span>
							</div>

							<div className="flex justify-between">
								<span className="text-[#667a6d]">Hạn đặt chỗ:</span>
								<span className="font-bold text-[#10221b]">
									{new Date(trip.bookingDeadline).toLocaleDateString("vi-VN")}
								</span>
							</div>
						</div>

						{/* Booking CTA Button */}
						<div className="mt-6">
							{isSoldOut ? (
								<button
									type="button"
									disabled
									className="w-full rounded-2xl bg-gray-200 py-3.5 text-sm font-bold text-gray-500 cursor-not-allowed"
								>
									Đã hết chỗ
								</button>
							) : isBookingClosed ? (
								<button
									type="button"
									disabled
									className="w-full rounded-2xl bg-gray-200 py-3.5 text-sm font-bold text-gray-500 cursor-not-allowed"
								>
									Đã hết hạn đặt vé
								</button>
							) : (
								<button
									type="button"
									onClick={() => onBook?.(trip.id)}
									className="w-full cursor-pointer rounded-2xl bg-[#164027] py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#0f2e1c] hover:shadow-md"
								>
									Đặt chỗ ngay
								</button>
							)}

							<p className="mt-3 text-center text-[11px] text-[#8fa096]">
								Xác nhận tức thì • Hỗ trợ 24/7
							</p>
						</div>
					</div>

					{/* Host Profile Card */}
					<div className="mt-6 rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-sm">
						<div className="flex items-center gap-2">
							<Users className="size-5 text-[#164027]" />
							<h3 className="text-base font-extrabold text-[#10221b]">Đơn vị tổ chức</h3>
						</div>
						<div className="mt-4 flex items-center gap-3.5">
							<div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef7f0] font-extrabold text-[#164027] ring-2 ring-[#164027]/20 text-base">
								{trip.host?.fullName ? trip.host.fullName.charAt(0).toUpperCase() : "H"}
							</div>
							<div className="min-w-0 flex-1">
								<h4 className="truncate text-sm font-extrabold text-[#10221b]">
									{trip.host?.fullName || "Host uy tín CTMS"}
								</h4>
								<div className="mt-0.5 flex items-center gap-1.5">
									<span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
										Host đã xác thực
									</span>
								</div>
							</div>
						</div>

						{trip.host?.bio && (
							<p className="mt-3.5 text-xs text-[#52665b] leading-relaxed italic border-t border-[#edf3ed] pt-3">
								"{trip.host.bio}"
							</p>
						)}

						<div className="mt-3.5 space-y-1.5 border-t border-[#edf3ed] pt-3 text-xs text-[#667a6d]">
							{trip.host?.email && (
								<div className="flex items-center gap-2">
									<span className="font-semibold text-[#8fa096]">Email:</span>
									<span className="truncate font-medium text-[#10221b]">{trip.host.email}</span>
								</div>
							)}
							{trip.host?.phone && (
								<div className="flex items-center gap-2">
									<span className="font-semibold text-[#8fa096]">Hotline:</span>
									<span className="font-medium text-[#10221b]">{trip.host.phone}</span>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
