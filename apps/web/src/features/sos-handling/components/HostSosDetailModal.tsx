import { Battery, Clock, Compass, ExternalLink, MapPin, ShieldAlert, User } from "lucide-react";
import { Button } from "../../../shared/components/Button";
import { Modal } from "../../../shared/components/Modal";
import type { EmergencyType, SosAlertItem, SosStatus } from "../types";

export interface HostSosDetailModalProps {
	isOpen: boolean;
	onClose: () => void;
	sos: SosAlertItem | null;
	onAcknowledge?: (sos: SosAlertItem) => void;
	onCloseSos?: (sos: SosAlertItem) => void;
}

const EMERGENCY_LABELS: Record<EmergencyType, string> = {
	medical: "Sự có y tế",
	injury: "Chấn thương",
	lost: "Lạc đường",
	natural_hazard: "Thiên tai / Sạt lở",
	other: "Khẩn cấp khác",
};

const STATUS_LABELS: Record<SosStatus, { label: string; className: string }> = {
	active: { label: "Cần ứng cứu khẩn cấp", className: "bg-red-100 text-red-700 border-red-200" },
	acknowledged: {
		label: "Đã tiếp nhận · Đang hỗ trợ",
		className: "bg-amber-100 text-amber-800 border-amber-200",
	},
	closed: {
		label: "Đã giải quyết",
		className: "bg-emerald-100 text-emerald-800 border-emerald-200",
	},
	cancelled: {
		label: "Đã hủy bởi người gửi",
		className: "bg-gray-100 text-gray-700 border-gray-200",
	},
};

