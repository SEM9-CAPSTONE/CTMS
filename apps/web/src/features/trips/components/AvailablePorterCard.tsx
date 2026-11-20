import { Award, BriefcaseBusiness, Eye, Star, UserRound } from "lucide-react";
import { useState } from "react";
import type { AvailablePorter, IntendedPorterRole } from "../types";
import { AvailablePorterDetailModal } from "./AvailablePorterDetailModal";
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
	const [isDetailOpen, setIsDetailOpen] = useState(false);

	const porterName = porter.displayName?.trim() || "Chưa cập nhật tên người hỗ trợ";
	const certs =
		porter.certificates ?? (porter.certifications ?? []).map((name) => ({ type: "other", name }));
	const displayedCerts = certs.slice(0, 2);
	const extraCount = certs.length - 2;

	return (
		<>
			<article className="rounded-2xl border border-[#dfe8df] bg-white p-4 shadow-sm transition hover:border-[#b8cbbb]">
				<div className="flex items-start gap-3">
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
						<div className="flex flex-wrap items-center justify-between gap-2">
							<div className="flex flex-wrap items-center gap-2">
								<h4 className="truncate text-sm font-extrabold text-[#10221b]">{porterName}</h4>
								{role === "lead" && porter.proficiency && (
									<span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
										{PROFICIENCY_LABELS[porter.proficiency]}
									</span>
								)}
							</div>

							<button
								type="button"
								onClick={() => setIsDetailOpen(true)}
								className="inline-flex items-center gap-1 rounded-lg border border-[#c4d7c7] bg-[#f0f6f1] px-2.5 py-1 text-xs font-bold text-[#164027] hover:bg-[#e1ede3] transition shadow-2xs"
							>
								<Eye size={13} />
								<span>Xem hồ sơ</span>
							</button>
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

						{/* Danh sách chứng chỉ đã xác minh (Tối đa 2 cái + '+n') */}
						{displayedCerts.length > 0 && (
							<div
								className="mt-2.5 flex flex-wrap items-center gap-1.5"
								aria-label="Danh sách chứng chỉ đã xác minh"
							>
								{displayedCerts.map((cert) => (
									<span
										key={`${cert.type}-${cert.name}`}
										className="inline-flex items-center rounded-md border border-[#c4d7c7] bg-[#f0f6f1] px-2 py-0.5 text-[11px] font-semibold text-[#164027]"
									>
										{cert.name}
									</span>
								))}
								{extraCount > 0 && (
									<span
										title={`Còn ${extraCount} chứng chỉ khác`}
										className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[11px] font-bold text-neutral-600"
									>
										+{extraCount}
									</span>
								)}
							</div>
						)}
					</div>
				</div>

				<PorterRequestAction tripId={tripId} porterId={porter.porterId} role={role} />
			</article>

			{/* Detail Modal */}
			<AvailablePorterDetailModal
				isOpen={isDetailOpen}
				onClose={() => setIsDetailOpen(false)}
				porter={porter}
				role={role}
				tripId={tripId}
			/>
		</>
	);
}
