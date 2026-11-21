import type { ActivityProfile } from "../profiles/entities/activity-profile";
import { fitnessFit } from "./trip-fitness.policy";
import type {
	CandidateFacts,
	HealthSignal,
	RankedCandidate,
	RecommendationReason,
} from "./trip-recommendation.policy";

export type HealthAssessmentStatus = "suitable" | "needs_review" | "insufficient_data";
export interface HealthComparison {
	label: string;
	profileValue: string;
	tripValue: string;
	detail: string;
	result: "match" | "caution" | "unknown";
}
export interface TripHealthAssessment {
	status: HealthAssessmentStatus;
	summary: string;
	comparisons: HealthComparison[];
	missingInformation: string[];
	profileConfirmedAt: string | null;
}
export interface HealthBasis {
	fitnessLevel: string;
	activityProfile: ActivityProfile | null;
	hasMedicalConditions: boolean;
}
export const HEALTH_STATUS_ORDER: Record<HealthAssessmentStatus, number> = {
	suitable: 0,
	needs_review: 1,
	insufficient_data: 2,
};
export const FITNESS_LABELS: Record<string, string> = {
	BEGINNER: "Mới bắt đầu",
	INTERMEDIATE: "Trung bình",
	ADVANCED: "Nâng cao",
	EXPERT: "Chuyên gia",
};
export function healthBasis(health: HealthSignal): HealthBasis {
	return {
		fitnessLevel: FITNESS_LABELS[health.fitnessLevel] ?? "Chưa xác định",
		activityProfile: health.activityProfile ?? null,
		hasMedicalConditions: health.hasMedicalConditions,
	};
}

