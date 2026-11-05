import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { ReviewSource } from "./ReviewSource";
import { sentimentLabels, sentimentStyles, topicLabels } from "./constants";
import type { Insight } from "./types";

export function InsightCard({
	item,
	actor,
	tripId,
	index,
}: { item: Insight; actor: string; tripId: string; index: number }) {
	const [expanded, setExpanded] = useState(false);
	const topics = expanded ? item.topics : item.topics.slice(0, 2);
	return (
		<article className="flex h-full flex-col rounded-2xl border border-[#dfe8df] bg-white p-4">
			<div className="flex items-center justify-between gap-3">
				<h3 className="text-sm font-semibold">
					Nhận xét {index}
					<span className="ml-2 text-[10px] font-normal text-[#728070]">AI tóm tắt</span>
				</h3>
				<span
					className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${sentimentStyles[item.sentiment]}`}
				>
					{sentimentLabels[item.sentiment]}
				</span>
			</div>
			<p
				className={`mt-2 break-words text-sm leading-6 text-[#283c31] ${expanded ? "whitespace-pre-wrap" : "line-clamp-2 min-h-12"}`}
			>
				{item.summary}
			</p>
			<div className="mt-auto flex min-h-10 flex-wrap items-center gap-1.5 pt-3">
				{topics.map((topic) => (
					<span
						key={topic}
						className="rounded-md bg-[#f1f5ee] px-2 py-0.5 text-[11px] text-[#476047]"
					>
						{topicLabels[topic]}
					</span>
				))}
				{!expanded && item.topics.length > 2 && (
					<span className="text-[11px] text-[#728070]">+{item.topics.length - 2} chủ đề</span>
				)}
				<button
					type="button"
					aria-expanded={expanded}
					onClick={() => setExpanded(!expanded)}
					className="ml-auto inline-flex min-h-7 items-center gap-1 rounded-md px-1.5 text-xs font-semibold text-[#164027] hover:bg-[#f1f5ee]"
				>
					{expanded ? "Thu gọn" : "Xem chi tiết"}
					<ChevronDown
						className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
					/>
				</button>
			</div>
			{expanded && (
				<div className="mt-3 border-t border-[#e5ece5] pt-3">
					<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#66756d]">
						<span>Độ tin cậy ước tính: {Math.round(item.confidence * 100)}%</span>
						<span>{new Date(item.analyzedAt).toLocaleString("vi-VN")}</span>
					</div>
					{item.topics.length === 0 && (
						<p className="mt-2 text-xs text-[#66756d]">Chưa xác định chủ đề từ nhận xét này.</p>
					)}
					<ReviewSource
						actor={actor}
						tripId={tripId}
						reviewId={item.reviewId}
						revision={item.sourceRevision}
					/>
				</div>
			)}
		</article>
	);
}