export function HostSosDetailModal({
	isOpen,
	onClose,
	sos,
	onAcknowledge,
	onCloseSos,
}: HostSosDetailModalProps) {
	if (!isOpen || !sos) return null;

	const statusInfo = STATUS_LABELS[sos.status] || {
		label: sos.status,
		className: "bg-gray-100 text-gray-700 border-gray-200",
	};
	const emergencyLabel = EMERGENCY_LABELS[sos.emergencyType] || "Khẩn cấp khác";

	const mapUrl = sos.location
		? `https://www.google.com/maps?q=${sos.location.latitude},${sos.location.longitude}`
		: null;

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title="Chi tiết yêu cầu cứu trợ"
			description={`Mã yêu cầu: ${sos.id.slice(0, 8)}`}
			icon={<ShieldAlert className="size-5 text-red-600" />}
			size="lg"
		>
			<div className="space-y-4 text-sm text-[#10221b]">
				{/* Status & Category Bar */}
				<div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#f8faf7] p-3.5 border border-[#e7eee7]">
					<div>
						<span className="text-[11px] font-semibold text-[#8fa096] uppercase">Phân loại</span>
						<p className="font-bold text-red-700">{emergencyLabel}</p>
					</div>
					<span className={`rounded-xl border px-3 py-1 text-xs font-bold ${statusInfo.className}`}>
						{statusInfo.label}
					</span>
				</div>

				{/* Information Grid */}
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div className="rounded-2xl border border-[#dfe8df] p-3">
						<div className="flex items-center gap-2 text-xs font-semibold text-[#627769]">
							<User className="size-4" />
							<span>Người gửi tín hiệu</span>
						</div>
						<p className="mt-1 font-bold">{sos.senderName || "Không xác định"}</p>
						{sos.senderEmail && (
							<p className="text-xs text-[#627769] font-mono">{sos.senderEmail}</p>
						)}
					</div>

					<div className="rounded-2xl border border-[#dfe8df] p-3">
						<div className="flex items-center gap-2 text-xs font-semibold text-[#627769]">
							<Compass className="size-4" />
							<span>Chuyến đi</span>
						</div>
						<p className="mt-1 font-bold line-clamp-1">
							{sos.tripTitle || `Chuyến đi (${sos.tripId.slice(0, 8)})`}
						</p>
						<p className="text-xs text-[#627769] font-mono">ID: {sos.tripId.slice(0, 8)}</p>
					</div>

					<div className="rounded-2xl border border-[#dfe8df] p-3">
						<div className="flex items-center gap-2 text-xs font-semibold text-[#627769]">
							<Clock className="size-4" />
							<span>Thời điểm gửi</span>
						</div>
						<p className="mt-1 font-semibold">{new Date(sos.eventTime).toLocaleString("vi-VN")}</p>
					</div>

					<div className="rounded-2xl border border-[#dfe8df] p-3">
						<div className="flex items-center gap-2 text-xs font-semibold text-[#627769]">
							<Battery className="size-4" />
							<span>Pin thiết bị</span>
						</div>
						<p className="mt-1 font-semibold">
							{sos.batteryLevel !== null ? `${sos.batteryLevel}%` : "Không có dữ liệu"}
						</p>
					</div>
				</div>

				{/* Location */}
				<div className="rounded-2xl border border-[#dfe8df] p-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2 text-xs font-semibold text-[#627769]">
							<MapPin className="size-4 text-rose-600" />
							<span>Vị trí tọa độ</span>
						</div>
						{mapUrl && (
							<a
								href={mapUrl}
								target="_blank"
								rel="noreferrer"
								className="inline-flex items-center gap-1 text-xs font-bold text-[#164027] hover:underline"
							>
								<span>Xem bản đồ</span>
								<ExternalLink className="size-3" />
							</a>
						)}
					</div>
					<p className="mt-1 font-mono text-xs font-semibold">
						{sos.location
							? `${sos.location.latitude.toFixed(6)}, ${sos.location.longitude.toFixed(6)}`
							: "Chưa ghi nhận tọa độ GPS"}
					</p>
				</div>

				{/* History & Notes */}
				{sos.acknowledgedAt && (
					<div className="rounded-2xl bg-amber-50/70 border border-amber-200 p-3">
						<span className="text-[11px] font-semibold text-amber-800 uppercase">
							Tiếp nhận bởi
						</span>
						<p className="mt-0.5 font-semibold text-amber-950">
							{sos.acknowledgedByName || "Chủ chuyến"} ·{" "}
							{new Date(sos.acknowledgedAt).toLocaleString("vi-VN")}
						</p>
					</div>
				)}

				{sos.closedAt && (
					<div className="rounded-2xl bg-emerald-50/70 border border-emerald-200 p-3">
						<span className="text-[11px] font-semibold text-emerald-800 uppercase">
							Đã đóng bởi
						</span>
						<p className="mt-0.5 font-semibold text-emerald-950">
							{sos.closedByName || "Chủ chuyến"} · {new Date(sos.closedAt).toLocaleString("vi-VN")}
						</p>
						{sos.resolutionNote && (
							<div className="mt-2 rounded-xl bg-white/80 p-2.5 text-xs text-[#2b3a32]">
								<span className="font-bold">Ghi chú xử lý: </span>
								{sos.resolutionNote}
							</div>
						)}
					</div>
				)}

				{sos.cancelledAt && (
					<div className="rounded-2xl bg-gray-50 border border-gray-200 p-3">
						<span className="text-[11px] font-semibold text-gray-700 uppercase">
							Hủy bởi người gửi
						</span>
						<p className="mt-0.5 font-semibold text-gray-900">
							{new Date(sos.cancelledAt).toLocaleString("vi-VN")}
						</p>
						{sos.cancellationReason && (
							<p className="mt-1 text-xs text-[#55685a]">
								<span className="font-bold">Lý do: </span>
								{sos.cancellationReason}
							</p>
						)}
					</div>
				)}

				{/* Footer Actions */}
				<div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e7eee7]">
					<Button variant="ghost" onClick={onClose}>
						Đóng
					</Button>
					{sos.status === "active" && onAcknowledge && (
						<Button
							variant="primary"
							onClick={() => {
								onClose();
								onAcknowledge(sos);
							}}
						>
							Tiếp nhận cứu trợ
						</Button>
					)}
					{sos.status === "acknowledged" && (
						<>
							<Button
								variant="outline"
								disabled
								className="cursor-not-allowed opacity-60 bg-[#f4f7f2] text-[#8fa096] border-[#dfe8df]"
							>
								Đã tiếp nhận
							</Button>
							{onCloseSos && (
								<Button
									variant="primary"
									onClick={() => {
										onClose();
										onCloseSos(sos);
									}}
								>
									Đóng SOS
								</Button>
							)}
						</>
					)}
				</div>
			</div>
		</Modal>
	);
}
