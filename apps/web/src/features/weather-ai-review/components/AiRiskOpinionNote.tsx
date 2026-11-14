import { Sparkles } from "lucide-react";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import type { TripWeatherAiReview } from "../../trips/types";
import { WEATHER_RISK_TONES } from "../../weather/utils/weather-risk";
import { RISK_LEVEL_SHORT } from "../utils/weather-ai-review-labels";

/**
 * AI's own opinion on a Trip forecast (Host and Admin). Informational only: the level above,
 * computed from the thresholds, is the one that counts.
 */
export function AiRiskOpinionNote({ review }: { review: TripWeatherAiReview }) {
	return (
		<div
			data-testid="trip-forecast-ai-opinion"
			data-matches={review.matchesRule ? "true" : "false"}
			className="space-y-1 rounded-xl border border-[#e0ebe0] bg-[#fbfdfb] px-3 py-2 text-xs text-[#4f6356]"
		>
			<div className="flex flex-wrap items-center gap-2">
				<Sparkles className="size-3.5 text-[#164027]" />
				<span className="font-bold text-[#10221b]">Nhận định của AI:</span>
				<StatusBadge tone={WEATHER_RISK_TONES[review.level]}>
					{RISK_LEVEL_SHORT[review.level]}
				</StatusBadge>
				{!review.matchesRule && <StatusBadge tone="warning">Khác với mức theo ngưỡng</StatusBadge>}
			</div>
			<p>{review.reason}</p>
			<p className="text-[11px] text-[#7d8d83]">
				Chỉ để tham khảo. Mức chính thức vẫn tính theo ngưỡng của hệ thống.
			</p>
		</div>
	);
}
