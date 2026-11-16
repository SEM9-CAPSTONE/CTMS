import { MapPinned, RefreshCw } from "lucide-react";
import { Button } from "../../../shared/components/Button";
import { HostOperationalOverview } from "../components/HostOperationalOverview";
import { useRefreshHostMonitoring } from "../hooks/useActiveTripMap";

export function HostTripMapPage({ hostId }: { hostId: string }) {
	const { refresh, isRefreshing } = useRefreshHostMonitoring(hostId);
	return (
		<div className="min-h-screen bg-[#f4f7f2] text-[#10221b]">
			<header className="border-b border-[#dfe8df] bg-white">
				<div className="mx-auto flex min-h-20 max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#e7eeea] text-[#164027]">
						<MapPinned className="size-5" aria-hidden="true" />
					</div>
					<div className="min-w-0">
						<h1 className="text-xl font-extrabold sm:text-2xl">Giám sát chuyến đi</h1>
						<p className="mt-1 text-sm text-[#627769]">
							Theo dõi tuyến đường, vị trí thành viên và thông tin an toàn của chuyến đi
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						className="ml-auto shrink-0"
						title="Làm mới dữ liệu giám sát"
						aria-label="Làm mới dữ liệu giám sát"
						disabled={isRefreshing}
						onClick={() => void refresh()}
					>
						<RefreshCw
							className={isRefreshing ? "size-4 animate-spin" : "size-4"}
							aria-hidden="true"
						/>
					</Button>
				</div>
			</header>
			<div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
				<HostOperationalOverview
					hostId={hostId}
					initialStatus="ongoing"
					monitorParticipants
					showMetrics={false}
					showToolbar={false}
					onNavigateToTripDetail={(tripId) => {
						window.history.pushState({}, "", `/trips/${tripId}?from=host-dashboard`);
						window.dispatchEvent(new PopStateEvent("popstate"));
					}}
				/>
			</div>
		</div>
	);
}
