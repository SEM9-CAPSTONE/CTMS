import {
	AlertCircle,
	CheckCircle2,
	CloudRain,
	Loader2,
	Package,
	RefreshCw,
	ShieldCheck,
} from "lucide-react";
import { usePackingList } from "../hooks/usePackingList";
import type { PackingListDifficulty, PackingListItem, PackingListWeatherRiskLevel } from "../types";

export interface PackingListPanelProps {
	bookingId: string;
	refreshKey?: number | string;
	hideCardStyles?: boolean;
}

const DIFFICULTY_LABEL: Record<PackingListDifficulty, string> = {
	easy: "Dễ",
	moderate: "Trung bình",
	hard: "Khó",
	expert: "Chuyên gia",
};

const WEATHER_RISK_LABEL: Record<PackingListWeatherRiskLevel, string> = {
	green: "An toàn",
	yellow: "Cần lưu ý",
	red: "Rủi ro cao",
};

function contextSummary(
	tripType: "day_trip" | "overnight",
	durationNights: number,
	difficulty: PackingListDifficulty | null,
	weatherRiskLevel: PackingListWeatherRiskLevel | null
): string[] {
	const chips: string[] = [
		tripType === "overnight" ? `Qua đêm (${durationNights} đêm)` : "Trong ngày",
	];
	if (difficulty) chips.push(`Độ khó: ${DIFFICULTY_LABEL[difficulty]}`);
	if (weatherRiskLevel) chips.push(`Thời tiết: ${WEATHER_RISK_LABEL[weatherRiskLevel]}`);
	return chips;
}

function ItemRow({ item }: { item: PackingListItem }) {
	return (
		<li
			data-testid={`packing-list-item-${item.id}`}
			className="flex items-start justify-between gap-3 rounded-xl bg-[#f4f7f2] px-3 py-2.5 text-xs"
		>
			<div className="flex items-start gap-2">
				<Package className="mt-0.5 size-3.5 shrink-0 text-[#164027]" />
				<div>
					<p className="font-bold text-[#10221b]">{item.name}</p>
					<p className="mt-0.5 text-[11px] text-[#667a6d]">{item.reason}</p>
				</div>
			</div>
			{item.alreadyCovered && (
				<span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
					<CheckCircle2 className="size-3" />
					Đã có trong thiết bị thuê
				</span>
			)}
		</li>
	);
}

export function PackingListPanel({
	bookingId,
	refreshKey = 0,
	hideCardStyles = false,
}: PackingListPanelProps) {
	const { packingList, isLoading, error, retry } = usePackingList(bookingId, refreshKey);

	const requiredItems = packingList?.items.filter((item) => item.required) ?? [];
	const recommendedItems = packingList?.items.filter((item) => !item.required) ?? [];

	return (
		<section
			aria-label="Packing list cho chuyến đi"
			className={hideCardStyles ? "" : "mt-4 rounded-2xl border border-[#dfe8df] bg-white p-4"}
		>
			{!hideCardStyles && (
				<h3 className="flex items-center gap-2 text-sm font-extrabold text-[#10221b]">
					<ShieldCheck className="size-4 text-[#164027]" />
					Danh sách đồ cần chuẩn bị
				</h3>
			)}

			{isLoading && (
				<div
					data-testid="packing-list-loading"
					className="mt-3 flex items-center gap-2 text-xs font-bold text-[#667a6d]"
				>
					<Loader2 className="size-4 animate-spin" />
					Đang tải packing list...
				</div>
			)}

			{error && !isLoading && (
				<div
					role="alert"
					className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800"
				>
					{error}
					<button
						type="button"
						onClick={() => void retry()}
						className="ml-2 inline-flex items-center gap-1 font-bold underline"
					>
						<RefreshCw className="size-3" />
						Tải lại
					</button>
				</div>
			)}

			{!isLoading && !error && packingList && (
				<>
					<div className="mt-2 flex flex-wrap gap-2">
						{contextSummary(
							packingList.context.tripType,
							packingList.context.durationNights,
							packingList.context.difficulty,
							packingList.context.weatherRiskLevel
						).map((chip) => (
							<span
								key={chip}
								className="rounded-full bg-[#edf3ed] px-2.5 py-1 text-[11px] font-bold text-[#55685a]"
							>
								{chip}
							</span>
						))}
					</div>

					{packingList.items.length === 0 && (
						<p data-testid="packing-list-empty" className="mt-3 text-xs text-[#667a6d]">
							Chưa có gợi ý packing list cho booking này.
						</p>
					)}

					{requiredItems.length > 0 && (
						<div className="mt-4">
							<h4 className="flex items-center gap-1.5 text-xs font-extrabold text-[#10221b]">
								<AlertCircle className="size-3.5 text-rose-700" />
								Bắt buộc
							</h4>
							<ul className="mt-2 space-y-2">
								{requiredItems.map((item) => (
									<ItemRow key={item.id} item={item} />
								))}
							</ul>
						</div>
					)}

					{recommendedItems.length > 0 && (
						<div className="mt-4">
							<h4 className="flex items-center gap-1.5 text-xs font-extrabold text-[#10221b]">
								<CloudRain className="size-3.5 text-[#667a6d]" />
								Khuyến nghị
							</h4>
							<ul className="mt-2 space-y-2">
								{recommendedItems.map((item) => (
									<ItemRow key={item.id} item={item} />
								))}
							</ul>
						</div>
					)}
				</>
			)}
		</section>
	);
}
