import { CheckCircle2, FileBadge2, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { Modal } from "../../../shared/components/Modal";
import type { AvailablePorter, IntendedPorterRole } from "../types";
import { PorterRequestAction } from "./PorterRequestAction";

interface AvailablePorterDetailModalProps {
	isOpen: boolean;
	onClose: () => void;
	porter: AvailablePorter | null;
	role: IntendedPorterRole;
	tripId: string;
}

const PROFICIENCY_LABELS = {
	learning: "Học việc",
	proficient: "Thành thạo",
	expert: "Chuyên gia",
} as const;

export function AvailablePorterDetailModal({
	isOpen,
	onClose,
	porter,
	role,
	tripId,
}: AvailablePorterDetailModalProps) {
	const [avatarFailed, setAvatarFailed] = useState(false);

	if (!porter) return null;

	const porterName = porter.displayName?.trim() || "Chưa cập nhật tên người hỗ trợ";
	const certs =
		porter.certificates ?? (porter.certifications ?? []).map((name) => ({ type: "other", name }));

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Hồ sơ chi tiết người hỗ trợ" size="lg">
			<div className="space-y-5 text-sm">
				{/* Top Profile Header */}
				<div className="flex items-start gap-4 rounded-2xl border border-[#dfe8df] bg-[#fafcfa] p-4">
					<div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#edf2ee] text-[#52675a] ring-2 ring-[#dfe8df]">
						{porter.avatarUrl && !avatarFailed ? (
							<img
								src={porter.avatarUrl}
								alt={`Ảnh đại diện ${porterName}`}
								className="size-full object-cover"
								onError={() => setAvatarFailed(true)}
							/>
						) : (
							<UserRound className="size-8" aria-hidden="true" />
						)}
					</div>

					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2">
							<h3 className="text-base font-extrabold text-[#10221b]">{porterName}</h3>
							{porter.proficiency && (
								<span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900 border border-amber-200">
									{PROFICIENCY_LABELS[porter.proficiency]}
								</span>
							)}
						</div>

						<p className="mt-1 text-xs text-[#52675a]">
							Vai trò ứng tuyển trong chuyến:{" "}
							<span className="font-bold text-[#164027]">
								{role === "lead" ? "Trưởng đoàn (Lead)" : "Người hỗ trợ (Support)"}
							</span>
						</p>

						<div className="mt-2 flex items-center gap-2">
							<span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
								<CheckCircle2 size={12} className="text-emerald-600" />
								<span>Hồ sơ đã xác minh & Sẵn sàng nhận chuyến</span>
							</span>
						</div>
					</div>
				</div>

				{/* Metric Highlights (3-layer Typography, Impeccable Standard) */}
				<div className="grid grid-cols-3 gap-3">
					<div className="rounded-xl border border-[#dfe8df] bg-white p-3 text-center shadow-2xs">
						<span className="block text-xs font-medium text-[#627769]">Kinh nghiệm</span>
						<span className="mt-1 block text-2xl font-bold tracking-tight text-[#10221b]">
							{porter.experienceYears}
						</span>
						<span className="block text-[11px] text-[#627769]">năm dẫn đường</span>
					</div>

					<div className="rounded-xl border border-[#dfe8df] bg-white p-3 text-center shadow-2xs">
						<span className="block text-xs font-medium text-[#627769]">Đã hoàn thành</span>
						<span className="mt-1 block text-2xl font-bold tracking-tight text-[#10221b]">
							{porter.completedTrips}
						</span>
						<span className="block text-[11px] text-[#627769]">chuyến trekking</span>
					</div>

					<div className="rounded-xl border border-[#dfe8df] bg-white p-3 text-center shadow-2xs">
						<span className="block text-xs font-medium text-[#627769]">Đánh giá</span>
						<span className="mt-1 block text-2xl font-bold tracking-tight text-amber-700">
							{porter.ratingAvg.toFixed(1)}
						</span>
						<span className="block text-[11px] text-[#627769]">trên thang điểm 5</span>
					</div>
				</div>

				{/* Specialized Certificates Section */}
				<div className="rounded-2xl border border-[#dfe8df] bg-white p-4">
					<div className="flex items-center gap-2 border-b border-[#dfe8df] pb-3">
						<FileBadge2 className="size-4 text-[#164027]" />
						<h4 className="text-xs font-bold text-[#10221b] uppercase tracking-wider">
							Chứng chỉ & Bằng cấp chuyên môn đã xác minh
						</h4>
					</div>

					{certs.length === 0 ? (
						<p className="mt-3 text-xs text-[#627769] italic">
							Chưa có chứng chỉ chuyên môn nào được lưu trên hồ sơ.
						</p>
					) : (
						<div className="mt-3 space-y-2">
							{certs.map((cert) => (
								<div
									key={`${cert.type}-${cert.name}`}
									className="flex items-center justify-between rounded-xl border border-[#e5ece5] bg-[#fafcfa] px-3.5 py-2.5 transition hover:border-[#b4cbb4]"
								>
									<div className="flex items-center gap-2.5 min-w-0">
										<ShieldCheck className="size-4 shrink-0 text-[#164027]" />
										<span className="truncate text-xs font-bold text-[#10221b]">{cert.name}</span>
									</div>
									<span className="shrink-0 rounded-full bg-[#e3efe7] px-2 py-0.5 text-[10px] font-bold text-[#164027] border border-[#bcd3c4]">
										Đã xác minh
									</span>
								</div>
							))}
						</div>
					)}
				</div>

				{/* Request Action Component embedded */}
				<div className="rounded-2xl border border-[#dfe8df] bg-[#fafcfa] p-4">
					<h4 className="text-xs font-bold text-[#10221b] uppercase tracking-wider mb-2">
						Gửi lời mời tham gia chuyến đi
					</h4>
					<PorterRequestAction tripId={tripId} porterId={porter.porterId} role={role} />
				</div>
			</div>
		</Modal>
	);
}
