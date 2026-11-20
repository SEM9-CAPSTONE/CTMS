import { RefreshCw } from "lucide-react";
import { Button, Card } from "../../../shared/components";
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
		<Card className="space-y-4 p-4 sm:p-5">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<fieldset
					className="flex flex-wrap items-center gap-2 border-0 p-0"
					aria-label="Chọn nhanh khoảng thời gian"
				>
					{PERIOD_PRESET_OPTIONS.map((opt) => {
						const active = preset === opt.value;
						return (
							<button
								key={opt.value}
								type="button"
								onClick={() => onSelectPreset(opt.value)}
								aria-pressed={active}
								className={
									active
										? "rounded-full bg-[#164027] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors"
										: "rounded-full border border-[#d6e2d6] bg-white px-3.5 py-1.5 text-xs font-medium text-[#2c4234] transition-colors hover:bg-[#f2f7f2]"
								}
							>
								{opt.label}
							</button>
						);
					})}
				</fieldset>
				<Button
					variant="outline"
					size="sm"
					onClick={onRefresh}
					disabled={isFetching}
					aria-label="Làm mới số liệu phân tích"
				>
					<RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
					<span>{isFetching ? "Đang cập nhật..." : "Làm mới"}</span>
				</Button>
			</div>

			<div className="grid grid-cols-1 gap-3 border-t border-[#e8efe8] pt-4 sm:grid-cols-3">
				<label className="flex flex-col gap-1.5 text-xs font-medium text-[#526357]">
					<span>Từ ngày (giờ Việt Nam)</span>
					<input
						type="date"
						value={fromDate}
						max={toDate}
						onChange={(e) => {
							if (e.target.value) onChangeCustomDates(e.target.value, toDate);
						}}
						className="rounded-lg border border-[#d6e2d6] bg-white px-3 py-2 text-sm text-[#10221b] focus:border-[#164027] focus:outline-none"
					/>
				</label>

				<label className="flex flex-col gap-1.5 text-xs font-medium text-[#526357]">
					<span>Đến ngày (giờ Việt Nam)</span>
					<input
						type="date"
						value={toDate}
						min={fromDate}
						onChange={(e) => {
							if (e.target.value) onChangeCustomDates(fromDate, e.target.value);
						}}
						className="rounded-lg border border-[#d6e2d6] bg-white px-3 py-2 text-sm text-[#10221b] focus:border-[#164027] focus:outline-none"
					/>
				</label>

				<label className="flex flex-col gap-1.5 text-xs font-medium text-[#526357]">
					<span>Khu vực</span>
					<select
						value={areaCode}
						onChange={(e) => onChangeArea(e.target.value)}
						className="rounded-lg border border-[#d6e2d6] bg-white px-3 py-2 text-sm text-[#10221b] focus:border-[#164027] focus:outline-none"
					>
						<option value="">Tất cả khu vực</option>
						{areas.map((area) => (
							<option key={area.code} value={area.code}>
								{area.name} ({area.provinceName})
							</option>
						))}
					</select>
				</label>
			</div>
		</Card>
	);
}
