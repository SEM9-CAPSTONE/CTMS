import { Flag, Loader2, RefreshCw } from "lucide-react";
import { Card } from "../../../shared/components";
import { AdminLayout } from "../../admin-layout/components/AdminLayout";
import { ReportDetailsPanel } from "../components/ReportDetailsPanel";
import { ReportErrorNotice } from "../components/ReportErrorNotice";
import { ReportQueueTable } from "../components/ReportQueueTable";
import { useReportDetails } from "../hooks/useReportDetails";
import { useReportQueue } from "../hooks/useReportQueue";

export function AdminContentReportsPage({
	onLogout,
}: { onLogout?: (allDevices: boolean) => Promise<void> }) {
	const queue = useReportQueue();
	const details = useReportDetails(queue.reload);
	return (
		<AdminLayout activeItem="content-reports" onLogout={onLogout}>
			<div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="flex items-center gap-3 text-2xl font-extrabold text-[#10221b]">
							<Flag className="size-7 text-[#164027]" />
							Báo cáo nội dung
						</h1>
						<p className="mt-1 text-sm text-[#667a6d]">
							Xem danh sách báo cáo vi phạm và cập nhật trạng thái xử lý từ dữ liệu hệ thống.
						</p>
					</div>
					<button
						type="button"
						disabled={queue.loading || details.submitting}
						onClick={() => void queue.reload()}
						className="inline-flex items-center gap-2 rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2 text-xs font-bold text-[#55685a] shadow-xs hover:bg-[#f6f9f6] hover:text-[#164027] disabled:opacity-50"
					>
						<RefreshCw
							className={`size-3.5 ${queue.loading ? "animate-spin text-[#164027]" : ""}`}
						/>
						<span>Tải lại danh sách</span>
					</button>
				</div>
				{details.selectedId && (
					<ReportDetailsPanel
						{...details}
						onClose={details.close}
						onRetry={() => void details.reload()}
						onSubmit={(status) => void details.submit(status)}
					/>
				)}
				{queue.error && (
					<ReportErrorNotice error={queue.error} onRetry={() => void queue.reload()} />
				)}
				<Card className="overflow-hidden p-0 border border-[#dfe8df] bg-white rounded-2xl shadow-sm">
					{queue.loading ? (
						<div className="flex items-center justify-center gap-3 p-16 text-sm font-bold text-[#54655a]">
							<Loader2 className="size-5 animate-spin text-[#164027]" />
							<span>Đang tải danh sách báo cáo...</span>
						</div>
					) : queue.data ? (
						<ReportQueueTable
							data={queue.data}
							disabled={details.submitting}
							onOpen={details.open}
							onPage={queue.setPage}
						/>
					) : null}
				</Card>
			</div>
		</AdminLayout>
	);
}
