import { AlertCircle, CheckCircle2, RefreshCw, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { WEATHER_RISK_TONES } from "../../weather/utils/weather-risk";
import {
	useAcknowledgeWeatherAiMismatch,
	useWeatherAiMismatches,
} from "../hooks/useWeatherAiReview";
import type { weatherAiReviewService } from "../services/weather-ai-review.service";
import {
	RISK_LEVEL_SHORT,
	mismatchHint,
	readingsSummary,
	weatherAiReviewErrorMessage,
} from "../utils/weather-ai-review-labels";

export const ADMIN_WEATHER_RULES_PATH = "/admin/weather-rules";

export interface WeatherAiMismatchPanelProps {
	service?: typeof weatherAiReviewService;
}

/**
 * "Cần xem lại ngưỡng" tab of Admin › Quản lý thời tiết. The official level still comes from the
 * thresholds; this list only shows Trips where the AI, reading the same forecast, disagrees.
 */
export function WeatherAiMismatchPanel({ service }: WeatherAiMismatchPanelProps) {
	const query = useWeatherAiMismatches(true, service);
	const acknowledge = useAcknowledgeWeatherAiMismatch(service);
	const [error, setError] = useState<string | null>(null);
	const items = query.data ?? [];

	async function markSeen(forecastId: string) {
		setError(null);
		try {
			await acknowledge.mutateAsync(forecastId);
		} catch (ackError) {
			setError(weatherAiReviewErrorMessage(ackError));
		}
	}

	return (
		<section className="space-y-4" data-testid="weather-ai-mismatch-panel">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<p className="text-sm text-[#667a6d]">
					Mức Xanh/Vàng/Đỏ vẫn tính theo ngưỡng bạn đặt. AI đọc cùng số liệu dự báo và tự đánh giá;
					các Trip dưới đây là nơi hai bên khác nhau, nên xem lại ngưỡng có hợp lý không.
				</p>
				<div className="flex shrink-0 gap-2">
					<a
						href={ADMIN_WEATHER_RULES_PATH}
						className="inline-flex items-center gap-2 rounded-xl border border-[#dfe8df] bg-white px-4 py-2.5 text-sm font-bold text-[#164027] hover:bg-[#f1f5f0]"
					>
						<SlidersHorizontal className="size-4" /> Xem ngưỡng
					</a>
					<button
						type="button"
						onClick={() => void query.refetch()}
						className="inline-flex items-center gap-2 rounded-xl border border-[#dfe8df] bg-white px-4 py-2.5 text-sm font-bold text-[#164027] hover:bg-[#f1f5f0]"
					>
						<RefreshCw className="size-4" /> Làm mới
					</button>
				</div>
			</div>

			{(query.isError || error) && (
				<div
					role="alert"
					className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"
				>
					<AlertCircle className="size-5 shrink-0" />
					{error ?? weatherAiReviewErrorMessage(query.error)}
				</div>
			)}
			{query.isPending && <p className="text-sm text-[#667a6d]">Đang tải...</p>}
			{query.isSuccess && items.length === 0 && (
				<p className="rounded-2xl border border-[#dfe8df] bg-white p-6 text-sm text-[#667a6d]">
					Ngưỡng và AI đang đánh giá giống nhau cho mọi Trip sắp đi.
				</p>
			)}

			{items.length > 0 && (
				<ul className="space-y-3" aria-label="Trip có đánh giá lệch">
					{items.map((item) => {
						const readings = readingsSummary(item);
						const pending = acknowledge.isPending && acknowledge.variables === item.forecastId;
						return (
							<li
								key={item.forecastId}
								data-testid="weather-ai-mismatch-row"
								className="flex flex-col gap-3 rounded-2xl border border-[#dfe8df] bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between"
							>
								<div className="min-w-0 space-y-2">
									<div>
										<p className="font-extrabold text-[#10221b]">{item.tripTitle}</p>
										<p className="mt-1 text-xs text-[#667a6d]">
											Khởi hành {new Date(item.tripStartsAt).toLocaleString("vi-VN")}
											{item.hostName ? ` · Host ${item.hostName}` : ""}
											{item.ruleVersion !== null ? ` · Ngưỡng v${item.ruleVersion}` : ""}
										</p>
									</div>
									<div className="flex flex-wrap gap-2">
										<StatusBadge tone={WEATHER_RISK_TONES[item.riskLevel]}>
											Theo ngưỡng: {RISK_LEVEL_SHORT[item.riskLevel]}
										</StatusBadge>
										<StatusBadge tone={WEATHER_RISK_TONES[item.aiRiskLevel]}>
											AI đánh giá: {RISK_LEVEL_SHORT[item.aiRiskLevel]}
										</StatusBadge>
									</div>
									<p className="text-sm text-[#10221b]">
										<span className="font-bold">Lý do của AI:</span> {item.aiReason}{" "}
										<span className="text-xs text-[#667a6d]">
											(độ chắc chắn {Math.round(item.aiConfidence * 100)}%)
										</span>
									</p>
									{readings && <p className="text-xs text-[#667a6d]">Giờ xấu nhất: {readings}</p>}
									<p className="text-xs font-semibold text-[#8a5a00]">{mismatchHint(item)}</p>
								</div>
								<button
									type="button"
									onClick={() => void markSeen(item.forecastId)}
									disabled={pending}
									className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-[#164027] px-4 py-2 text-xs font-bold text-white hover:bg-[#0d2617] disabled:opacity-50"
								>
									<CheckCircle2 className="size-4" /> {pending ? "Đang lưu..." : "Đã xem"}
								</button>
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
