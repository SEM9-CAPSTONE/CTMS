import { Award, BriefcaseBusiness, Star, UserRound } from "lucide-react";
import { useState } from "react";
import type { AvailablePorter, IntendedPorterRole } from "../types";
import { PorterRequestAction } from "./PorterRequestAction";

interface AvailablePorterCardProps {
	tripId: string;
	porter: AvailablePorter;
	role: IntendedPorterRole;
}

const PROFICIENCY_LABELS = {
	learning: "Học việc",
	proficient: "Thành thạo",
	expert: "Chuyên gia",
} as const;

export function AvailablePorterCard({ tripId, porter, role }: AvailablePorterCardProps) {
	const [avatarFailed, setAvatarFailed] = useState(false);
	const porterName = porter.displayName?.trim() || `Porter ${porter.porterId.slice(0, 8)}`;

	return (
		<article className="rounded-2xl border border-[#dfe8df] bg-white p-4 shadow-sm transition hover:border-[#b8cbbb]">
			<div className="flex items-center gap-3">
				<div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#edf2ee] text-[#52675a] ring-1 ring-[#dfe8df]">
					{porter.avatarUrl && !avatarFailed ? (
						<img
							src={porter.avatarUrl}
							alt={`Ảnh đại diện ${porterName}`}
							className="size-full object-cover"
							onError={() => setAvatarFailed(true)}
						/>
					) : (
						<UserRound className="size-7" aria-hidden="true" />
					)}
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<h4 className="truncate text-sm font-extrabold text-[#10221b]">{porterName}</h4>
						{role === "lead" && porter.proficiency && (
							<span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
								{PROFICIENCY_LABELS[porter.proficiency]}
							</span>
						)}
					</div>
					<ul className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-[#667a6d]">
						<li className="inline-flex items-center gap-1.5">
							<BriefcaseBusiness className="size-3.5" aria-hidden="true" />
							<span>{porter.experienceYears} năm kinh nghiệm</span>
						</li>
						<li className="inline-flex items-center gap-1.5">
							<Award className="size-3.5" aria-hidden="true" />
							<span>{porter.completedTrips} chuyến</span>
						</li>
						<li className="inline-flex items-center gap-1.5 text-amber-700">
							<Star className="size-3.5" aria-hidden="true" />
							<span>{porter.ratingAvg.toFixed(1)}</span>
						</li>
					</ul>
				</div>
			</div>

			<PorterRequestAction tripId={tripId} porterId={porter.porterId} role={role} />
		</article>
	);
}
