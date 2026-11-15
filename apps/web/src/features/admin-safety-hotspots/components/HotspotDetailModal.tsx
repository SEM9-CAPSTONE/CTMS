import { Button, Modal, StatusBadge } from "../../../shared/components";
import {
	CORRECTIVE_ACTION_LABELS,
	HOTSPOT_STATUS_LABELS,
	HOTSPOT_STATUS_TONES,
} from "../constants";
import { useHotspotCorrections } from "../hooks/useHotspotCorrections";
import type { SafetyHotspot } from "../types";
import { formatDate, formatDateTime } from "../utils/format";
import { CorrectiveActionForm } from "./CorrectiveActionForm";

interface Props {
	hotspot: SafetyHotspot;
	onClose: () => void;
	onChanged: () => void;
}

export function HotspotDetailModal({ hotspot, onClose, onChanged }: Props) {
	const corrections = useHotspotCorrections(hotspot, onChanged);
	const confirmed = hotspot.status === "CONFIRMED";
	const facts: Array<[string, string]> = [
		["Tuyến", hotspot.routeName],
		["Bằng chứng", `${hotspot.eventCount} lần lệch tuyến từ ${hotspot.distinctTripCount} chuyến`],
		[
			"Khoảng thời gian",
			`${formatDate(hotspot.firstEventAt)} – ${formatDate(hotspot.lastEventAt)}`,
		],
		[
			"Vị trí",
			`${hotspot.centerLat.toFixed(5)}, ${hotspot.centerLng.toFixed(5)} (bán kính ${hotspot.radiusMeters} m)`,
		],
	];

	return (
		<Modal
			isOpen
			onClose={onClose}
			title="Điểm nóng an toàn"
			size="xl"
			isCloseDisabled={corrections.submitting}
		>
			<div className="space-y-6">
				<div className="space-y-3">
					<StatusBadge tone={HOTSPOT_STATUS_TONES[hotspot.status]}>
						{HOTSPOT_STATUS_LABELS[hotspot.status]}
					</StatusBadge>
					<dl className="grid gap-3 text-sm sm:grid-cols-2">
						{facts.map(([label, value]) => (
							<div key={label}>
								<dt className="text-xs font-medium tracking-wide text-[#667a6d]">{label}</dt>
								<dd className="mt-1 text-[#10221b]">{value}</dd>
							</div>
						))}
					</dl>
				</div>

				{corrections.error && (
					<div className="flex items-center justify-between gap-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
						<span role="alert">{corrections.error}</span>
						<Button size="sm" variant="outline" onClick={() => void corrections.reload()}>
							Thử lại
						</Button>
					</div>
				)}

				<section
					className="space-y-3 border-t border-[#e8efe7] pt-4"
					aria-labelledby="hotspot-update-title"
				>
					<h3 id="hotspot-update-title" className="text-lg font-semibold text-[#10221b]">
						Cập nhật dữ liệu an toàn
					</h3>
					{!confirmed && (
						<p className="text-sm text-[#667a6d]">
							Điểm nóng chưa được xác nhận nên chưa thể cập nhật dữ liệu an toàn.
						</p>
					)}
					{confirmed && corrections.loading && !corrections.targets && (
						<p className="text-sm text-[#667a6d]">
							Đang tải điểm dừng và vùng nguy hiểm của tuyến...
						</p>
					)}
					{confirmed && corrections.targets && (
						<CorrectiveActionForm
							hotspot={hotspot}
							targets={corrections.targets}
							submitting={corrections.submitting}
							onSubmit={corrections.submit}
						/>
					)}
				</section>

				<section
					className="space-y-3 border-t border-[#e8efe7] pt-4"
					aria-labelledby="hotspot-history-title"
				>
					<h3 id="hotspot-history-title" className="text-lg font-semibold text-[#10221b]">
						Lịch sử
					</h3>
					{corrections.history.length === 0 && !corrections.loading && (
						<p className="text-sm text-[#667a6d]">Chưa có cập nhật nào từ điểm nóng này.</p>
					)}
					<ul className="divide-y divide-[#e8efe7]">
						{corrections.history.map((action) => (
							<li key={action.id} className="space-y-1 py-3 text-sm">
								<p className="font-semibold text-[#10221b]">
									{CORRECTIVE_ACTION_LABELS[action.actionType]}
									{action.targetName ? ` · ${action.targetName}` : ""}
								</p>
								<p className="whitespace-pre-wrap text-[#10221b]">{action.reason}</p>
								<p className="text-xs text-[#667a6d]/80">
									{action.actorName ?? "Quản trị viên"} · {formatDateTime(action.createdAt)}
									{action.packageImpact === "AFFECTED" && action.impactTripCount > 0
										? ` · Tạo phiên bản gói an toàn mới cho ${action.impactTripCount} chuyến`
										: ""}
								</p>
							</li>
						))}
					</ul>
				</section>
			</div>
		</Modal>
	);
}
