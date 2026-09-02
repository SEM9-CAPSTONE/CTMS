import { AlertCircle, CheckCircle2, Lightbulb, Loader2, RefreshCw } from "lucide-react";
import { useWeatherAdvice } from "../hooks/useWeatherAdvice";
import type { CreatedTrekkingRoute } from "../types";

interface RouteWeatherAdvicePanelProps {
	route: CreatedTrekkingRoute;
}

function formatDateTime(value: string | null): string {
	if (!value) return "";
	return new Date(value).toLocaleString("vi-VN");
}

export function RouteWeatherAdvicePanel({ route }: RouteWeatherAdvicePanelProps) {
	const advice = useWeatherAdvice(route.id);
	const generateDisabled = route.status !== "active" || advice.isGenerating;

	const handleGenerate = async () => {
		advice.resetGenerateError();
		await advice.generate();
	};

	return (
		<section
			className="mt-6 rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm"
			data-testid="route-weather-advice-panel"
		>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 className="font-extrabold text-[#10221b]">Lời khuyên rủi ro thời tiết</h2>
					<p className="mt-1 text-sm text-[#667a6d]">
						Giải thích rõ ràng và hành động cụ thể dựa trên đánh giá rủi ro hiện có, do AI tạo.
					</p>
				</div>
				{route.status !== "active" && (
					<span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
						Chỉ tạo được khi tuyến đang Hoạt động
					</span>
				)}
			</div>

			{advice.isLoading && (
				<div
					data-testid="advice-loading"
					className="mt-4 flex items-center gap-2 text-sm font-bold text-[#667a6d]"
				>
					<Loader2 className="size-4 animate-spin" />
					Đang tải lời khuyên...
				</div>
			)}

			{advice.error && !advice.isLoading && (
				<div
					role="alert"
					data-testid="advice-load-error"
					className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
				>
					<span className="flex items-center gap-2">
						<AlertCircle className="size-5 shrink-0" />
						{advice.error}
					</span>
					<button
						type="button"
						onClick={() => void advice.reload()}
						className="rounded-lg border px-3 py-2 font-bold"
					>
						<RefreshCw className="mr-1 inline size-4" />
						Tải lại
					</button>
				</div>
			)}

			{!advice.isLoading && !advice.error && !advice.advice && (
				<p data-testid="advice-empty" className="mt-4 text-sm font-bold text-[#667a6d]">
					Chưa có lời khuyên cho tuyến này. Vui lòng tạo lời khuyên từ đánh giá rủi ro hiện có.
				</p>
			)}

			{!advice.isLoading && !advice.error && advice.advice && (
				<div className="mt-4 space-y-4" data-testid="advice-content">
					<div className="flex items-start gap-2 rounded-xl border border-[#e0ebe0] bg-[#f4f7f2] p-4">
						<Lightbulb className="mt-0.5 size-5 shrink-0 text-[#164027]" />
						<div className="flex-1 space-y-2">
							<p data-testid="advice-text" className="text-sm font-bold text-[#10221b]">
								{advice.advice.adviceText}
							</p>
							<span className="text-xs font-bold text-[#667a6d]">
								Tạo lúc: {formatDateTime(advice.advice.createdAt)}
							</span>
						</div>
					</div>

					<div>
						<h3 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-[#667a6d]">
							Hành động khuyến nghị
						</h3>
						<ul data-testid="advice-actions" className="space-y-2">
							{advice.advice.actions.map((action) => (
								<li
									key={action}
									className="flex items-start gap-2 rounded-xl border border-[#e0ebe0] bg-white p-3 text-sm font-bold text-[#425048] shadow-sm"
								>
									<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
									{action}
								</li>
							))}
						</ul>
					</div>
				</div>
			)}

			{advice.generateError && (
				<div
					role="alert"
					data-testid="advice-generate-error"
					className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
				>
					<AlertCircle className="size-5 shrink-0" />
					{advice.generateError.message}
				</div>
			)}

			<button
				type="button"
				disabled={generateDisabled}
				onClick={() => void handleGenerate()}
				className="mt-4 flex items-center gap-2 rounded-xl bg-[#164027] px-4 py-2.5 font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"
			>
				{advice.isGenerating ? (
					<Loader2 className="size-4 animate-spin" />
				) : (
					<Lightbulb className="size-4" />
				)}
				{advice.isGenerating ? "Đang tạo..." : "Tạo lời khuyên"}
			</button>
		</section>
	);
}
