import { RoutePath } from "../../../routes/routes.config";
import type {
	RecommendationHealthBasis as HealthBasisData,
	TripHealthAssessment,
	TripRecommendationExplanationSection,
} from "../types";
import { TripExplanationSection } from "./TripExplanationSection";

export function RecommendationHealthBasis({ basis }: { basis?: HealthBasisData }) {
	if (!basis) return null;
	const activity = basis.activityProfile;
	return (
		<section
			className="mb-4 rounded-2xl border border-[#e0ebe0] bg-white p-4 text-[#3b5446]"
			aria-label="Hồ sơ sức khỏe đã dùng"
		>
			<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
				<h3 className="text-sm font-extrabold text-[#164027]">Hồ sơ sức khỏe đã dùng</h3>
				<a
					href={`${RoutePath.CAMPER_PROFILE}?tab=health_fitness`}
					className="text-xs font-semibold text-[#164027] underline underline-offset-4 hover:text-[#276143] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#164027]"
				>
					Cập nhật khả năng vận động
				</a>
			</div>
			<p className="mt-2 text-sm leading-6">
				Thể lực: {basis.fitnessLevel}.{" "}
				{activity?.comfortableDistanceKm != null
					? `Đi bộ quen thuộc: ${activity.comfortableDistanceKm} km/ngày.`
					: "Chưa khai báo quãng đường đi bộ."}{" "}
				{activity?.comfortableWalkingMinutes != null
					? `${activity.comfortableWalkingMinutes} phút/ngày.`
					: "Chưa khai báo thời gian đi bộ."}
			</p>
		</section>
	);
}

export function healthComparisonSections(
	assessment?: TripHealthAssessment,
	compact = false
): TripRecommendationExplanationSection[] {
	return (assessment?.comparisons ?? [])
		.filter((item) => item.result === "match" || item.result === "caution")
		.map((item) => ({
			kind: "fitness",
			tone: item.result === "match" ? "match" : "caution",
			title: item.label,
			quote: compact
				? null
				: { source: "health_profile", field: item.label, text: item.profileValue },
			detail: `Chuyến yêu cầu: ${item.tripValue}`,
			conclusion: null,
		}));
}

export function TripHealthAssessmentPanel({
	assessment,
	compact = false,
}: { assessment?: TripHealthAssessment; compact?: boolean }) {
	const sections = healthComparisonSections(assessment, compact);
	if (sections.length === 0) return null;
	return (
		<section className="mt-4" aria-label="Đối chiếu hồ sơ sức khỏe với chuyến đi">
			<ul className={`grid gap-4 ${compact ? "" : "md:grid-cols-2"}`}>
				{sections.map((section) => (
					<TripExplanationSection key={section.title} section={section} />
				))}
			</ul>
		</section>
	);
}
