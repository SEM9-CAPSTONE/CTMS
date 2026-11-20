import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { HttpError } from "../../../core/api";
import { useTripRecommendationExplanation } from "../hooks/useTripRecommendations";
import { HealthConsentRequired } from "./HealthConsentRequired";
import { healthComparisonSections } from "./TripHealthAssessmentPanel";

import { TripExplanationSection } from "./TripExplanationSection";

export interface TripRecommendationExplanationProps {
	tripId: string;
}

/**
 * "Vì sao gợi ý chuyến này cho bạn", shown on a Trip opened from the suggestions. Each point quotes
 * what the Camper entered in their profile or preferences, explains it against the Trip's real
 * figures and concludes. A Trip that is not in the latest suggestions (404) shows nothing.
 */
export function TripRecommendationExplanation({ tripId }: TripRecommendationExplanationProps) {
	const explanation = useTripRecommendationExplanation(tripId);
	const data = explanation.data;
	const sections = [
		...healthComparisonSections(data?.healthAssessment),
		...(data?.sections.filter((section) => !data.healthAssessment || section.kind !== "fitness") ??
			[]),
	];
	const summary = data?.summary?.trim();

	if (explanation.isError && explanation.error instanceof HttpError) {
		if (explanation.error.status === 404) return null;
		if (explanation.error.status === 403) {
			const data = explanation.error.errorData;
			if (
				data &&
				typeof data === "object" &&
				"code" in data &&
				data.code === "HEALTH_CONSENT_REQUIRED"
			) {
				return <HealthConsentRequired onRetry={() => void explanation.refetch()} />;
			}
			return null;
		}
	}

	return (
		<section
			aria-labelledby="trip-recommendation-explanation-title"
			className="rounded-3xl border border-[#dfe8df] bg-white p-5 shadow-sm"
		>
			<div className="flex items-start gap-3">
				<div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#164027] text-white">
					<Sparkles className="size-5" />
				</div>
				<div>
					<h2
						id="trip-recommendation-explanation-title"
						className="text-base font-extrabold text-[#10221b]"
					>
						Vì sao gợi ý chuyến này cho bạn
					</h2>
				</div>
			</div>

			{explanation.isFetching && (
				<div className="mt-4 flex items-center gap-2 text-xs font-bold text-[#164027]">
					<Loader2 className="size-4 animate-spin" />
					<span>Đang tải lý do gợi ý...</span>
				</div>
			)}

			{explanation.isError && (
				<div
					role="alert"
					className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800"
				>
					<span className="font-bold">Không tải được lý do gợi ý.</span>
					<button
						type="button"
						onClick={() => void explanation.refetch()}
						className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-rose-700 px-3 py-1.5 font-bold text-white hover:bg-rose-800"
					>
						<RefreshCw className="size-3.5" />
						Thử lại
					</button>
				</div>
			)}

			{explanation.data && !explanation.isFetching && !explanation.isError && (
				<>
					{sections.length > 0 && (
						<ul aria-label="Lý do gợi ý chi tiết" className="mt-4 grid gap-4 md:grid-cols-2">
							{sections.map((section, index) => (
								<TripExplanationSection
									key={`${section.kind}-${section.title}`}
									section={section}
									className={
										index === sections.length - 1 && sections.length % 2 === 1
											? "md:col-span-2"
											: ""
									}
								/>
							))}
						</ul>
					)}

					{summary && (
						<section aria-label="Kết luận" className="mt-4 rounded-2xl bg-[#164027] p-4 text-white">
							<p className="text-[11px] font-bold uppercase tracking-wider text-[#cfe3d2]">
								Kết luận
							</p>
							<p className="mt-2 text-sm font-semibold leading-6">{summary}</p>
						</section>
					)}

					{!explanation.data.healthConsidered && (
						<p className="mt-3 text-[11px] text-[#7b8c82]">
							Bật chia sẻ hồ sơ sức khỏe để gợi ý xét thêm thể lực và bệnh nền của bạn. Thông tin
							sức khỏe chỉ được dùng trong hệ thống, không gửi cho dịch vụ AI.
						</p>
					)}
				</>
			)}
		</section>
	);
}
