import { AlertCircle, Loader2, RefreshCw, Users } from "lucide-react";
import { Card } from "../../../shared/components";
import { AdminLayout } from "../../admin-layout/components/AdminLayout";
import { AccountStatusDialog } from "../components/AccountStatusDialog";
import { UserAccountDetailsDialog } from "../components/UserAccountDetailsDialog";
import { UserAccountsFilters } from "../components/UserAccountsFilters";
import { UserAccountsPagination } from "../components/UserAccountsPagination";
import { UserAccountsTable } from "../components/UserAccountsTable";
import { useAdminUserAccounts } from "../hooks/useAdminUserAccounts";

export interface AdminUserAccountsPageProps {
	onLogout?: (allDevices: boolean) => Promise<void>;
}

export function AdminUserAccountsPage({ onLogout }: AdminUserAccountsPageProps) {
	const accounts = useAdminUserAccounts();
	return (
		<AdminLayout activeItem="user-accounts" onLogout={onLogout}>
			<div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
				<div>
					<h1 className="flex items-center gap-3 text-2xl font-extrabold">
						<Users className="size-7 text-[#164027]" /> Tài khoản người dùng
					</h1>
					<p className="mt-1 text-sm text-[#667a6d]">
						Tìm kiếm, xem, khóa và mở khóa tài khoản mà không xóa dữ liệu nghiệp vụ.
					</p>
				</div>

				{accounts.errorMessage && (
					<div
						role="alert"
						className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"
					>
						<span className="flex items-center gap-2">
							<AlertCircle className="size-5" />
							{accounts.errorMessage}
						</span>
						<button
							type="button"
							onClick={() => void accounts.reload()}
							className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-3 py-2 text-xs text-white"
						>
							<RefreshCw className="size-4" /> Thử lại
						</button>
					</div>
				)}
				<Card className="overflow-hidden p-0">
					<UserAccountsFilters
						search={accounts.searchInput}
						role={accounts.params.role}
						status={accounts.params.status}
						disabled={accounts.isLoading}
						onSearchChange={accounts.setSearchInput}
						onRoleChange={accounts.setRole}
						onStatusChange={accounts.setStatus}
						onSubmit={accounts.submitSearch}
						onReset={accounts.resetFilters}
					/>
					{accounts.isLoading ? (
						<div className="flex items-center justify-center gap-3 p-16 text-sm font-bold text-[#54655a]">
							<Loader2 className="size-5 animate-spin text-[#164027]" /> Đang tải danh sách tài
							khoản...
						</div>
					) : accounts.users.length === 0 ? (
						<div className="p-16 text-center">
							<Users className="mx-auto size-10 text-[#9aaba0]" />
							<p className="mt-3 font-bold">Không tìm thấy tài khoản phù hợp</p>
							<p className="mt-1 text-sm text-[#667a6d]">
								Hãy thay đổi từ khóa hoặc bộ lọc và thử lại.
							</p>
						</div>
					) : (
						<UserAccountsTable
							users={accounts.users}
							currentUserId={accounts.currentUserId}
							onView={(user) => void accounts.viewUser(user)}
							onAction={accounts.openAction}
						/>
					)}
					<UserAccountsPagination
						pagination={accounts.pagination}
						disabled={accounts.isLoading}
						onPageChange={accounts.setPage}
					/>
				</Card>
			</div>
			<UserAccountDetailsDialog
				open={accounts.detailOpen}
				user={accounts.detailUser}
				isLoading={accounts.isDetailLoading}
				onClose={accounts.closeDetail}
			/>
			<AccountStatusDialog
				open={Boolean(accounts.pendingAction)}
				action={accounts.pendingAction?.action ?? "lock"}
				user={accounts.pendingAction?.user ?? null}
				isSubmitting={accounts.isSubmitting}
				errorMessage={accounts.actionError}
				onClose={accounts.closeAction}
				onConfirm={accounts.confirmAction}
			/>
		</AdminLayout>
	);
}
