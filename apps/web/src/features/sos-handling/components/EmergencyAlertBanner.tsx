import { ArrowRight, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { RoutePath } from "../../../routes/routes.config";
import type { OverviewSos, OverviewTrip } from "../../host-overview/types";
import { SosResolutionModal } from "./SosResolutionModal";

export const EMERGENCY_LABELS: Record<string, string> = {
	medical: "Sự cố y tế",
	injury: "Chấn thương",
	lost: "Lạc đường",
	natural_hazard: "Thiên tai / Sạt lở",
	other: "Khẩn cấp khác",
};

export interface EmergencyAlertBannerProps {
	alerts?: OverviewSos[];
	trips?: OverviewTrip[];
	onNavigateToSosCenter?: () => void;
	onUpdated?: () => void;
}

export function EmergencyAlertBanner({
	alerts = [],
	trips = [],
	onNavigateToSosCenter,
	onUpdated,
}: EmergencyAlertBannerProps) {
	const [activeSosToHandle, setActiveSosToHandle] = useState<OverviewSos | null>(null);

	const items = alerts.filter((item) => item.status === "active");
	const activeCount = items.length;

	if (activeCount === 0) {
		return null;
	}

	const latest = items[0];
	const emergencyLabel = EMERGENCY_LABELS[latest.emergencyType] || "Yêu cầu cứu trợ";
	const trip = trips.find((t) => t.id === latest.tripId);
	const tripTitle = latest.tripTitle || trip?.title;
	const senderName = latest.senderName;

	const handleOpenSosCenter = () => {
		if (onNavigateToSosCenter) {
			onNavigateToSosCenter();
		} else {
			window.history.pushState({}, "", RoutePath.HOST_SOS);
			window.dispatchEvent(new PopStateEvent("popstate"));
		}
	};

	return (
		<>
			<section
				data-testid="emergency-alert-banner"
				aria-label="Cảnh báo cứu trợ khẩn cấp"
				className="rounded-2xl border border-red-200 bg-red-50/75 p-4 shadow-sm"
			>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-start gap-3">
						<div className="flex shrink-0 items-center justify-center rounded-xl bg-red-100 p-2 text-red-600">
							<ShieldAlert className="size-5" />
						</div>
						<div>
							<div className="flex items-center gap-2">
								<span className="rounded-full border border-red-200 bg-white px-2 py-0.5 text-[11px] font-bold text-red-700">
									Khẩn cấp ({activeCount})
								</span>
								<h2 className="text-sm font-bold text-red-950 sm:text-base">
									Cần ứng cứu khẩn cấp ngay!
								</h2>
							</div>
							<p className="mt-1 text-xs text-red-800 sm:text-sm">
								<span className="font-semibold text-red-900">{emergencyLabel}</span>
								{senderName && (
									<>
										{" · "}
										<span className="font-medium text-red-950">{senderName}</span>
									</>
								)}
								{" · "}
								<span className="text-red-700">{tripTitle || "Chưa cập nhật tên chuyến đi"}</span>
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2 self-end sm:self-center">
						<button
							type="button"
							onClick={() => setActiveSosToHandle(latest)}
							className="inline-flex items-center justify-center rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-red-700 focus:outline-none"
						>
							Tiếp nhận ngay
						</button>
						<button
							type="button"
							onClick={handleOpenSosCenter}
							className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 shadow-xs transition-colors hover:bg-red-50 focus:outline-none"
						>
							<span>Tất cả ({activeCount})</span>
							<ArrowRight className="size-3.5 ml-1" />
						</button>
					</div>
				</div>
			</section>

			<SosResolutionModal
				isOpen={activeSosToHandle !== null}
				onClose={() => setActiveSosToHandle(null)}
				sos={
					activeSosToHandle
						? {
								id: activeSosToHandle.id,
								tripId: activeSosToHandle.tripId,
								tripTitle:
									activeSosToHandle.tripTitle ||
									trips.find((t) => t.id === activeSosToHandle.tripId)?.title,
								senderName: activeSosToHandle.senderName,
								status: activeSosToHandle.status,
								emergencyType: activeSosToHandle.emergencyType,
								eventTime: activeSosToHandle.eventTime,
							}
						: null
				}
				onUpdated={() => {
					onUpdated?.();
				}}
			/>
		</>
	);
}
