import {
	AlertCircle,
	CheckCircle2,
	Clock,
	Edit2,
	Footprints,
	MapPin,
	ShieldCheck,
} from "lucide-react";
import { PROFICIENCY_LABELS } from "../constants";
import type { PorterRouteQualification } from "../types";

interface PorterQualificationCardProps {
	qualification: PorterRouteQualification;
	routeName?: string;
	onEdit: () => void;
	disabled?: boolean;
}

export function PorterQualificationCard({
	qualification,
	routeName,
	onEdit,
	disabled = false,
}: PorterQualificationCardProps) {
	const isVerified = Boolean(qualification.verifiedBy && qualification.verifiedAt);
	const displayName = routeName || `Tuyến #${qualification.routeId.slice(0, 8)}`;

	const getEligibilityBadge = () => {
		if (qualification.proficiency === "learning") {
			return (
				<span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-700">
					Học việc (Không đủ điều kiện Lead)
				</span>
			);
		}
		if (isVerified) {
			return (
				<span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-extrabold text-emerald-800">
					<ShieldCheck size={12} />
					Đủ điều kiện làm Trưởng nhóm
				</span>
			);
		}
		return (
			<span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
				Chưa xác minh (Chưa đủ điều kiện Lead)
			</span>
		);
	};

	return (
		<div
			data-testid={`porter-qualification-${qualification.qualificationId}`}
			className="flex flex-col justify-between rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-xs transition hover:border-[#b8cfba]"
		>
			<div className="flex flex-col gap-3">
				{/* Top Identity & Status */}
				<div className="flex items-start justify-between gap-3">
					<div className="flex items-start gap-2.5 min-w-0">
						<div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#eef7f0] text-[#164027]">
							<MapPin size={18} />
						</div>
						<div className="min-w-0">
							<h4 className="font-extrabold text-[#10221b] truncate text-base">{displayName}</h4>
							<p className="text-[11px] font-medium text-[#788c7e] truncate">
								ID: {qualification.routeId}
							</p>
						</div>
					</div>

					{/* Verification Badge */}
					<div className="shrink-0">
						{isVerified ? (
							<span
								data-testid="qualification-verified-badge"
								className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-800 ring-1 ring-emerald-200"
							>
								<CheckCircle2 size={13} className="text-emerald-600" />
								<span>Đã xác minh</span>
							</span>
						) : (
							<span
								data-testid="qualification-unverified-badge"
								className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-extrabold text-amber-800 ring-1 ring-amber-200"
							>
								<AlertCircle size={13} className="text-amber-600" />
								<span>Chưa xác minh</span>
							</span>
						)}
					</div>
				</div>

				{/* Details */}
				<div className="grid grid-cols-2 gap-2 rounded-xl bg-[#f8faf7] p-3 text-xs">
					<div>
						<p className="text-[10px] font-bold uppercase tracking-wider text-[#788c7e]">
							Trình độ
						</p>
						<p className="font-extrabold text-[#164027]">
							{PROFICIENCY_LABELS[qualification.proficiency]}
						</p>
					</div>
					<div>
						<p className="text-[10px] font-bold uppercase tracking-wider text-[#788c7e]">
							Số lần dẫn đoàn
						</p>
						<p className="flex items-center gap-1 font-extrabold text-[#10221b]">
							<Footprints size={14} className="text-[#627769]" />
							<span>{qualification.timesLed} lần</span>
						</p>
					</div>
				</div>

				{/* Eligibility & Timestamp */}
				<div className="flex flex-col gap-1.5 pt-1">
					<div>{getEligibilityBadge()}</div>
					{isVerified && qualification.verifiedAt && (
						<p className="flex items-center gap-1 text-[11px] text-[#788c7e]">
							<Clock size={12} />
							<span>
								Xác minh:{" "}
								{new Date(qualification.verifiedAt).toLocaleDateString("vi-VN", {
									year: "numeric",
									month: "short",
									day: "numeric",
								})}
							</span>
						</p>
					)}
				</div>
			</div>

			{/* Edit Action */}
			<div className="mt-4 flex items-center justify-end border-t border-[#f0f4ef] pt-3">
				<button
					type="button"
					onClick={onEdit}
					disabled={disabled}
					data-testid={`edit-qualification-${qualification.qualificationId}`}
					className="flex items-center gap-1.5 rounded-xl border border-[#d2ded2] bg-white px-3 py-1.5 text-xs font-bold text-[#4a5e51] transition hover:bg-[#f4f7f2] hover:text-[#164027] disabled:opacity-50"
				>
					<Edit2 size={13} />
					<span>Chỉnh sửa</span>
				</button>
			</div>
		</div>
	);
}
