import type React from "react";
import { REPORT_PERIOD_OPTIONS } from "../constants";
import { type PerformanceReportFilterParams, ReportPeriodPreset } from "../types";

interface PerformanceFilterBarProps {
	filters: PerformanceReportFilterParams;
	onChange: (newFilters: PerformanceReportFilterParams) => void;
	onReset?: () => void;
}

export const PerformanceFilterBar: React.FC<PerformanceFilterBarProps> = ({
	filters,
	onChange,
}) => {
	const currentPeriod = filters.period ?? ReportPeriodPreset.DAYS_30;

	const handlePeriodSelect = (period: ReportPeriodPreset) => {
		onChange({
			...filters,
			period,
		});
	};

	return (
		<div className="flex flex-wrap items-center gap-1.5">
			<span className="mr-1 text-xs font-bold text-[#7b8c82]">Kỳ báo cáo:</span>
			{REPORT_PERIOD_OPTIONS.map((opt) => {
				const isSelected = currentPeriod === opt.key;
				return (
					<button
						key={opt.key}
						type="button"
						aria-pressed={isSelected}
						onClick={() => handlePeriodSelect(opt.key)}
						className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
							isSelected
								? "bg-[#164027] text-white shadow-xs"
								: "border border-[#dfe8df] bg-white text-[#55685a] hover:bg-[#f4f7f2] hover:text-[#164027]"
						}`}
					>
						{opt.label}
					</button>
				);
			})}
		</div>
	);
};
