export interface ReviewReputation {
	ratingAverage: number | null;
	ratingCount: number;
}

export const reputationLabels = {
	empty: "Chưa có đánh giá",
	unavailable: "Chưa có dữ liệu uy tín",
	stale: "Chưa cập nhật",
	retry: "Thử lại",
};

/** Round the decimal representation half-up, independently of binary toFixed ties. */
export function formatReputationRating(value: number): string {
	const [whole, fraction = ""] = String(value).split(".");
	const tenths =
		Number(whole) * 10 + Number(fraction[0] ?? 0) + (Number(fraction[1] ?? 0) >= 5 ? 1 : 0);
	return `${Math.floor(tenths / 10)},${tenths % 10}`;
}

export function reputationText(value: ReviewReputation): { visible: string; accessible: string } {
	if (value.ratingAverage === null && value.ratingCount === 0) {
		return { visible: reputationLabels.empty, accessible: reputationLabels.empty };
	}
	if (
		!Number.isFinite(value.ratingAverage) ||
		value.ratingAverage === null ||
		value.ratingAverage < 1 ||
		value.ratingAverage > 5 ||
		!Number.isInteger(value.ratingCount) ||
		value.ratingCount < 1
	) {
		return { visible: reputationLabels.unavailable, accessible: reputationLabels.unavailable };
	}
	const rating = formatReputationRating(value.ratingAverage);
	return {
		visible: `${rating}/5 · ${value.ratingCount.toLocaleString("vi-VN")} đánh giá`,
		accessible: `Điểm uy tín ${rating} trên 5, ${value.ratingCount.toLocaleString("vi-VN")} đánh giá`,
	};
}
