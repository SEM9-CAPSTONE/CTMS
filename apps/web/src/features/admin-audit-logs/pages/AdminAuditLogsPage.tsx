import { AlertCircle, FileClock, Loader2, RefreshCw } from "lucide-react";
import { Card } from "../../../shared/components";
import { AdminLayout } from "../../admin-layout/components/AdminLayout";
import { AuditLogDetailsDialog } from "../components/AuditLogDetailsDialog";
import { AuditLogsFilters } from "../components/AuditLogsFilters";
import { AuditLogsPagination } from "../components/AuditLogsPagination";
import { AuditLogsTable } from "../components/AuditLogsTable";
import { useAdminAuditLogs } from "../hooks/useAdminAuditLogs";

export interface AdminAuditLogsPageProps {
	onBackHome?: () => void;
}

export function AdminAuditLogsPage({ onBackHome }: AdminAuditLogsPageProps) {
	const logState = useAdminAuditLogs();

	return (
		<AdminLayout activeItem="audit-logs" onBackHome={onBackHome}>
			<div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
				<div>
					<h1 className="flex items-center gap-3 text-2xl font-extrabold">
						<FileClock className="size-7 text-[#164027]" /> Nhật ký hệ thống (Audit Logs)
					</h1>
					<p className="mt-1 text-sm text-[#667a6d]">
						Tra cứu và lọc thông tin lịch sử hoạt động, kiểm tra các thao tác quan trọng trên hệ
						thống.
					</p>
				</div>

				{logState.errorMessage && (
					<div
						role="alert"
						className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"
					>
						<span className="flex items-center gap-2">
							<AlertCircle className="size-5" />
							{logState.errorMessage}
						</span>
						<button
							type="button"
							onClick={() => void logState.reload()}
							className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-3 py-2 text-xs text-white"
						>
							<RefreshCw className="size-4" /> Thử lại
						</button>
					</div>
				)}

				<Card className="overflow-hidden p-0">
					<AuditLogsFilters
						actor={logState.actorInput}
						action={logState.actionInput}
						targetType={logState.targetTypeInput}
						outcome={logState.outcomeInput}
						startDate={logState.startDateInput}
						endDate={logState.endDateInput}
						disabled={logState.isLoading}
						onActorChange={logState.setActorInput}
						onActionChange={logState.setActionInput}
						onTargetTypeChange={logState.setTargetTypeInput}
						onOutcomeChange={logState.setOutcomeInput}
						onStartDateChange={logState.setStartDateInput}
						onEndDateChange={logState.setEndDateInput}
						onSubmit={logState.submitFilters}
						onReset={logState.resetFilters}
					/>

					{logState.isLoading ? (
						<div className="flex items-center justify-center gap-3 p-16 text-sm font-bold text-[#54655a]">
							<Loader2 className="size-5 animate-spin text-[#164027]" /> Đang tải nhật ký...
						</div>
					) : logState.logs.length === 0 ? (
						<div className="p-16 text-center">
							<FileClock className="mx-auto size-10 text-[#9aaba0]" />
							<p className="mt-3 font-bold">Không tìm thấy nhật ký phù hợp</p>
							<p className="mt-1 text-sm text-[#667a6d]">
								Hãy thay đổi bộ lọc tìm kiếm và thử lại.
							</p>
						</div>
					) : (
						<AuditLogsTable logs={logState.logs} onView={logState.viewLog} />
					)}

					<AuditLogsPagination
						pagination={logState.pagination}
						disabled={logState.isLoading}
						onPageChange={logState.setPage}
					/>
				</Card>
			</div>

			<AuditLogDetailsDialog
				open={logState.detailOpen}
				log={logState.detailLog}
				onClose={logState.closeDetail}
			/>
		</AdminLayout>
	);
}
