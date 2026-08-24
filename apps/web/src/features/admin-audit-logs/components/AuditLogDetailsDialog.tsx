import { CalendarDays, FileJson, ShieldAlert, X } from "lucide-react";
import { ACTION_LABELS, TARGET_TYPE_LABELS } from "../constants";
import type { AuditLogSummary } from "../types";

export interface AuditLogDetailsDialogProps {
	open: boolean;
	log: AuditLogSummary | null;
	onClose: () => void;
}

export function AuditLogDetailsDialog({ open, log, onClose }: AuditLogDetailsDialogProps) {
	if (!open || !log) return null;

	return (
		<dialog
			open
			aria-modal="true"
			className="fixed inset-0 z-50 flex items-center justify-center bg-[#10221b]/50 p-4"
			aria-labelledby="log-detail-title"
		>
			<div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl flex flex-col">
				<div className="flex items-center justify-between border-b border-[#e0ebe0] px-6 py-4 sticky top-0 bg-white z-10">
					<h2
						id="log-detail-title"
						className="text-xl font-extrabold text-[#10221b] flex items-center gap-2"
					>
						<ShieldAlert className="size-5 text-[#164027]" /> Chi tiết nhật ký hệ thống
					</h2>
					<button
						type="button"
						onClick={onClose}
						aria-label="Đóng chi tiết"
						className="rounded-lg p-2 text-[#667a6d] hover:bg-[#f4f7f2]"
					>
						<X className="size-5" />
					</button>
				</div>

				<div className="space-y-6 p-6 overflow-y-auto">
					<div className="grid gap-4 sm:grid-cols-2">
						<DetailField
							label="Hành động"
							value={ACTION_LABELS[log.action] ?? log.action}
							subValue={log.action}
						/>
						<DetailField
							label="Thời gian"
							icon={CalendarDays}
							value={new Date(log.createdAt).toLocaleString("vi-VN")}
						/>
						<DetailField
							label="Người thực hiện"
							value={
								log.actorName
									? `${log.actorName} (${log.actorId || ""})`
									: log.actorId || "System / Khách vãng lai"
							}
						/>
						<DetailField
							label="Loại đối tượng"
							value={TARGET_TYPE_LABELS[log.targetType] ?? log.targetType}
							subValue={log.targetType}
						/>
						<DetailField
							label="Đối tượng (Target ID)"
							value={log.targetId}
							className="sm:col-span-2 font-mono text-xs"
						/>
						{log.reason && (
							<DetailField
								label="Lý do"
								value={log.reason}
								className="sm:col-span-2 bg-[#fdfaf2] border-amber-200"
							/>
						)}
					</div>

					<div className="grid gap-6 md:grid-cols-2 pt-2">
						<div>
							<p className="text-xs font-bold uppercase tracking-wide text-[#667a6d] mb-2 flex items-center gap-1.5">
								<FileJson className="size-4" /> Trạng thái trước (Before)
							</p>
							{log.before ? (
								<pre className="text-xs bg-[#10221b] text-emerald-400 p-4 rounded-xl overflow-x-auto font-mono max-h-[300px]">
									{JSON.stringify(log.before, null, 2)}
								</pre>
							) : (
								<div className="text-sm italic text-[#788c7e] p-4 bg-[#f4f7f2] rounded-xl text-center">
									null (Không có dữ liệu trước)
								</div>
							)}
						</div>

						<div>
							<p className="text-xs font-bold uppercase tracking-wide text-[#667a6d] mb-2 flex items-center gap-1.5">
								<FileJson className="size-4" /> Trạng thái sau (After)
							</p>
							{log.after ? (
								<pre className="text-xs bg-[#10221b] text-emerald-400 p-4 rounded-xl overflow-x-auto font-mono max-h-[300px]">
									{JSON.stringify(log.after, null, 2)}
								</pre>
							) : (
								<div className="text-sm italic text-[#788c7e] p-4 bg-[#f4f7f2] rounded-xl text-center">
									null (Không có dữ liệu sau)
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</dialog>
	);
}

interface DetailFieldProps {
	label: string;
	value: string;
	subValue?: string;
	icon?: typeof CalendarDays;
	className?: string;
}

function DetailField({ label, value, subValue, icon: Icon, className = "" }: DetailFieldProps) {
	return (
		<div className={`rounded-xl border border-[#e0ebe0] p-4 ${className}`}>
			<div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#667a6d]">
				{Icon && <Icon className="size-4" />}
				{label}
			</div>
			<p className="mt-2 break-words text-sm font-semibold text-[#10221b]">{value}</p>
			{subValue && subValue !== value && (
				<p className="mt-1 text-[10px] font-mono text-[#a0b0a8]">{subValue}</p>
			)}
		</div>
	);
}
