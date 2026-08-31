import { Activity, AlertCircle, CheckCircle2, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { useWeatherRiskScore } from "../hooks/useWeatherRiskScore";
import type { CreatedTrekkingRoute, RiskLevel } from "../types";

interface RouteWeatherRiskPanelProps {
	route: CreatedTrekkingRoute;
}

function formatDateTime(value: string | null): string {
	if (!value) return "";
	return new Date(value).toLocaleString("vi-VN");
}

function getRiskBadgeClasses(level: RiskLevel) {
	switch (level) {
		case "green":
			return "bg-emerald-100 text-emerald-800 border border-emerald-200";
		case "yellow":
			return "bg-amber-100 text-amber-800 border border-amber-200";
		case "red":
			return "bg-red-100 text-red-800 border border-red-200";
	}
}

function getRiskLabel(level: RiskLevel) {
	switch (level) {
		case "green":
			return "An toàn (Thấp)";
		case "yellow":
			return "Cảnh báo (Trung bình)";
		case "red":
			return "Nguy hiểm (Cao)";
	}
}

export function RouteWeatherRiskPanel({ route }: RouteWeatherRiskPanelProps) {
	const risk = useWeatherRiskScore(route.id);
	const assessment = risk.assessment;
	const calculateDisabled = route.status !== "active" || risk.isCalculating;

	const handleCalculate = async () => {
		risk.resetCalculateError();
		await risk.calculate();
	};

	return (
		<section
			className="mt-6 rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm"
			data-testid="route-weather-risk-panel"
		>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 className="font-extrabold text-[#10221b]">Đánh giá rủi ro thời tiết</h2>
					<p className="mt-1 text-sm text-[#667a6d]">
						Phân tích rủi ro đa tiêu chí dựa trên dữ liệu thời tiết thực tế gần nhất.
					</p>
				</div>
				{route.status !== "active" && (
					<span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
						Chỉ tính được khi tuyến đang Hoạt động
					</span>
				)}
			</div>

			{risk.isLoading && (
				<div
					data-testid="risk-loading"
					className="mt-4 flex items-center gap-2 text-sm font-bold text-[#667a6d]"
				>
					<Loader2 className="size-4 animate-spin" />
					Đang tải đánh giá rủi ro...
				</div>
			)}

			{risk.error && !risk.isLoading && (
				<div
					role="alert"
					data-testid="risk-load-error"
					className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
				>
					<span className="flex items-center gap-2">
						<AlertCircle className="size-5 shrink-0" />
						{risk.error}
					</span>
					<button
						type="button"
						onClick={() => void risk.reload()}
						className="rounded-lg border px-3 py-2 font-bold"
					>
						<RefreshCw className="mr-1 inline size-4" />
						Tải lại
					</button>
				</div>
			)}

			{!risk.isLoading && !risk.error && !risk.assessment && (
				<p data-testid="risk-empty" className="mt-4 text-sm font-bold text-[#667a6d]">
					Chưa có đánh giá rủi ro cho tuyến này. Vui lòng tính điểm rủi ro.
				</p>
			)}

			{!risk.isLoading && !risk.error && assessment && (
				<div className="mt-4 space-y-4">
					<div className="flex flex-wrap items-center gap-4 rounded-xl bg-[#f4f7f2] p-4 border border-[#e0ebe0]">
						<div className="flex flex-col gap-1">
							<span className="text-xs font-bold text-[#667a6d] uppercase tracking-wider">
								Mức độ rủi ro
							</span>
							<span
								data-testid="risk-level-badge"
								className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-extrabold ${getRiskBadgeClasses(
									assessment.riskLevel
								)}`}
							>
								{assessment.riskLevel === "green" && <CheckCircle2 className="size-4" />}
								{assessment.riskLevel === "yellow" && <Activity className="size-4" />}
								{assessment.riskLevel === "red" && <ShieldAlert className="size-4" />}
								{getRiskLabel(assessment.riskLevel)}
							</span>
						</div>
						<div className="h-10 w-px bg-[#e0ebe0] hidden sm:block" />
						<div className="flex flex-col gap-1">
							<span className="text-xs font-bold text-[#667a6d] uppercase tracking-wider">
								Điểm rủi ro tổng hợp
							</span>
							<span
								data-testid="risk-composite-score"
								className="text-lg font-extrabold text-[#10221b]"
							>
								{assessment.compositeScore.toFixed(2)}
							</span>
						</div>
						<div className="h-10 w-px bg-[#e0ebe0] hidden sm:block" />
						<div className="flex flex-col gap-1">
							<span className="text-xs font-bold text-[#667a6d] uppercase tracking-wider">
								Thời điểm đánh giá
							</span>
							<span className="text-sm font-bold text-[#10221b]">
								{formatDateTime(assessment.createdAt)}
							</span>
						</div>
					</div>

					<div>
						<h3 className="text-xs font-extrabold text-[#667a6d] uppercase tracking-wider mb-2">
							Chi tiết từng tiêu chí rủi ro
						</h3>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{[
								{
									key: "rainfall",
									label: "Lượng mưa",
									val: `${assessment.criteriaScores.rainfall.value} mm`,
								},
								{
									key: "wind",
									label: "Sức gió",
									val: `${assessment.criteriaScores.wind.value} km/h`,
								},
								{
									key: "temperature",
									label: "Nhiệt độ",
									val: `${assessment.criteriaScores.temperature.value}°C`,
								},
								{
									key: "visibility",
									label: "Tầm nhìn",
									val: `${assessment.criteriaScores.visibility.value} m`,
								},
								{
									key: "thunderstorm",
									label: "Dông sét",
									val: assessment.criteriaScores.thunderstorm.value ? "Có" : "Không",
								},
							].map((item) => {
								const detail =
									assessment.criteriaScores[item.key as keyof typeof assessment.criteriaScores];
								return (
									<div
										key={item.key}
										data-testid={`criterion-${item.key}`}
										className="rounded-xl border border-[#e0ebe0] bg-white p-3.5 shadow-sm flex flex-col justify-between"
									>
										<div className="flex items-start justify-between">
											<span className="font-extrabold text-[#425048] text-sm">{item.label}</span>
											<span
												className={`inline-block size-2.5 rounded-full shrink-0 ${
													detail.level === "green"
														? "bg-emerald-500"
														: detail.level === "yellow"
															? "bg-amber-500"
															: "bg-red-500"
												}`}
												title={getRiskLabel(detail.level)}
											/>
										</div>
										<div className="mt-3 flex items-baseline justify-between">
											<span className="text-base font-extrabold text-[#10221b]">{item.val}</span>
											<span className="text-xs font-bold text-[#667a6d]">
												Điểm: {detail.score} (Hệ số: {detail.weight.toFixed(2)})
											</span>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				</div>
			)}

			{risk.calculateError && (
				<div
					role="alert"
					data-testid="risk-calculate-error"
					className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
				>
					<AlertCircle className="size-5 shrink-0" />
					{risk.calculateError.message}
				</div>
			)}

			<button
				type="button"
				disabled={calculateDisabled}
				onClick={() => void handleCalculate()}
				className="mt-4 flex items-center gap-2 rounded-xl bg-[#164027] px-4 py-2.5 font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"
			>
				{risk.isCalculating ? (
					<Loader2 className="size-4 animate-spin" />
				) : (
					<RefreshCw className="size-4" />
				)}
				{risk.isCalculating ? "Đang tính..." : "Tính điểm rủi ro"}
			</button>
		</section>
	);
}
