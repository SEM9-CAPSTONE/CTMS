import { Eye } from "lucide-react";
import { ACTION_LABELS, TARGET_TYPE_LABELS } from "../constants";
import type { AuditLogSummary } from "../types";

export interface AuditLogsTableProps {
	logs: AuditLogSummary[];
	onView: (log: AuditLogSummary) => void;
}

function shortenId(id: string): string {
	if (id.length <= 12) return id;
	return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export function AuditLogsTable({ logs, onView }: AuditLogsTableProps) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full min-w-[900px] text-left text-sm">
				<thead className="bg-[#f4f7f2] text-xs uppercase tracking-wide text-[#667a6d]">
					<tr>
						<th className="px-4 py-3">Người thực hiện</th>
						<th className="px-4 py-3">Hành động</th>
						<th className="px-4 py-3">Loại</th>
						<th className="px-4 py-3">Thời gian</th>
						<th className="px-4 py-3 text-right">Thao tác</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-[#e8efe7]">
					{logs.map((log) => {
						const displayActor = log.actorName || log.actorId || "Hệ thống";
						const actionLabel = ACTION_LABELS[log.action] ?? log.action;
						const targetTypeLabel = TARGET_TYPE_LABELS[log.targetType] ?? log.targetType;
						return (
							<tr key={log.id} className="hover:bg-[#f8faf7]">
								<td className="px-4 py-4 text-[#425048]">
									<p className="font-semibold text-[#10221b]">{displayActor}</p>
									{log.actorName && log.actorId && (
										<p className="mt-1 text-xs text-[#788c7e] font-mono">
											{shortenId(log.actorId)}
										</p>
									)}
								</td>
								<td className="px-4 py-4">
									<span className="inline-flex items-center rounded-full bg-[#eef7f0] px-2.5 py-1 text-xs font-semibold text-[#164027]">
										{actionLabel}
									</span>
									<p className="mt-1 text-[10px] text-[#a0b0a8] font-mono">{log.action}</p>
								</td>

								<td className="px-4 py-4 text-[#425048]">
									<span className="inline-flex items-center rounded-full bg-[#f0f4f0] px-2 py-0.5 text-xs font-medium text-[#425048]">
										{targetTypeLabel}
									</span>
								</td>
								<td className="px-4 py-4 text-[#425048]">
									{new Date(log.createdAt).toLocaleString("vi-VN")}
								</td>
								<td className="px-4 py-4">
									<div className="flex justify-end">
										<button
											type="button"
											onClick={() => onView(log)}
											aria-label={`Xem chi tiết log ${log.id}`}
											title="Xem chi tiết"
											className="rounded-lg border border-[#dfe8df] p-2 text-[#164027] hover:bg-[#eef7f0] transition"
										>
											<Eye className="size-4" />
										</button>
									</div>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
