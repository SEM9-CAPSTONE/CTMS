import { panelClass, sentimentLabels, sentimentStyles, topicLabels } from "./constants";
import type { InsightResponse, Sentiment } from "./types";
export function InsightOverview({ data }: { data: InsightResponse }) {
	const c = data.coverage;
	return (
		<>
			<section className={panelClass} aria-labelledby="coverage-title">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<p className="text-xs font-semibold uppercase tracking-wider text-[#6f7d70]">
							Độ bao phủ phân tích
						</p>
						<h2 id="coverage-title" className="mt-2 text-3xl font-semibold text-[#164027]">
							{c.analyzed}
							<span className="text-lg font-normal text-[#728070]">
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
				<div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[#62705f]">
					<span>{c.pending} đang chờ / chạy</span>
					<span>{c.failed} chưa thành công</span>
					<span>{c.stale} cần cập nhật</span>
					<span>{c.unprocessed} chưa phân tích</span>
					<span>{c.excluded} ngoài phạm vi đủ điều kiện</span>
				</div>
				{(data.freshness.reviewChanged > 0 ||
					data.freshness.configurationChanged > 0 ||
					data.freshness.restricted > 0) && (
					<div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900">
						<p>Các kết quả không còn phù hợp được loại khỏi tổng hợp.</p>
						{data.freshness.reviewChanged > 0 && (
							<p>{data.freshness.reviewChanged} đánh giá đã sửa nội dung.</p>
						)}
						{data.freshness.configurationChanged > 0 && (
							<p>{data.freshness.configurationChanged} đánh giá cần phân tích theo cấu hình mới.</p>
						)}
						{data.freshness.restricted > 0 && (
							<p>
								{data.freshness.restricted} đánh giá đang bị giới hạn điều kiện phân tích, có thể
								liên quan kiểm duyệt.
							</p>
						)}
					</div>
				)}
			</section>
			<div className="grid gap-5 xl:grid-cols-2">
				<section className={panelClass}>
					<h2 className="font-semibold">Cảm nhận qua nhận xét</h2>
					<p className="mt-1 text-xs text-[#728070]">
						Tính trên {c.analyzed} đánh giá đã phân tích · không phải điểm sao
					</p>
					<div className="mt-5 space-y-4">
						{(Object.keys(sentimentLabels) as Sentiment[]).map((key) => (
							<div key={key}>
								<div className="mb-1.5 flex justify-between text-sm">
									<span>{sentimentLabels[key]}</span>
									<span className="font-semibold">{data.sentimentCounts[key]}</span>
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
					<h2 className="font-semibold">Chủ đề được nhắc đến</h2>
					<p className="mt-1 text-xs text-[#728070]">Một nhận xét có thể đề cập nhiều chủ đề</p>
					{data.topics.length === 0 ? (
						<p className="py-12 text-center text-sm text-[#728070]">
							{c.analyzed
								? "Đã có kết quả nhưng chưa xác định được chủ đề."
								: "Chủ đề sẽ xuất hiện sau khi có kết quả phân tích."}
						</p>
					) : (
						<div className="mt-5 flex flex-wrap gap-3">
							{data.topics.map((t) => (
								<span
									key={t.topic}
									className="rounded-xl bg-[#f2f6ed] px-3 py-2 text-sm text-[#46623e]"
								>
									{topicLabels[t.topic]}{" "}
									<strong className="ml-2">
										{t.count}/{t.denominator}
									</strong>
								</span>
							))}
						</div>
					)}
				</section>
			</div>
		</>
	);
}
