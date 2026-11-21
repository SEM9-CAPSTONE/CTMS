import type { RecommendationReason } from "./types";

/** Labels for the reason codes the backend has validated; AI text is never shown. */
export const RECOMMENDATION_REASON_LABELS: Record<RecommendationReason, string> = {
	preferred_trip_type: "Đúng loại chuyến bạn chọn",
	preferred_difficulty: "Đúng độ khó bạn chọn",
	preferred_region: "Ở khu vực bạn quan tâm",
	preferred_price: "Phù hợp mức giá bạn chọn",
	booked_trip_type: "Giống loại chuyến bạn từng đi",
	booked_difficulty: "Độ khó tương tự chuyến bạn từng đi",
	booked_region: "Cùng khu vực với chuyến bạn từng đi",
	booked_price: "Mức giá tương tự chuyến bạn từng đặt",
	departing_soon: "Sắp khởi hành",
	fitness_match: "Phù hợp thể lực của bạn",
};

export function recommendationReasonLabels(reasons: readonly string[]): string[] {
	return reasons.flatMap((reason) =>
		reason in RECOMMENDATION_REASON_LABELS
			? [RECOMMENDATION_REASON_LABELS[reason as RecommendationReason]]
			: []
	);
}
