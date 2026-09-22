import { Flag, RefreshCw } from "lucide-react";
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
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div>
						<h1 className="flex items-center gap-3 text-2xl font-extrabold">
							<Flag className="size-7 text-[#164027]" />
							Báo cáo nội dung
						</h1>
						<p className="mt-2 text-sm text-[#667a6d]">
							Xem báo cáo và cập nhật trạng thái xử lý từ dữ liệu hệ thống.
						</p>
					</div>
					<button
						type="button"
						disabled={queue.loading || details.submitting}
						onClick={() => void queue.reload()}
						className="inline-flex items-center gap-2 rounded-xl border border-[#cbdaca] bg-white px-4 py-2.5 text-sm font-bold disabled:opacity-50"
					>
						<RefreshCw className="size-4" />
						Tải lại danh sách
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
				{queue.loading && (
					<output className="rounded-xl bg-white p-12 text-center">
						Đang tải danh sách báo cáo...
					</output>
				)}
				{queue.error && (
					<ReportErrorNotice error={queue.error} onRetry={() => void queue.reload()} />
				)}
				{queue.data && !queue.loading && !queue.error && (
					<ReportQueueTable
						data={queue.data}
						disabled={details.submitting}
						onOpen={details.open}
						onPage={queue.setPage}
					/>
				)}
			</div>
		</AdminLayout>
	);
}
