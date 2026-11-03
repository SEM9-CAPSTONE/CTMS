import { ArrowRight, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { RoutePath } from "../../../routes/routes.config";
import { Button } from "../../../shared/components/Button";
import type { OverviewSos } from "../../host-overview/types";
import { SosResolutionModal } from "./SosResolutionModal";

const EMERGENCY_LABELS: Record<string, string> = {
	medical: "Sự cố y tế",
	injury: "Chấn thương",
	lost: "Lạc đường",
	natural_hazard: "Thiên tai / Sạt lở",
	other: "Khẩn cấp khác",
};

export interface EmergencyAlertBannerProps {
	alerts?: OverviewSos[];
	onNavigateToSosCenter?: () => void;
	onUpdated?: () => void;
}

export function EmergencyAlertBanner({
	alerts = [],
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
				className="relative overflow-hidden rounded-2xl border-2 border-red-500 bg-gradient-to-r from-red-600 to-rose-700 p-4 text-white shadow-lg shadow-red-500/20"
			>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-start gap-3">
						<div className="relative flex shrink-0 items-center justify-center rounded-xl bg-white/20 p-2.5">
							<ShieldAlert className="size-6 text-white" />
							<span className="absolute -top-1 -right-1 flex size-3">
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-300 opacity-75" />
								<span className="relative inline-flex size-3 rounded-full bg-yellow-400" />
							</span>
						</div>
						<div>
							<div className="flex items-center gap-2">
								<span className="rounded-md bg-white/25 px-2 py-0.5 text-xs font-black tracking-wide uppercase">
									Khẩn cấp ({activeCount})
								</span>
								<h2 className="text-base font-bold text-white">Cần ứng cứu khẩn cấp ngay!</h2>
							</div>
							<p className="mt-1 text-xs text-red-100 sm:text-sm">
								<span className="text-yellow-200 font-semibold">{emergencyLabel}</span>
								{" · "}
								<span className="text-red-100">Mã chuyến: {latest.tripId.slice(0, 8)}</span>
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2 self-end sm:self-center">
						<Button
							size="sm"
							variant="secondary"
							onClick={() => setActiveSosToHandle(latest)}
							className="border-0 bg-white font-bold text-red-700 hover:bg-red-50 shadow-sm"
						>
							Tiếp nhận ngay
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onClick={handleOpenSosCenter}
							className="text-white hover:bg-white/20 hover:text-white"
						>
							<span>Tất cả ({activeCount})</span>
							<ArrowRight className="size-4 ml-1" />
						</Button>
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
