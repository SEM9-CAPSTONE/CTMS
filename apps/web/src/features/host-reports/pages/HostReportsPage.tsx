import { FileClock, LineChart, PieChart } from "lucide-react";
import type React from "react";
import { PerformanceReportsPage } from "../../performance-reports/pages/PerformanceReportsPage";
import { RevenueAnalyticsPage } from "../../revenue-analytics/pages/RevenueAnalyticsPage";

export type HostReportTab = "performance" | "revenue";

const TABS = [
	{ key: "performance", label: "Báo cáo hiệu suất", icon: FileClock },
	{ key: "revenue", label: "Báo cáo doanh thu", icon: LineChart },
] as const;

export interface HostReportsPageProps {
	activeTab: HostReportTab;
	onTabChange: (tab: HostReportTab) => void;
	children?: React.ReactNode;
}

/** Host "Báo cáo tổng quan": operational performance (CTMS-101) and revenue (CTMS-110) as tabs. */
export const HostReportsPage: React.FC<HostReportsPageProps> = ({
	activeTab,
	onTabChange,
	children,
}) => (
	<div className="mx-auto w-full space-y-5 px-4 py-6 sm:px-6 lg:px-8">
		<h1 className="flex items-center gap-3 text-2xl font-extrabold text-[#10221b]">
			<PieChart aria-hidden="true" className="size-7 text-[#164027]" /> Báo cáo tổng quan
		</h1>

		<div
			role="tablist"
			aria-label="Loại báo cáo"
			className="flex overflow-x-auto border-b border-[#dfe8df] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
		>
			{TABS.map(({ key, label, icon: Icon }) => {
				const selected = activeTab === key;
				return (
					<button
						key={key}
						type="button"
						role="tab"
						id={`host-report-tab-${key}`}
						aria-selected={selected}
						aria-controls="host-report-panel"
						onClick={() => {
							if (!selected) onTabChange(key);
						}}
						className={`inline-flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold whitespace-nowrap transition ${
							selected
								? "border-[#164027] text-[#164027]"
								: "border-transparent text-[#667a6d] hover:text-[#10221b]"
						}`}
					>
						<Icon aria-hidden="true" className="size-4" />
						<span>{label}</span>
					</button>
				);
			})}
		</div>

		<div role="tabpanel" id="host-report-panel" aria-labelledby={`host-report-tab-${activeTab}`}>
			{activeTab === "performance" ? (
				<PerformanceReportsPage embedded />
			) : activeTab === "revenue" ? (
				<RevenueAnalyticsPage embedded />
			) : (
				children
			)}
		</div>
	</div>
);
