import {
	mutedTextClass,
	panelClass,
	sentimentLabels,
	sentimentStyles,
	subTextClass,
	topicLabels,
} from "./constants";
import type { InsightResponse, Sentiment } from "./types";
export function InsightOverview({ data }: { data: InsightResponse }) {
	const c = data.coverage;
	return (
		<>
			<section className={panelClass} aria-labelledby="coverage-title">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<p className="text-xs font-semibold uppercase tracking-wider text-[#41513d]">
							Độ bao phủ phân tích
						</p>
						<h2 id="coverage-title" className="mt-2 text-3xl font-semibold text-[#164027]">
							{c.analyzed}
							<span className="text-lg font-normal text-[#374151]">
								{" "}
								/ {c.eligible} đánh giá đủ điều kiện
							</span>
						</h2>
					</div>
					<span className="rounded-full bg-[#edf4e8] px-3 py-1 text-sm font-semibold text-[#164027]">
						{Math.round(c.ratio * 100)}%
					</span>
				</div>
				<progress
					className="mt-3 h-2 w-full overflow-hidden rounded-full border-0 bg-[#edf1e9] [&::-webkit-progress-bar]:bg-[#edf1e9] [&::-webkit-progress-value]:bg-[#527a3c] [&::-moz-progress-bar]:bg-[#527a3c]"
					max={Math.max(1, c.eligible)}
					value={c.analyzed}
					aria-label="Độ bao phủ phân tích"
				/>
				<div className={`mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs ${mutedTextClass}`}>
					<span>{c.pending} đang chờ / chạy</span>
					<span>{c.failed} chưa thành công</span>
					<span>{c.stale} cần cập nhật</span>
					<span>{c.unprocessed} chưa phân tích</span>
					<span>{c.excluded} ngoài phạm vi đủ điều kiện</span>
				</div>
				{(data.freshness.configurationChanged > 0 || data.freshness.restricted > 0) && (
					<div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900 border border-amber-200">
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
								• {data.freshness.restricted} đánh giá đang bị giới hạn điều kiện phân tích, có thể
								liên quan kiểm duyệt.
							</p>
						)}
					</div>
				)}
			</section>
			<div className="grid gap-5 xl:grid-cols-2">
				<section className={panelClass}>
					<h2 className="font-semibold text-[#10221b]">Cảm nhận qua nhận xét</h2>
					<p className={`mt-1 text-xs ${subTextClass}`}>
						Tính trên {c.analyzed} đánh giá đã phân tích · không phải điểm sao
					</p>
					<div className="mt-5 space-y-4">
						{(Object.keys(sentimentLabels) as Sentiment[]).map((key) => (
							<div key={key}>
								<div className="mb-1.5 flex justify-between text-sm">
									<span className="font-medium text-[#10221b]">{sentimentLabels[key]}</span>
									<span className="font-semibold text-[#164027]">{data.sentimentCounts[key]}</span>
								</div>
								<div className="h-2 overflow-hidden rounded-full bg-[#f0f3ed]">
									<div
										className={`h-full rounded-full ${sentimentStyles[key]}`}
										style={{
											width: `${c.analyzed ? (data.sentimentCounts[key] / c.analyzed) * 100 : 0}%`,
											backgroundColor: {
												positive: "#527a3c",
												neutral: "#a2b0a1",
												negative: "#c7867a",
												mixed: "#c1a665",
											}[key],
										}}
									/>
								</div>
							</div>
						))}
					</div>
				</section>
				<section className={panelClass}>
					<h2 className="font-semibold text-[#10221b]">Chủ đề được nhắc đến</h2>
					<p className={`mt-1 text-xs ${subTextClass}`}>Một nhận xét có thể đề cập nhiều chủ đề</p>
					{data.topics.length === 0 ? (
						<p className={`py-12 text-center text-sm ${subTextClass}`}>
							{c.analyzed
								? "Đã có kết quả nhưng chưa xác định được chủ đề."
								: "Chủ đề sẽ xuất hiện sau khi có kết quả phân tích."}
						</p>
					) : (
						<div className="mt-5 space-y-3.5">
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
												className="h-full rounded-full bg-[#527a3c] transition-all"
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
		</>
	);
}