/** Compares declared activity facts, never diagnoses or derives a medical contraindication from a disease name. */
export function assessTripHealth(trip: CandidateFacts, health: HealthSignal): TripHealthAssessment {
	const activity = health.activityProfile;
	const comparisons: HealthComparison[] = [];
	const missingInformation: string[] = [];
	let needsReview = false;
	const fit = fitnessFit(health.fitnessLevel, trip.difficulty, null, null);
	const difficultyLabel: Record<string, string> = {
		easy: "Dễ",
		moderate: "Trung bình",
		hard: "Khó",
		expert: "Chuyên gia",
	};
	if (fit === null) missingInformation.push("Chuyến chưa có độ khó cung đường.");
	if (fit === "stretch" || fit === "too_hard") needsReview = true;
	comparisons.push({
		label: "Thể lực và độ khó",
		profileValue: FITNESS_LABELS[health.fitnessLevel] ?? "Chưa xác định",
		tripValue: trip.difficulty ? difficultyLabel[trip.difficulty] : "Chưa có thông tin",
		result: fit === null ? "unknown" : fit === "good" ? "match" : "caution",
		detail:
			fit === "good"
				? "Độ khó nằm trong mức thể lực bạn tự khai báo; đây chưa phải kết luận về toàn bộ sức khỏe."
				: fit === null
					? "Chưa thể đối chiếu độ khó."
					: "Độ khó cao hơn mức thể lực bạn chọn; cần xác nhận khả năng tham gia.",
	});
	const perDayKnown = trip.durationNights === 0;
	if (!perDayKnown)
		missingInformation.push(
			"Chuyến qua đêm chưa có quãng đường và thời gian đi bộ từng ngày để đối chiếu."
		);
	const dimensions = [
		{
			label: "Quãng đường đi bộ trong ngày",
			declared: activity?.comfortableDistanceKm,
			required: trip.routeLengthMeters === null ? null : trip.routeLengthMeters / 1000,
			unit: "km",
			missing: "Bạn chưa khai báo quãng đường đi bộ quen thuộc trong ngày.",
			routeMissing: "Chuyến chưa có chiều dài cung đường.",
		},
		{
			label: "Thời gian đi bộ trong ngày",
			declared: activity?.comfortableWalkingMinutes,
			required: trip.routeDurationMinutes,
			unit: "phút",
			missing: "Bạn chưa khai báo thời gian đi bộ quen thuộc trong ngày.",
			routeMissing: "Chuyến chưa có thời gian đi bộ dự kiến.",
		},
	];
	for (const dimension of dimensions) {
		const hasDeclared = typeof dimension.declared === "number" && dimension.declared >= 0;
		const hasRequired = typeof dimension.required === "number" && dimension.required > 0;
		if (!hasDeclared) missingInformation.push(dimension.missing);
		if (!hasRequired) missingInformation.push(dimension.routeMissing);
		const known = hasDeclared && hasRequired && perDayKnown;
		const exceeds = known && (dimension.required as number) > (dimension.declared as number);
		if (exceeds) needsReview = true;
		comparisons.push({
			label: dimension.label,
			profileValue: hasDeclared ? `${dimension.declared} ${dimension.unit}` : "Chưa khai báo",
			tripValue: hasRequired
				? `${dimension.required} ${dimension.unit}${perDayKnown ? "" : " toàn cung đường"}`
				: "Chưa có thông tin",
			result: !known ? "unknown" : exceeds ? "caution" : "match",
			detail: !known
				? "Chưa đủ dữ liệu để đối chiếu khả năng đi bộ trong ngày."
				: exceeds
					? "Yêu cầu của chuyến vượt mức đi bộ bạn khai báo; ưu tiên xem các chuyến ngắn hơn hoặc xác nhận thêm."
					: "Yêu cầu của chuyến nằm trong mức đi bộ bạn khai báo.",
		});
	}
	if (activity?.activityNotes?.trim()) {
		needsReview = true;
		comparisons.push({
			label: "Lưu ý khi vận động",
			profileValue: activity.activityNotes,
			tripValue: "Chưa có xác nhận khả năng đáp ứng của chuyến",
			result: "caution",
			detail:
				"Thông tin này cần được xác nhận theo tình huống cụ thể; hệ thống không tự diễn giải ghi chú thành kết luận y tế.",
		});
	}
	for (const [present, label, detail] of [
		[
			health.hasMedicalConditions,
			"Bệnh nền",
			"Hồ sơ có khai báo bệnh nền. Hệ thống chưa đủ dữ liệu để đánh giá ảnh hưởng; cần xác nhận yêu cầu vận động với nhân viên y tế.",
		],
	] as const) {
		if (!present) continue;
		needsReview = true;
		comparisons.push({
			label,
			profileValue: "Có khai báo trong hồ sơ sức khỏe",
			tripValue: "Cần xác nhận thêm",
			result: "caution",
			detail,
		});
	}
	const status: HealthAssessmentStatus = needsReview
		? "needs_review"
		: missingInformation.length
			? "insufficient_data"
			: "suitable";
	const summary =
		status === "suitable"
			? "Yêu cầu vận động nằm trong thông tin bạn đã khai báo. Đây không phải xác nhận an toàn y tế."
			: status === "needs_review"
				? "Có yêu cầu vận động hoặc nhu cầu hỗ trợ cần xác nhận thêm trước khi chọn chuyến."
				: "Chưa đủ thông tin từ hồ sơ hoặc cung đường để đánh giá mức phù hợp.";
	return {
		status,
		summary,
		comparisons,
		missingInformation,
		profileConfirmedAt: activity?.confirmedAt ?? null,
	};
}

/** Stable tiers: preferences/AI order can only reorder Trips within the same health-assessment tier. */
export function prioritizeHealth(
	ranked: readonly RankedCandidate[],
	health: HealthSignal | null
): RankedCandidate[] {
	if (!health) return [...ranked];
	return ranked
		.map((item) => {
			const assessment = assessTripHealth(item.candidate.facts, health);
			const reasons: RecommendationReason[] = item.reasons.filter(
				(reason) => reason !== "fitness_match"
			);
			if (assessment.status === "suitable") reasons.unshift("fitness_match");
			return { ...item, reasons: reasons.slice(0, 2), healthAssessment: assessment };
		})
		.sort(
			(a, b) =>
				HEALTH_STATUS_ORDER[a.healthAssessment.status] -
				HEALTH_STATUS_ORDER[b.healthAssessment.status]
		);
}
