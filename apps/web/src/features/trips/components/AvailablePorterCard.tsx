import { Award, BriefcaseBusiness, CheckCircle2, Star } from "lucide-react";
import type { AvailablePorter, IntendedPorterRole } from "../types";

interface AvailablePorterCardProps {
	porter: AvailablePorter;
	role: IntendedPorterRole;
}

const PROFICIENCY_LABELS = {
	learning: "Đang học",
	proficient: "Thành thạo",
	expert: "Chuyên gia",
} as const;

export function AvailablePorterCard({ porter, role }: AvailablePorterCardProps) {
	return (
		<article className="rounded-2xl border border-[#dfe8df] bg-[#fbfdfb] p-4">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<h4 className="truncate text-sm font-extrabold text-[#10221b]">
						{porter.displayName?.trim() || "Porter chưa cập nhật tên"}
					</h4>
					<p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
						<CheckCircle2 className="size-3.5" aria-hidden="true" />
						Sẵn sàng
					</p>
				</div>
				{role === "lead" && porter.proficiency && (
					<span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
						{PROFICIENCY_LABELS[porter.proficiency]}
					</span>
				)}
			</div>

			<dl className="mt-4 grid grid-cols-3 gap-2 text-center">
				<div className="rounded-xl bg-white p-2">
					<dt className="flex justify-center text-[#667a6d]">
						<BriefcaseBusiness className="size-4" />
					</dt>
					<dd className="mt-1 text-xs font-extrabold text-[#10221b]">
						{porter.experienceYears} năm
					</dd>
				</div>
				<div className="rounded-xl bg-white p-2">
					<dt className="flex justify-center text-amber-600">
						<Star className="size-4" />
					</dt>
					<dd className="mt-1 text-xs font-extrabold text-[#10221b]">
						{porter.ratingAvg.toFixed(1)}
					</dd>
				</div>
				<div className="rounded-xl bg-white p-2">
					<dt className="flex justify-center text-[#164027]">
						<Award className="size-4" />
					</dt>
					<dd className="mt-1 text-xs font-extrabold text-[#10221b]">
						{porter.completedTrips} chuyến
					</dd>
				</div>
			</dl>
		</article>
	);
}
