import { RefreshCw } from "lucide-react";
import { Button } from "../../../shared/components";
import type { GeoArea } from "../../revenue-analytics/types";
import { PERIOD_PRESET_OPTIONS } from "../constants";
import type { HostAnalyticsPeriodPreset } from "../types";

export interface HostAnalyticsFilterBarProps {
	preset: HostAnalyticsPeriodPreset;
	fromDate: string;
	toDate: string;
	areaCode: string;
	areas: GeoArea[];
	isFetching: boolean;
	onSelectPreset: (preset: Exclude<HostAnalyticsPeriodPreset, "custom">) => void;
	onChangeCustomDates: (fromDate: string, toDate: string) => void;
	onChangeArea: (areaCode: string) => void;
	onRefresh: () => void;
}

export function HostAnalyticsFilterBar({
	preset,
	fromDate,
	toDate,
	areaCode,
	areas,
	isFetching,
	onSelectPreset,
	onChangeCustomDates,
	onChangeArea,
	onRefresh,
}: HostAnalyticsFilterBarProps) {
	return (
		<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
			<fieldset
				className="flex flex-wrap items-center gap-1.5 border-0 p-0"
				aria-label="Chọn nhanh khoảng thời gian"
			>
				<span className="mr-1 text-xs font-bold text-[#7b8c82]">Kỳ báo cáo:</span>
				{PERIOD_PRESET_OPTIONS.map((opt) => {
					const active = preset === opt.value;
					return (
						<button
							key={opt.value}
							type="button"
							onClick={() => onSelectPreset(opt.value)}
							aria-pressed={active}
							className={`min-h-9 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all focus-visible:ring-2 focus-visible:ring-[#164027] focus-visible:outline-none ${
								active
									? "bg-[#164027] text-white shadow-xs"
									: "border border-[#dfe8df] bg-white text-[#55685a] hover:bg-[#f4f7f2] hover:text-[#164027]"
							}`}
						>
							{opt.label}
						</button>
					);
				})}
			</fieldset>

			<div className="flex flex-wrap items-center gap-2">
				<div className="flex items-center gap-1.5 rounded-xl border border-[#dfe8df] bg-white px-2.5 py-1">
					<input
						type="date"
						aria-label="Từ ngày"
						value={fromDate}
						max={toDate}
						onChange={(e) => {
							if (e.target.value) onChangeCustomDates(e.target.value, toDate);
						}}
						className="bg-transparent text-xs font-medium text-[#10221b] focus:outline-none"
					/>
					<span className="text-xs text-[#7b8c82]">→</span>
					<input
						type="date"
						aria-label="Đến ngày"
						value={toDate}
						min={fromDate}
						onChange={(e) => {
							if (e.target.value) onChangeCustomDates(fromDate, e.target.value);
						}}
						className="bg-transparent text-xs font-medium text-[#10221b] focus:outline-none"
					/>
				</div>

				<select
					aria-label="Khu vực"
					value={areaCode}
					onChange={(e) => onChangeArea(e.target.value)}
					className="min-h-9 rounded-xl border border-[#dfe8df] bg-white px-3 py-1.5 text-xs font-medium text-[#10221b] transition-colors focus:border-[#164027] focus:outline-none"
				>
					<option value="">Tất cả khu vực</option>
					{areas.map((area) => (
						<option key={area.code} value={area.code}>
							{area.name}
						</option>
					))}
				</select>

				<Button
					variant="outline"
					size="sm"
					onClick={onRefresh}
					disabled={isFetching}
					aria-label="Làm mới số liệu phân tích"
					className="min-h-9 rounded-xl"
				>
					<RefreshCw
						className={`size-3.5 ${isFetching ? "animate-spin" : ""}`}
						aria-hidden="true"
					/>
					<span>{isFetching ? "Đang tải..." : "Làm mới"}</span>
				</Button>
			</div>
		</div>
	);
}
