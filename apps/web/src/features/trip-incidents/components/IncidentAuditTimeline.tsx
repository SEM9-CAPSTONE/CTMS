import { History, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { incidentActionLabels, incidentStatusLabels } from "../constants";
import type { IncidentAction } from "../types";

export interface IncidentAuditTimelineProps {
	history: IncidentAction[];
	isLoading: boolean;
}

export function IncidentAuditTimeline({
	history,
	isLoading,
}: IncidentAuditTimelineProps): ReactNode {
	return (
		<section className="border-t border-slate-200 pt-4">
			<div className="flex items-center gap-1.5 font-extrabold text-[#10221b]">
				<History className="size-4" />
				<span>Lịch sử xử lý sự cố (Audit History)</span>
			</div>

			{isLoading ? (
				<div className="mt-3 flex items-center justify-center p-4 text-xs text-[#667a6d]">
					<Loader2 className="mr-2 size-4 animate-spin" />
					<span>Đang tải lịch sử...</span>
				</div>
			) : history.length === 0 ? (
				<p className="mt-2 text-xs italic text-slate-500">Chưa có hành động xử lý nào.</p>
			) : (
				<ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-[#fbfdfb]">
					{history.map((act) => (
						<li key={act.id} className="space-y-1 p-3 text-xs">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div className="flex items-center gap-2">
									<span className="font-bold text-[#164027]">
										{incidentActionLabels[act.action] ?? act.action}
									</span>
									{act.actorName && (
										<span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
											{act.actorName} ({act.actorRole ?? "user"})
										</span>
									)}
								</div>
								<span className="text-[11px] text-slate-400">
									{new Date(act.createdAt).toLocaleString("vi-VN")}
								</span>
							</div>

							{act.toStatus && act.fromStatus && (
								<p className="text-[#33463a]">
									Chuyển trạng thái:{" "}
									<span className="font-semibold text-slate-600">
										{incidentStatusLabels[act.fromStatus] ?? act.fromStatus}
									</span>{" "}
									→{" "}
									<span className="font-bold text-[#164027]">
										{incidentStatusLabels[act.toStatus] ?? act.toStatus}
									</span>
								</p>
							)}

							{act.note && (
								<p className="rounded border border-slate-100 bg-white p-2 italic text-slate-600">
									&quot;{act.note}&quot;
								</p>
							)}
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
