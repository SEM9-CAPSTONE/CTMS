import { CloudLightning } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminLayout } from "../../admin-layout/components/AdminLayout";
import { WeatherInterventionsPanel } from "../../weather-decisions/components/WeatherInterventionsPanel";
import { useWeatherInterventions } from "../../weather-decisions/hooks/useWeatherDecisions";
import type { weatherDecisionsService } from "../../weather-decisions/services/weather-decisions.service";
import { WeatherPenaltiesPanel } from "../../weather-penalties/components/WeatherPenaltiesPanel";
import { useAdminWeatherPenalties } from "../../weather-penalties/hooks/useWeatherPenalties";
import type { weatherPenaltiesService } from "../../weather-penalties/services/weather-penalties.service";

export type AdminWeatherTab = "interventions" | "penalties";

export const ADMIN_WEATHER_PATH = "/admin/weather";

const TABS: Array<{ key: AdminWeatherTab; label: string }> = [
	{ key: "interventions", label: "Cần xử lý" },
	{ key: "penalties", label: "Phạt Host" },
];

/** Canonical URL of a tab; the default tab keeps the plain path. */
export function adminWeatherTabUrl(tab: AdminWeatherTab): string {
	return tab === "penalties" ? `${ADMIN_WEATHER_PATH}?tab=penalties` : ADMIN_WEATHER_PATH;
}

function tabFromLocation(fallback: AdminWeatherTab): AdminWeatherTab {
	const tab = new URLSearchParams(window.location.search).get("tab");
	return tab === "penalties" || tab === "interventions" ? tab : fallback;
}

export interface AdminWeatherManagementPageProps {
	onLogout?: (allDevices: boolean) => Promise<void>;
	/** Tab opened by an old link (`/admin/weather-interventions`, `/admin/weather-penalties`). */
	initialTab?: AdminWeatherTab;
	decisionsService?: typeof weatherDecisionsService;
	penaltiesService?: typeof weatherPenaltiesService;
}

/**
 * Admin › Quản lý thời tiết: Red Trips that need a decision and Host weather penalties, in two
 * tabs. Each tab shows how many items wait for the Admin.
 */
export function AdminWeatherManagementPage({
	onLogout,
	initialTab = "interventions",
	decisionsService,
	penaltiesService,
}: AdminWeatherManagementPageProps) {
	const [tab, setTab] = useState<AdminWeatherTab>(() => tabFromLocation(initialTab));
	const interventions = useWeatherInterventions(true, decisionsService);
	const pendingWaivers = useAdminWeatherPenalties("waiver_pending", { service: penaltiesService });
	const counts: Record<AdminWeatherTab, number | undefined> = {
		interventions: interventions.data?.length,
		penalties: pendingWaivers.data?.length,
	};

	// Old links land here too; keep one address per tab so reloads and bookmarks reopen it.
	useEffect(() => {
		const url = adminWeatherTabUrl(tab);
		if (`${window.location.pathname}${window.location.search}` !== url) {
			window.history.replaceState({}, "", url);
		}
	}, [tab]);

	return (
		<AdminLayout activeItem="weather-management" onLogout={onLogout}>
			<div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
				<div>
					<h1 className="flex items-center gap-3 text-2xl font-extrabold text-[#10221b]">
						<CloudLightning className="size-7 text-[#164027]" /> Quản lý thời tiết
					</h1>
					<p className="mt-1 text-sm text-[#667a6d]">
						Xử lý các Trip sắp đi gặp thời tiết xấu và xem các khoản phạt Host.
					</p>
				</div>

				<div className="flex flex-wrap gap-2" role="tablist" aria-label="Quản lý thời tiết">
					{TABS.map((option) => {
						const count = counts[option.key];
						return (
							<button
								key={option.key}
								id={`admin-weather-tab-${option.key}`}
								type="button"
								role="tab"
								aria-selected={tab === option.key}
								aria-controls={`admin-weather-panel-${option.key}`}
								onClick={() => setTab(option.key)}
								className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
									tab === option.key
										? "bg-[#164027] text-white"
										: "border border-[#dfe8df] bg-white text-[#164027] hover:bg-[#f1f5f0]"
								}`}
							>
								{option.label}
								{count !== undefined && count > 0 && (
									<span
										data-testid={`admin-weather-count-${option.key}`}
										className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
											tab === option.key ? "bg-white text-[#164027]" : "bg-[#164027] text-white"
										}`}
									>
										{count}
									</span>
								)}
							</button>
						);
					})}
				</div>

				<div
					role="tabpanel"
					id={`admin-weather-panel-${tab}`}
					aria-labelledby={`admin-weather-tab-${tab}`}
				>
					{tab === "interventions" ? (
						<WeatherInterventionsPanel service={decisionsService} />
					) : (
						<WeatherPenaltiesPanel service={penaltiesService} />
					)}
				</div>
			</div>
		</AdminLayout>
	);
}
