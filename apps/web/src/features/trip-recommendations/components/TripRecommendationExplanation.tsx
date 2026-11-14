import {
	AlertTriangle,
	Cake,
	CalendarClock,
	CheckCircle2,
	Footprints,
	HeartPulse,
	Info,
	Leaf,
	Loader2,
	MapPin,
	Mountain,
	Quote,
	RefreshCw,
	Route,
	ShieldAlert,
	Sparkles,
	Tag,
	Tent,
	Ticket,
	Utensils,
} from "lucide-react";
import type { ComponentType } from "react";
import { HttpError } from "../../../core/api";
import { useTripRecommendationExplanation } from "../hooks/useTripRecommendations";
import type {
	ExplanationKind,
	ExplanationSource,
	TripRecommendationExplanationSection,
} from "../types";

type Icon = ComponentType<{ className?: string }>;

const KIND_ICON: Record<ExplanationKind, Icon> = {
	trip_type: Tent,
	fitness: HeartPulse,
	difficulty: Mountain,
	health_note: ShieldAlert,
	allergy: Leaf,
	diet: Utensils,
	age: Cake,
	interest: Sparkles,
	experience: Footprints,
	region: MapPin,
	price: Tag,
	route: Route,
	timing: CalendarClock,
	availability: Ticket,
};

/** Where the quoted entry lives, so the Camper can find and change it. */
const SOURCE_LABEL: Record<ExplanationSource, string> = {
	health_profile: "Hồ sơ sức khỏe",
	personal_profile: "Hồ sơ cá nhân",
	trip_preferences: "Sở thích chuyến đi",
	booking_history: "Lịch sử chuyến đi",
};

const TONE_STYLE: Record<TripRecommendationExplanationSection["tone"], string> = {
	match: "border-[#cfe3d2] bg-[#f1f8f2] text-[#164027]",
	info: "border-[#e0ebe0] bg-white text-[#3b5446]",
	caution: "border-amber-200 bg-amber-50 text-amber-900",
};

const TONE_BADGE: Record<
	TripRecommendationExplanationSection["tone"],
	{ label: string; icon: Icon }
> = {
	match: { label: "Phù hợp", icon: CheckCircle2 },
	info: { label: "Thông tin", icon: Info },
	caution: { label: "Cần lưu ý", icon: AlertTriangle },
};

export interface TripRecommendationExplanationProps {
	tripId: string;
}

function SectionItem({ section }: { section: TripRecommendationExplanationSection }) {
	const KindIcon = KIND_ICON[section.kind] ?? Info;
	const badge = TONE_BADGE[section.tone];
	const BadgeIcon = badge.icon;
	return (
		<li className={`flex gap-3 rounded-2xl border p-4 ${TONE_STYLE[section.tone]}`}>
			<KindIcon className="mt-0.5 size-4 shrink-0" />
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-2">
					<h3 className="text-sm font-extrabold">{section.title}</h3>
					<span className="inline-flex items-center gap-1 rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] font-bold">
						<BadgeIcon className="size-3" />
						{badge.label}
					</span>
				</div>

				{section.quote && (
					<figure className="mt-2 rounded-xl border border-current/10 bg-white/80 px-3 py-2">
						<figcaption className="text-[11px] font-bold opacity-75">
							{section.quote.source === "booking_history"
								? "Từ lịch sử chuyến đi của bạn"
								: `Bạn đã cung cấp · ${SOURCE_LABEL[section.quote.source]}`}{" "}
							· {section.quote.field}
						</figcaption>
						<blockquote className="mt-1 flex gap-1.5 text-xs font-semibold italic">
							<Quote aria-hidden="true" className="mt-0.5 size-3 shrink-0 opacity-60" />
							<span>“{section.quote.text}”</span>
						</blockquote>
					</figure>
				)}

				<p className="mt-2 text-xs leading-5">{section.detail}</p>
				{section.conclusion && (
					<p className="mt-1.5 text-xs font-bold leading-5">→ {section.conclusion}</p>
				)}
			</div>
		</li>
	);
}

/**
 * "Vì sao gợi ý chuyến này cho bạn", shown on a Trip opened from the suggestions. Each point quotes
 * what the Camper entered in their profile or preferences, explains it against the Trip's real
 * figures and concludes. A Trip that is not in the latest suggestions (404) shows nothing.
 */
export function TripRecommendationExplanation({ tripId }: TripRecommendationExplanationProps) {
	const explanation = useTripRecommendationExplanation(tripId);

	if (explanation.isError && explanation.error instanceof HttpError) {
		if (explanation.error.status === 404 || explanation.error.status === 403) return null;
	}

	return (
		<section
			aria-labelledby="trip-recommendation-explanation-title"
			className="rounded-3xl border border-[#dfe8df] bg-white p-5 shadow-sm"
		>
			<div className="flex items-start gap-3">
				<div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#164027] text-white">
					<Sparkles className="size-5" />
				</div>
				<div>
					<h2
						id="trip-recommendation-explanation-title"
						className="text-base font-extrabold text-[#10221b]"
					>
						Vì sao gợi ý chuyến này cho bạn
					</h2>
					<p className="mt-0.5 text-xs text-[#667a6d]">
						Đối chiếu thông tin bạn đã cung cấp trong hồ sơ, sở thích và lịch sử chuyến đi với số
						liệu thực tế của chuyến.
					</p>
				</div>
			</div>

			{explanation.isLoading && (
				<div className="mt-4 flex items-center gap-2 text-xs font-bold text-[#164027]">
					<Loader2 className="size-4 animate-spin" />
					<span>Đang tải lý do gợi ý...</span>
				</div>
			)}

			{explanation.isError && (
				<div
					role="alert"
					className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800"
				>
					<span className="font-bold">Không tải được lý do gợi ý.</span>
					<button
						type="button"
						onClick={() => void explanation.refetch()}
						className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-rose-700 px-3 py-1.5 font-bold text-white hover:bg-rose-800"
					>
						<RefreshCw className="size-3.5" />
						Thử lại
					</button>
				</div>
			)}

			{explanation.data && (
				<>
					<ul aria-label="Lý do gợi ý chi tiết" className="mt-4 grid gap-3 lg:grid-cols-2">
						{explanation.data.sections.map((section) => (
							<SectionItem key={`${section.kind}-${section.title}`} section={section} />
						))}
					</ul>

					<div className="mt-4 rounded-2xl bg-[#164027] p-4 text-white">
						<p className="text-[11px] font-bold uppercase tracking-wider text-[#cfe3d2]">
							Kết luận
						</p>
						<p className="mt-1 text-sm font-semibold leading-6">{explanation.data.summary}</p>
					</div>

					{!explanation.data.healthConsidered && (
						<p className="mt-3 text-[11px] text-[#7b8c82]">
							Bật chia sẻ hồ sơ sức khỏe để gợi ý xét thêm thể lực, bệnh nền và dị ứng của bạn.
							Thông tin sức khỏe chỉ được dùng trong hệ thống, không gửi cho dịch vụ AI.
						</p>
					)}
				</>
			)}
		</section>
	);
}
