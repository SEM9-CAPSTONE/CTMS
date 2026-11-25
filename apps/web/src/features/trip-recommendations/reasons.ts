import type { RecommendationReason } from "./types";

/** Labels for the reason codes the backend has validated; AI text is never shown. */
export const RECOMMENDATION_REASON_LABELS: Record<RecommendationReason, string> = {
	preferred_activity: "Có hoạt động bạn yêu thích",
	declared_experience_match: "Đối chiếu kinh nghiệm bạn khai báo",
	preferred_trip_type: "Đúng loại chuyến bạn chọn",
	preferred_difficulty: "Đúng độ khó bạn chọn",
	preferred_region: "Ở khu vực bạn quan tâm",
	preferred_price: "Phù hợp mức giá bạn chọn",
	booked_trip_type: "Giống loại chuyến bạn từng đặt",
	booked_difficulty: "Độ khó tương tự chuyến bạn từng đặt",
	booked_region: "Cùng khu vực với chuyến bạn từng đặt",
	booked_price: "Mức giá tương tự chuyến bạn từng đặt",
	departing_soon: "Sắp khởi hành",
	fitness_match: "Phù hợp thông tin vận động đã khai báo",
};

export function recommendationReasonLabels(reasons: readonly string[]): string[] {
	return reasons.flatMap((reason) =>
		reason in RECOMMENDATION_REASON_LABELS
			? [RECOMMENDATION_REASON_LABELS[reason as RecommendationReason]]
			: []
	);
}
