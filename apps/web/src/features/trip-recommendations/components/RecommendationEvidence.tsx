import { StatusBadge } from "../../../shared/components/StatusBadge";
import { recommendationReasonLabels } from "../reasons";
import type { TripRecommendationItem } from "../types";
const ASSESSMENT_DISPLAY = {
	suitable: { tone: "success", label: "Phù hợp vận động đã khai báo" },
	needs_review: { tone: "warning", label: "Cần xác nhận thêm" },
	insufficient_data: { tone: "neutral", label: "Chưa đủ thông tin" },
} as const;
export function RecommendationEvidence({ item }: { item: TripRecommendationItem }) {
	const display = item.healthAssessment ? ASSESSMENT_DISPLAY[item.healthAssessment.status] : null;
	const reasons = item.reasons.filter((reason) => !display || reason !== "fitness_match");
	return (
		<div className="flex flex-col gap-2 py-3">
			{display && <StatusBadge tone={display.tone}>{display.label}</StatusBadge>}
			{recommendationReasonLabels(reasons)
				.slice(0, 2)
				.map((reason) => (
					<p key={reason} className="text-sm">
						{reason}
					</p>
				))}
		</div>
	);
}
