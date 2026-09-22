import type { ComponentType } from "react";
import type { RiskLevel, TrekkingRouteDifficulty, TripSummary } from "../types";

export interface TripCardProps {
	trip: TripSummary;
	onSelect: (tripId: string) => void;
}

export function formatVND(amount: number): string {
	return new Intl.NumberFormat("vi-VN", {
		style: "currency",
		currency: "VND",
		maximumFractionDigits: 0,
	}).format(amount);
}

export function formatDateRange(startsAt: string, endsAt: string): string {
	const start = new Date(startsAt);
	const end = new Date(endsAt);

	const startStr = start.toLocaleDateString("vi-VN", {
		day: "2-digit",
		month: "2-digit",
	});
	const endStr = end.toLocaleDateString("vi-VN", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});

	return `${startStr} - ${endStr}`;
}

export function getDifficultyBadge(difficulty: TrekkingRouteDifficulty | null): {
	label: string;
	className: string;
	dotColor: string;
} {
	switch (difficulty) {
		case "easy":
			return {
				label: "Dễ",
				className: "bg-white/90 text-emerald-800 border-emerald-200/80",
				dotColor: "bg-emerald-500",
			};
		case "moderate":
			return {
				label: "Trung bình",
				className: "bg-white/90 text-sky-800 border-sky-200/80",
				dotColor: "bg-sky-500",
			};
		case "hard":
			return {
				label: "Khó",
				className: "bg-white/90 text-amber-800 border-amber-200/80",
				dotColor: "bg-amber-500",
			};
		case "expert":
			return {
				label: "Chuyên gia",
				className: "bg-white/90 text-purple-800 border-purple-200/80",
				dotColor: "bg-purple-500",
			};
		default:
			return {
				label: "Tiêu chuẩn",
				className: "bg-white/90 text-stone-700 border-stone-200/80",
				dotColor: "bg-stone-400",
			};
	}
}

export function getWeatherRiskBadge(risk: RiskLevel | null): {
	label: string;
	className: string;
	dotColor: string;
	textColor: string;
	icon: ComponentType<{ className?: string }>;
} {
	switch (risk) {
		case "green":
			return {
				label: "Thời tiết an toàn",
				className: "bg-emerald-50 text-emerald-700 border-emerald-200",
				dotColor: "bg-emerald-500",
				textColor: "text-emerald-700",
				icon: ({ className }: { className?: string }) => (
					<span className={`inline-block size-2 rounded-full bg-emerald-500 ${className ?? ""}`} />
				),
			};
		case "yellow":
			return {
				label: "Thời tiết chú ý",
				className: "bg-amber-50 text-amber-700 border-amber-200",
				dotColor: "bg-amber-500",
				textColor: "text-amber-700",
				icon: ({ className }: { className?: string }) => (
					<span className={`inline-block size-2 rounded-full bg-amber-500 ${className ?? ""}`} />
				),
			};
		case "red":
			return {
				label: "Cảnh báo rủi ro cao",
				className: "bg-rose-50 text-rose-700 border-rose-200",
				dotColor: "bg-rose-500",
				textColor: "text-rose-700",
				icon: ({ className }: { className?: string }) => (
					<span className={`inline-block size-2 rounded-full bg-rose-500 ${className ?? ""}`} />
				),
			};
		default:
			return {
				label: "Thời tiết bình thường",
				className: "bg-gray-50 text-gray-600 border-gray-200",
				dotColor: "bg-stone-400",
				textColor: "text-stone-600",
				icon: ({ className }: { className?: string }) => (
					<span className={`inline-block size-2 rounded-full bg-stone-400 ${className ?? ""}`} />
				),
			};
	}
}

export function TripCard({ trip, onSelect }: TripCardProps) {
	const difficulty = getDifficultyBadge(trip.difficulty);
	const weather = getWeatherRiskBadge(trip.weatherRiskLevel);
	const isSoldOut = trip.remainingSeats === 0 || !trip.isBookable;

	return (
		<article
			data-testid={`trip-card-${trip.id}`}
			onClick={() => onSelect(trip.id)}
			className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-[#dfe8df] bg-white shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-[#164027]/40 hover:shadow-md cursor-pointer"
		>
			{/* Thumbnail Image Container */}
			<div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
				<img
					src={
						trip.coverImageUrl ||
						"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80"
					}
					alt={trip.title}
					className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
					loading="lazy"
				/>

				{/* Subtle Top Gradient for Badge Legibility */}
				<div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 via-black/10 to-transparent" />

				{/* Top-left: Trip Type Capsule */}
				<div className="absolute top-3 left-3">
					<span className="rounded-full bg-black/60 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-md shadow-xs">
						{trip.tripType === "day_trip" ? "Trong ngày" : `Qua đêm (${trip.durationNights}N)`}
					</span>
				</div>

				{/* Top-right: Difficulty Badge with discreet color dot */}
				<div className="absolute top-3 right-3">
					<span
						className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-md shadow-xs ${difficulty.className}`}
					>
						<span className={`size-1.5 rounded-full ${difficulty.dotColor}`} />
						<span>{difficulty.label}</span>
					</span>
				</div>

				{/* Sold Out Overlay */}
				{isSoldOut && (
					<div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
						<span className="rounded-full border border-white/30 bg-rose-600/90 px-3.5 py-1 text-xs font-bold text-white shadow-md">
							Đã hết chỗ
						</span>
					</div>
				)}
			</div>

			{/* Card Body */}
			<div className="flex flex-1 flex-col justify-between p-4">
				<div>
					{/* Title */}
					<h3 className="line-clamp-2 text-sm font-bold text-[#10221b] transition-colors duration-200 group-hover:text-[#164027] sm:text-base leading-snug">
						{trip.title}
					</h3>

					{/* Metadata Row: Natural bullet format without icon clutter */}
					<div className="mt-2.5 flex flex-wrap items-center text-xs text-[#627769]">
						<span className="font-semibold text-[#10221b]">
							{formatDateRange(trip.startsAt, trip.endsAt)}
						</span>
						<span className="mx-1.5 text-[#dfe8df]">•</span>
						<span className="font-semibold text-[#10221b]">
							{trip.remainingSeats !== null
								? trip.remainingSeats > 0
									? `Còn ${trip.remainingSeats} chỗ`
									: "Hết chỗ"
								: `${trip.seatsTaken} người tham gia`}
						</span>
					</div>

					{/* Weather status indicator */}
					<div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium">
						<span className={`size-2 rounded-full ${weather.dotColor}`} />
						<span className={weather.textColor}>{weather.label}</span>
					</div>
				</div>

				{/* Card Footer: Price & Clean CTA */}
				<div className="mt-4 flex items-end justify-between border-t border-[#edf3ed] pt-3">
					<div>
						<p className="text-[10px] font-bold uppercase tracking-wider text-[#8fa096]">Giá vé</p>
						<div className="flex items-baseline gap-1">
							<span className="text-base font-extrabold text-[#164027]">
								{formatVND(trip.pricePerPerson)}
							</span>
							<span className="text-[11px] text-[#8fa096] font-medium">/ khách</span>
						</div>
					</div>

					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onSelect(trip.id);
						}}
						className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-[#164027] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#0f2e1c]"
					>
						<span>Chi tiết</span>
					</button>
				</div>
			</div>
		</article>
	);
}
