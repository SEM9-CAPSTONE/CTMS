import {
	AlertTriangle,
	Cake,
	CalendarClock,
	CheckCircle2,
	Footprints,
	HeartPulse,
	Info,
	Leaf,
	MapPin,
	Mountain,
	Quote,
	Route,
	ShieldAlert,
	Sparkles,
	Tag,
	Tent,
	Ticket,
	Utensils,
} from "lucide-react";
import type { ComponentType } from "react";
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

export function TripExplanationSection({
	section,
	className = "",
}: { section: TripRecommendationExplanationSection; className?: string }) {
	const KindIcon = KIND_ICON[section.kind] ?? Info;
	const badge = TONE_BADGE[section.tone];
	const BadgeIcon = badge.icon;
	return (
		<li
			className={`flex min-w-0 gap-3 rounded-2xl border p-4 ${TONE_STYLE[section.tone]} ${className}`}
		>
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
			</div>
		</li>
	);
}
