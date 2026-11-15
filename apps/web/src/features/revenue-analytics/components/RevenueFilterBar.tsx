import type React from "react";
import { SelectField } from "../../../shared/components/SelectField";
import { PerformanceFilterBar } from "../../performance-reports/components/PerformanceFilterBar";
import { ReportPeriodPreset } from "../../performance-reports/types";
import type {
	GeoArea,
	RevenueAnalyticsFilterParams,
	RevenueGranularity,
	RevenueHostOption,
} from "../types";

interface RevenueFilterBarProps {
	filters: RevenueAnalyticsFilterParams;
	onChange: (filters: RevenueAnalyticsFilterParams) => void;
	areas: GeoArea[];
	hosts?: RevenueHostOption[];
}

const ALL = "";

/** Chart bucket follows the period, so the filter stays as simple as the performance report's. */
export function granularityForPeriod(period: ReportPeriodPreset): RevenueGranularity {
	switch (period) {
		case ReportPeriodPreset.DAYS_7:
		case ReportPeriodPreset.DAYS_30:
		case ReportPeriodPreset.THIS_MONTH:
		case ReportPeriodPreset.LAST_MONTH:
			return "day";
		case ReportPeriodPreset.DAYS_90:
			return "week";
		default:
			return "month";
	}
}

export const RevenueFilterBar: React.FC<RevenueFilterBarProps> = ({
	filters,
	onChange,
	areas,
	hosts,
}) => (
	<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
		<PerformanceFilterBar
			filters={{ period: filters.period }}
			onChange={({ period }) => {
				const next = period ?? ReportPeriodPreset.DAYS_30;
				onChange({ ...filters, period: next, granularity: granularityForPeriod(next) });
			}}
		/>
		<div className="flex flex-wrap items-center gap-3">
			<div className="w-full sm:w-56">
				<SelectField
					label="Khu vực"
					value={filters.areaCode ?? ALL}
					options={[
						{ value: ALL, label: "Tất cả khu vực" },
						...areas.map((area) => ({ value: area.code, label: area.name })),
					]}
					onChange={(value) => onChange({ ...filters, areaCode: value || undefined })}
				/>
			</div>
			{hosts && (
				<div className="w-full sm:w-56">
					<SelectField
						label="Chủ chuyến"
						value={filters.hostId ?? ALL}
						options={[
							{ value: ALL, label: "Tất cả chủ chuyến" },
							...hosts.map((host) => ({ value: host.id, label: host.fullName })),
						]}
						onChange={(value) => onChange({ ...filters, hostId: value || undefined })}
					/>
				</div>
			)}
		</div>
	</div>
);
