import {
	AlertCircle,
	CheckCircle2,
	CloudSun,
	Lightbulb,
	Loader2,
	RefreshCw,
	ShieldAlert,
	TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button, Card, StatusBadge } from "../../../shared/components";
import {
	WEATHER_RISK_LABELS,
	WEATHER_RISK_TONES,
	type WeatherCriterionView,
	type WeatherRiskLevel,
	formatWeatherDateTime,
} from "../utils/weather-risk";

export interface WeatherRiskCardAdvice {
	text: string;
	actions: string[];
}

export interface WeatherRiskCardProps {
	title: string;
	subtitle?: ReactNode;
	isLoading?: boolean;
	/** Blocking error (nothing to show); the card offers `onRetry`. */
	error?: string | null;
	onRetry?: () => void;
	riskLevel?: WeatherRiskLevel | null;
	compositeScore?: number | null;
	assessedAt?: string | null;
	criteria?: WeatherCriterionView[];
	/** Shown instead of the score when there is no assessment (e.g. out of forecast range). */
	emptyMessage?: ReactNode;
	/** Non-blocking note under the header (e.g. partial coverage). */
	notice?: ReactNode;
	advice?: WeatherRiskCardAdvice | null;
	isAdviceLoading?: boolean;
	adviceError?: string | null;
	onRefresh?: () => void;
	isRefreshing?: boolean;
	refreshDisabled?: boolean;
	refreshLabel?: string;
	/** Extra content at the bottom, e.g. a submission gate. */
	children?: ReactNode;
	testId?: string;
}

const LEVEL_ICONS: Record<WeatherRiskLevel, ReactNode> = {
	green: <CheckCircle2 className="size-3.5" />,
	yellow: <TriangleAlert className="size-3.5" />,
	red: <ShieldAlert className="size-3.5" />,
};

const LEVEL_DOTS: Record<WeatherRiskLevel, string> = {
	green: "bg-emerald-500",
	yellow: "bg-amber-500",
	red: "bg-red-500",
};

