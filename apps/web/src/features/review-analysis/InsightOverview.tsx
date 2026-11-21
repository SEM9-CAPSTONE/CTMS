import {
	mutedTextClass,
	panelClass,
	sentimentLabels,
	sentimentStyles,
	subTextClass,
	topicLabels,
} from "./constants";
import type { InsightResponse } from "./types";

export function InsightOverview({ data }: { data: InsightResponse }) {
	const c = data.coverage;
	return (
		<div className="grid gap-4 xl:grid-cols-3">
			<section
				className={`${panelClass} flex flex-col justify-between`}
				aria-labelledby="coverage-title"
			>
				<div>
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div>
							<p className="text-xs font-medium tracking-wide text-[#53674d]">
								Độ bao phủ phân tích
							</p>
							<h2
								id="coverage-title"
								className="mt-1.5 text-3xl font-bold tracking-tight text-[#164027]"
							>
								{c.analyzed}
								<span className="text-base font-normal text-[#4b5563]">
									{" "}
									/ {c.eligible} đánh giá đủ điều kiện
								</span>
							</h2>
						</div>
						<span className="rounded-full bg-[#edf4e8] px-3 py-1 text-xs font-bold text-[#164027]">
							{Math.round(c.ratio * 100)}%
						</span>
					</div>
					<progress
						className="mt-3.5 h-2 w-full overflow-hidden rounded-full border-0 bg-[#edf1e9] [&::-webkit-progress-bar]:bg-[#edf1e9] [&::-webkit-progress-value]:bg-[#164027] [&::-moz-progress-bar]:bg-[#164027]"
						max={Math.max(1, c.eligible)}
						value={c.analyzed}
						aria-label="Độ bao phủ phân tích"
					/>
				</div>

				<div className="mt-4 space-y-3">
					<div className={`flex flex-wrap gap-2 text-xs ${mutedTextClass}`}>
						<span className="rounded-lg bg-[#f6f8f5] px-2.5 py-1">{c.pending} đang chờ / chạy</span>
						<span className="rounded-lg bg-[#f6f8f5] px-2.5 py-1">{c.failed} chưa thành công</span>
						<span className="rounded-lg bg-[#f6f8f5] px-2.5 py-1">{c.stale} cần cập nhật</span>
						<span className="rounded-lg bg-[#f6f8f5] px-2.5 py-1">
							{c.unprocessed} chưa phân tích
						</span>
						<span className="rounded-lg bg-[#f6f8f5] px-2.5 py-1">
							{c.excluded} ngoài phạm vi đủ điều kiện
						</span>
					</div>
					{(data.freshness.configurationChanged > 0 || data.freshness.restricted > 0) && (
						<div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs leading-5 text-amber-900">
							<p className="font-semibold text-amber-950">
								Các kết quả không còn phù hợp được loại khỏi tổng hợp:
							</p>
							{data.freshness.configurationChanged > 0 && (
								<p>
									• {data.freshness.configurationChanged} đánh giá cần phân tích theo cấu hình mới.
								</p>
							)}
							{data.freshness.restricted > 0 && (
								<p>
									• {data.freshness.restricted} đánh giá đang bị giới hạn điều kiện phân tích, có
									thể liên quan kiểm duyệt.
								</p>
							)}
						</div>
					)}
				</div>
			</section>

			<section className={panelClass}>
				<div className="flex items-center justify-between">
					<h2 className="text-base font-semibold text-[#10221b]">Cảm nhận qua nhận xét</h2>
					<span className="text-xs text-[#667a6d]">{c.analyzed} đã phân tích</span>
				</div>
				<div className="mt-4 space-y-4">
					{(["positive", "neutral", "negative"] as const).map((key) => {
						const count =
							key === "neutral"
								? (data.sentimentCounts.neutral || 0) + (data.sentimentCounts.mixed || 0)
								: data.sentimentCounts[key];
						const label = key === "neutral" ? "Trung lập" : sentimentLabels[key];
						const pct = c.analyzed ? Math.round((count / c.analyzed) * 100) : 0;

						return (
							<div key={key}>
								<div className="mb-1.5 flex items-baseline justify-between text-sm">
									<span className="font-medium text-[#10221b]">{label}</span>
									<div className="flex items-baseline gap-1.5">
										<span className="font-bold text-[#164027]">{count}</span>
										<span className="text-xs text-[#667a6d]">({pct}%)</span>
									</div>
								</div>
								<div className="h-2 overflow-hidden rounded-full bg-[#f0f3ed]">
									<div
										className={`h-full rounded-full transition-all duration-300 ${sentimentStyles[key]}`}
										style={{
											width: `${c.analyzed ? (count / c.analyzed) * 100 : 0}%`,
											backgroundColor: {
												positive: "#164027",
												neutral: "#94a393",
												negative: "#c76d5e",
											}[key],
										}}
									/>
								</div>
							</div>
						);
					})}
				</div>
			</section>

			<section className={panelClass}>
				<div className="flex items-center justify-between">
					<h2 className="text-base font-semibold text-[#10221b]">Chủ đề được nhắc đến</h2>
					<span className="text-xs text-[#667a6d]">Tỷ lệ xuất hiện</span>
				</div>
				{data.topics.length === 0 ? (
					<p className={`py-10 text-center text-sm ${subTextClass}`}>
						{c.analyzed
							? "Đã có kết quả nhưng chưa xác định được chủ đề."
							: "Chủ đề sẽ xuất hiện sau khi có kết quả phân tích."}
					</p>
				) : (
					<div className="mt-4 space-y-3">
						{data.topics.map((t) => {
							const denominator = t.denominator || c.analyzed || 1;
							const pct = Math.min(100, Math.round((t.count / denominator) * 100));
							return (
								<div key={t.topic} className="space-y-1.5">
									<div className="flex justify-between text-sm">
										<span className="font-medium text-[#10221b]">
											{topicLabels[t.topic] || t.topic}
										</span>
										<span className="font-semibold text-[#164027]">
											{t.count}/{denominator}
											<span className="ml-1.5 text-xs font-normal text-[#4b5563]">({pct}%)</span>
										</span>
									</div>
									<div className="h-2 overflow-hidden rounded-full bg-[#f0f3ed]">
										<div
											className="h-full rounded-full bg-[#2f5e3d] transition-all duration-300"
											style={{ width: `${pct}%` }}
										/>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</section>
		</div>
	);
}
