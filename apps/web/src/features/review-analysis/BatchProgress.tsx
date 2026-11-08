import { Loader2 } from "lucide-react";
import { freshnessLabels, isActive, itemLabels, panelClass } from "./constants";
import type { BatchResponse } from "./types";
export function BatchProgress({ data }: { data: BatchResponse }) {
	const done = data.progress.total - data.progress.pending - data.progress.running;
	const active = isActive(data.batch.status);
	return (
		<section className={panelClass} aria-labelledby="batch-title">
			<div className="flex flex-wrap justify-between gap-2">
				<h2 id="batch-title" className="flex items-center gap-2 font-semibold">
					{active && <Loader2 className="size-4 animate-spin text-[#164027]" />}
					<span>{active ? "Đang xử lý lượt phân tích" : "Lượt phân tích gần nhất"}</span>
				</h2>
				<output className="text-sm text-[#66756d]">
					{done}/{data.progress.total} đã xử lý
				</output>
			</div>
			<progress
				className={`mt-3 h-2 w-full overflow-hidden rounded-full border-0 bg-[#edf1e9] [&::-webkit-progress-bar]:bg-[#edf1e9] [&::-webkit-progress-value]:bg-[#527a3c] [&::-moz-progress-bar]:bg-[#527a3c] ${active ? "animate-pulse" : ""}`}
				max={Math.max(1, data.progress.total)}
				value={done}
				aria-label="Tiến độ lượt phân tích"
			/>
			<p className="mt-3 text-xs leading-6 text-[#66756d]">
				{data.progress.succeeded} thành công · {data.progress.failed} chưa thành công ·{" "}
				{data.progress.pending + data.progress.running} đang chờ / chạy ·{" "}
				{data.progress.skipped + data.progress.suppressed} bỏ qua
			</p>
			{data.batch.status === "partial" && (
				<p className="mt-2 text-sm text-amber-800">
					Lượt phân tích hoàn thành một phần. Kết quả thành công vẫn được giữ lại.
				</p>
			)}
			<details className="mt-4 text-sm" open={active}>
				<summary className="cursor-pointer font-medium text-[#164027]">
					Xem trạng thái từng nhận xét
				</summary>
				<ol className="mt-3 divide-y divide-[#e5ece5]">
					{data.items.map((item, index) => (
						<li key={item.id} className="py-3">
							<div className="flex justify-between gap-3">
								<span>
									Nhận xét {index + 1} · phiên bản {item.sourceRevision}
								</span>
								<span className="inline-flex items-center gap-1.5 font-medium">
									{(item.status === "pending" || item.status === "running") && (
										<Loader2 className="size-3.5 animate-spin text-[#164027]" />
									)}
									<span>{itemLabels[item.status]}</span>
								</span>
							</div>
							{item.freshnessReason && (
								<p className="mt-1 text-xs text-amber-800">
									{freshnessLabels[item.freshnessReason] ??
										"Kết quả cần được cập nhật trước khi tổng hợp."}
								</p>
							)}
							{item.status === "failed" && (
								<p className="mt-1 text-xs text-[#728070]">
									Dịch vụ chưa thể hoàn thành phân tích. Đánh giá gốc vẫn được giữ nguyên.
								</p>
							)}
						</li>
					))}
				</ol>
			</details>
		</section>
	);
}