/** One card for weather data, multi-criteria risk and AI advice. */
export function WeatherRiskCard({
	title,
	subtitle,
	isLoading = false,
	error,
	onRetry,
	riskLevel,
	compositeScore,
	assessedAt,
	criteria = [],
	emptyMessage,
	notice,
	advice,
	isAdviceLoading = false,
	adviceError,
	onRefresh,
	isRefreshing = false,
	refreshDisabled = false,
	refreshLabel = "Cập nhật thời tiết",
	children,
	testId = "weather-risk-card",
}: WeatherRiskCardProps) {
	const hasAssessment =
		Boolean(riskLevel) && compositeScore !== null && compositeScore !== undefined;

	return (
		<section data-testid={testId} aria-label={title}>
			<Card className="border border-[#e0ebe0] p-5">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="flex items-start gap-3">
						<div className="rounded-xl bg-emerald-50 p-2.5 text-[#164027]">
							<CloudSun className="size-5" />
						</div>
						<div>
							<h2 className="font-extrabold text-[#10221b]">{title}</h2>
							{subtitle && <p className="mt-0.5 text-sm text-[#667a6d]">{subtitle}</p>}
						</div>
					</div>
					{onRefresh && (
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={onRefresh}
							disabled={refreshDisabled || isRefreshing || isLoading}
						>
							{isRefreshing ? (
								<Loader2 className="mr-1.5 inline size-4 animate-spin" />
							) : (
								<RefreshCw className="mr-1.5 inline size-4" />
							)}
							{refreshLabel}
						</Button>
					)}
				</div>

				{isLoading ? (
					<p
						data-testid={`${testId}-loading`}
						className="mt-4 flex items-center gap-2 text-sm font-bold text-[#667a6d]"
					>
						<Loader2 className="size-4 animate-spin" /> Đang phân tích thời tiết...
					</p>
				) : error ? (
					<div
						role="alert"
						className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700"
					>
						<span className="flex items-center gap-2">
							<AlertCircle className="size-5 shrink-0" />
							{error}
						</span>
						{onRetry && (
							<Button type="button" size="sm" variant="outline" onClick={onRetry}>
								Thử lại
							</Button>
						)}
					</div>
				) : (
					<div className="mt-4 space-y-4">
						{notice && (
							<p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800">
								{notice}
							</p>
						)}

						{hasAssessment && riskLevel ? (
							<>
								<div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-[#e0ebe0] bg-[#f4f7f2] p-4">
									<div>
										<p className="text-xs font-bold uppercase tracking-wider text-[#667a6d]">
											Mức độ rủi ro
										</p>
										<div className="mt-1" data-testid={`${testId}-level`}>
											<StatusBadge
												tone={WEATHER_RISK_TONES[riskLevel]}
												icon={LEVEL_ICONS[riskLevel]}
											>
												{WEATHER_RISK_LABELS[riskLevel]}
											</StatusBadge>
										</div>
									</div>
									<div>
										<p className="text-xs font-bold uppercase tracking-wider text-[#667a6d]">
											Điểm tổng hợp
										</p>
										<p className="mt-1 text-lg font-extrabold">{compositeScore.toFixed(2)}</p>
									</div>
									{assessedAt && (
										<div>
											<p className="text-xs font-bold uppercase tracking-wider text-[#667a6d]">
												Thời điểm đánh giá
											</p>
											<p className="mt-1 text-sm font-bold">{formatWeatherDateTime(assessedAt)}</p>
										</div>
									)}
								</div>

								<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
									{criteria.map((criterion) => (
										<div
											key={criterion.key}
											data-testid={`${testId}-criterion-${criterion.key}`}
											className="rounded-xl border border-[#e0ebe0] bg-white p-3 shadow-sm"
										>
											<div className="flex items-center justify-between">
												<span className="text-sm font-bold text-[#425048]">{criterion.label}</span>
												<span
													className={`size-2.5 rounded-full ${LEVEL_DOTS[criterion.level]}`}
													aria-label={WEATHER_RISK_LABELS[criterion.level]}
												/>
											</div>
											<div className="mt-1 flex items-end justify-between gap-2">
												<span className="text-base font-extrabold">{criterion.value}</span>
												<span className="text-[11px] font-medium text-[#667a6d]">
													Điểm {criterion.score} · hệ số {criterion.weight}
												</span>
											</div>
											{criterion.hint && (
												<p className="mt-1 text-[11px] text-[#667a6d]">{criterion.hint}</p>
											)}
										</div>
									))}
								</div>

								<div className="rounded-xl border border-[#e0ebe0] bg-[#fbfdfb] p-4">
									<p className="flex items-center gap-2 text-sm font-extrabold">
										<Lightbulb className="size-4 text-amber-500" /> Lời khuyên (AI)
									</p>
									{isAdviceLoading ? (
										<p className="mt-2 flex items-center gap-2 text-xs font-bold text-[#667a6d]">
											<Loader2 className="size-3.5 animate-spin" /> Đang tạo lời khuyên...
										</p>
									) : advice ? (
										<div className="mt-2 space-y-2 text-sm text-[#2b4135]">
											<p>{advice.text}</p>
											{advice.actions.length > 0 && (
												<ul className="list-disc space-y-1 pl-5 text-xs">
													{advice.actions.map((action) => (
														<li key={action}>{action}</li>
													))}
												</ul>
											)}
										</div>
									) : (
										<p className="mt-2 text-xs font-medium text-[#667a6d]">
											{adviceError ?? "Chưa có lời khuyên cho kết quả này."}
										</p>
									)}
								</div>
							</>
						) : (
							<p className="text-sm font-bold text-[#667a6d]">
								{emptyMessage ?? "Chưa có đánh giá thời tiết."}
							</p>
						)}

						{children}
					</div>
				)}
			</Card>
		</section>
	);
}
