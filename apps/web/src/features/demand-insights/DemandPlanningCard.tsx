import { CAPACITY_OBSERVED_NOTE, difficultyLabels, tripLabels } from "./constants";
import type { PlanningRecommendation } from "./types";

export function DemandPlanningCard({ rec }: { rec: PlanningRecommendation }) {
	return (
		<article className="flex flex-col justify-between rounded-xl border border-[#dfe8df] bg-[#f4f7f2] p-4.5">
			<div>
				<div className="flex items-start justify-between gap-2 border-b border-[#dfe8df] pb-3">
					<h3 className="font-semibold text-[#164027]">
						Chuyến {tripLabels[rec.tripType].toLowerCase()}
						{rec.difficulty ? ` · ${difficultyLabels[rec.difficulty]}` : ""}
					</h3>
					<span className="shrink-0 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-[#164027]">
						{rec.bookerBand.min}–{rec.bookerBand.max} người đã đặt
					</span>
				</div>

				{/* Observed Booking evidence */}
				<div className="mt-3.5 space-y-2">
					<h4 className="text-xs font-bold uppercase tracking-wider text-[#526357]">
						Dữ liệu đã ghi nhận
					</h4>
					<div className="space-y-1.5 text-sm">
						{rec.priceRangeLabel && (
							<p>
								<span className="text-[#526357]">Khoảng giá: </span>
								<span className="font-medium text-[#10221b]">{rec.priceRangeLabel}</span>
							</p>
						)}
						{rec.capacityRangeLabel && (
							<div>
								<p>
									<span className="text-[#526357]">Sức chứa ghi nhận: </span>
									<span className="font-medium text-[#10221b]">{rec.capacityRangeLabel}</span>
								</p>
								<p className="mt-0.5 text-xs text-[#526357]">{CAPACITY_OBSERVED_NOTE}</p>
							</div>
						)}
						{rec.durationLabel && (
							<p>
								<span className="text-[#526357]">Thời lượng: </span>
								<span className="font-medium text-[#10221b]">{rec.durationLabel}</span>
							</p>
						)}
						{rec.area?.label && (
							<p>
								<span className="text-[#526357]">Khu vực: </span>
								<span className="font-medium text-[#10221b]">{rec.area.label}</span>
							</p>
						)}
					</div>
				</div>

				{/* General organization advice */}
				{rec.generalAdvice && rec.generalAdvice.length > 0 && (
					<div className="mt-4 border-t border-[#dfe8df] pt-3.5">
						<h4 className="text-xs font-bold uppercase tracking-wider text-[#526357]">
							Gợi ý tổ chức
						</h4>
						<ul className="mt-2 space-y-1.5 list-disc pl-5">
							{rec.generalAdvice.map((adv) => (
								<li key={adv.code} className="text-sm leading-6 text-[#10221b]">
									{adv.text}
								</li>
							))}
						</ul>
					</div>
				)}
			</div>

			{/* Advisory limitation */}
			{rec.disclaimer && (
				<p className="mt-4 border-t border-[#dfe8df] pt-2.5 text-xs italic leading-5 text-[#526357]">
					{rec.disclaimer}
				</p>
			)}
		</article>
	);
}
