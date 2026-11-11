import { AlertCircle, BadgeCheck, CheckCircle, Loader2, RefreshCw } from "lucide-react";
import { Card, Pagination } from "../../../shared/components";
import { AdminLayout } from "../../admin-layout/components/AdminLayout";
import { PorterQualificationGuidance } from "../../porter-verification/components/PorterQualificationGuidance";
import { PorterVerificationDetailDialog } from "../components/PorterVerificationDetailDialog";
import { PorterVerificationsFilters } from "../components/PorterVerificationsFilters";
import { PorterVerificationsTable } from "../components/PorterVerificationsTable";
import { useAdminPorterVerifications } from "../hooks/useAdminPorterVerifications";

export interface AdminPorterVerificationsPageProps {
	onLogout?: (allDevices: boolean) => Promise<void>;
}

export function AdminPorterVerificationsPage({ onLogout }: AdminPorterVerificationsPageProps) {
	const state = useAdminPorterVerifications();

	return (
		<AdminLayout activeItem="porter-verifications" onLogout={onLogout}>
			<div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
				<div>
					<h1 className="flex items-center gap-3 text-2xl font-extrabold">
						<BadgeCheck className="size-7 text-[#164027]" /> Duyệt hồ sơ Porter
					</h1>
					<p className="mt-1 text-sm text-[#667a6d]">
						Kiểm tra chứng chỉ dẫn đường Porter đã tải lên và duyệt thủ công trước khi Porter nhận
						yêu cầu dẫn đoàn.
					</p>
				</div>

				<PorterQualificationGuidance />
				{state.errorMessage && (
					<div
						role="alert"
						className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"
					>
						<span className="flex items-center gap-2">
							<AlertCircle className="size-5" />
							{state.errorMessage}
						</span>
						<button
							type="button"
							onClick={() => void state.reload()}
							className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-3 py-2 text-xs text-white"
						>
							<RefreshCw className="size-4" /> Thử lại
						</button>
					</div>
				)}
				{state.successMessage && (
					<output className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
						<CheckCircle className="size-5" />
						{state.successMessage}
					</output>
				)}

				<Card className="overflow-hidden p-0">
					<PorterVerificationsFilters
						search={state.searchInput}
						status={state.params.status}
						disabled={state.isLoading}
						onSearchChange={state.setSearchInput}
						onStatusChange={state.setStatus}
						onSubmit={state.submitSearch}
						onReset={state.resetFilters}
					/>
					{state.isLoading ? (
						<div className="flex items-center justify-center gap-3 p-16 text-sm font-bold text-[#54655a]">
							<Loader2 className="size-5 animate-spin text-[#164027]" /> Đang tải hồ sơ Porter...
						</div>
					) : state.items.length === 0 ? (
						<div className="p-16 text-center">
							<BadgeCheck className="mx-auto size-10 text-[#9aaba0]" />
							<p className="mt-3 font-bold">Không có hồ sơ phù hợp</p>
							<p className="mt-1 text-sm text-[#667a6d]">
								Hãy đổi bộ lọc trạng thái hoặc từ khóa tìm kiếm.
							</p>
						</div>
					) : (
						<PorterVerificationsTable
							items={state.items}
							onView={(porterId) => void state.openDetail(porterId)}
						/>
					)}
					<div className="px-4 pb-4">
						<Pagination
							currentPage={state.pagination.page}
							totalPages={state.pagination.totalPages}
							totalItems={state.pagination.total}
							itemsPerPage={state.pagination.limit}
							onPageChange={state.setPage}
						/>
					</div>
				</Card>
			</div>

			<PorterVerificationDetailDialog
				open={state.isDetailOpen}
				detail={state.detail}
				isLoading={state.isDetailLoading}
				isReviewing={state.isReviewing}
				errorMessage={state.detailError}
				onClose={state.closeDetail}
				onApprove={state.approve}
				onReject={state.reject}
			/>
		</AdminLayout>
	);
}
