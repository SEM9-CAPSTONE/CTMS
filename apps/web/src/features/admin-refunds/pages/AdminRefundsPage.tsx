import {
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	ReceiptText,
	RefreshCw,
	RotateCcw,
	Search,
} from "lucide-react";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Card } from "../../../shared/components";
import { AdminLayout } from "../../admin-layout/components/AdminLayout";
import type { PaymentStatus } from "../../booking-refund/types";
import { AdminRefundsTable } from "../components/AdminRefundsTable";
import { ConfirmTransferModal } from "../components/ConfirmTransferModal";
import { RejectRefundModal } from "../components/RejectRefundModal";
import { ADMIN_REFUNDS_PAGE_SIZE, ADMIN_REFUND_STATUS_TABS } from "../constants";
import { useAdminRefunds } from "../hooks/useAdminRefunds";
import type { AdminRefundFilter, AdminRefundItem } from "../types";

export interface AdminRefundsPageProps {
	onLogout?: (allDevices: boolean) => Promise<void>;
}

export function AdminRefundsPage({ onLogout }: AdminRefundsPageProps) {
	const [statusTab, setStatusTab] = useState<string>("all");
	const [searchInput, setSearchInput] = useState("");
	const [appliedSearch, setAppliedSearch] = useState("");
	const [page, setPage] = useState(1);
	const [selectedRefundForConfirm, setSelectedRefundForConfirm] = useState<AdminRefundItem | null>(
		null
	);
	const [selectedRefundForReject, setSelectedRefundForReject] = useState<AdminRefundItem | null>(
		null
	);
	const [successNotification, setSuccessNotification] = useState("");

	const currentStatus: PaymentStatus | undefined =
		statusTab === "all" ? undefined : (statusTab as PaymentStatus);

	const filter = useMemo<AdminRefundFilter>(
		() => ({
			page,
			limit: ADMIN_REFUNDS_PAGE_SIZE,
			status: currentStatus,
			search: appliedSearch.trim() || undefined,
		}),
		[page, currentStatus, appliedSearch]
	);

	const {
		refundsData,
		isLoading,
		isError,
		error,
		refetch,
		confirmTransfer,
		isConfirming,
		rejectRefund,
		isRejecting,
	} = useAdminRefunds(filter);

	const handleSearchSubmit = (e: FormEvent) => {
		e.preventDefault();
		setAppliedSearch(searchInput.trim());
		setPage(1);
	};

	const handleResetFilters = () => {
		setSearchInput("");
		setAppliedSearch("");
		setStatusTab("all");
		setPage(1);
	};

	const handleConfirm = async (obligationId: string, transactionRef: string, note?: string) => {
		await confirmTransfer({
			obligationId,
			payload: { transactionRef, note },
		});
		setSuccessNotification(
			`Đã xác nhận chuyển tiền thành công cho yêu cầu #${obligationId.slice(0, 8)}`
		);
		setTimeout(() => setSuccessNotification(""), 4000);
	};

	const handleReject = async (obligationId: string, rejectionReason: string) => {
		await rejectRefund({
			obligationId,
			payload: { rejectionReason },
		});
		setSuccessNotification(`Đã từ chối yêu cầu hoàn tiền #${obligationId.slice(0, 8)}`);
		setTimeout(() => setSuccessNotification(""), 4000);
	};

	const refunds = refundsData?.items ?? [];
	const totalPages = refundsData?.totalPages ?? 1;
	const totalItems = refundsData?.total ?? refunds.length;

	return (
		<AdminLayout activeItem="refunds" onLogout={onLogout}>
			<div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
				{/* Page Header */}
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="flex items-center gap-3 text-2xl font-extrabold text-[#10221b]">
							<ReceiptText className="size-7 text-[#164027]" /> Quản lý hoàn tiền
						</h1>
						<p className="mt-1 text-sm text-[#667a6d]">
							Đối soát thông tin tài khoản ngân hàng và xác nhận chuyển tiền thủ công cho Camper.
						</p>
					</div>

					<button
						type="button"
						onClick={() => void refetch()}
						disabled={isLoading}
						className="inline-flex items-center gap-2 rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2 text-xs font-bold text-[#55685a] shadow-xs hover:bg-[#f6f9f6] hover:text-[#164027] disabled:opacity-50"
					>
						<RefreshCw className={`size-3.5 ${isLoading ? "animate-spin text-[#164027]" : ""}`} />
						<span>Làm mới</span>
					</button>
				</div>

				{successNotification && (
					<output className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800 shadow-xs">
						<CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
						<span>{successNotification}</span>
					</output>
				)}

				{isError && (
					<div
						role="alert"
						className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-900"
					>
						<span>{error?.message || "Không thể tải danh sách yêu cầu hoàn tiền."}</span>
						<button
							type="button"
							onClick={() => void refetch()}
							className="rounded-lg bg-rose-700 px-3 py-1.5 font-bold text-white hover:bg-rose-800"
						>
							Thử lại
						</button>
					</div>
				)}

				{/* Unified Card Container */}
				<Card className="overflow-hidden p-0 border border-[#dfe8df] bg-white rounded-2xl shadow-sm">
					{/* Integrated Filter Toolbar */}
					<form
						onSubmit={handleSearchSubmit}
						className="grid gap-3 border-b border-[#e0ebe0] p-4 lg:grid-cols-[1fr_240px_auto_auto]"
					>
						<label className="flex items-center gap-2 rounded-xl border border-[#dfe8df] bg-white px-3 py-2.5">
							<Search className="size-4 text-[#788c7e]" />
							<span className="sr-only">Tìm kiếm yêu cầu hoàn tiền</span>
							<input
								value={searchInput}
								onChange={(e) => setSearchInput(e.target.value)}
								placeholder="Tên Camper, email, mã đơn..."
								className="w-full bg-transparent text-sm outline-none"
								maxLength={100}
							/>
						</label>

						<select
							aria-label="Lọc theo trạng thái"
							value={statusTab}
							onChange={(e) => {
								setStatusTab(e.target.value);
								setPage(1);
							}}
							className="rounded-xl border border-[#dfe8df] bg-white px-3 py-2.5 text-sm"
						>
							{ADMIN_REFUND_STATUS_TABS.map((option) => (
								<option key={option.key} value={option.key}>
									{option.label}
								</option>
							))}
						</select>

						<button
							type="submit"
							disabled={isLoading}
							className="rounded-xl bg-[#164027] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#11321f] transition disabled:opacity-50"
						>
							Tìm kiếm
						</button>

						<button
							type="button"
							onClick={handleResetFilters}
							disabled={isLoading}
							className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#dfe8df] px-4 py-2.5 text-sm font-bold text-[#425048] hover:bg-[#f1f5f0] transition disabled:opacity-50"
						>
							<RotateCcw className="size-4" /> Đặt lại
						</button>
					</form>

					{/* Table */}
					<AdminRefundsTable
						refunds={refunds}
						isLoading={isLoading}
						onOpenConfirm={(item) => setSelectedRefundForConfirm(item)}
						onOpenReject={(item) => setSelectedRefundForReject(item)}
					/>

					{/* Integrated Pagination Bar */}
					<div className="flex flex-col gap-3 border-t border-[#e0ebe0] px-4 py-3 text-sm text-[#54655a] sm:flex-row sm:items-center sm:justify-between bg-white">
						<p>
							Tổng cộng <strong className="text-[#10221b]">{totalItems}</strong> yêu cầu hoàn tiền
						</p>
						<div className="flex items-center gap-3">
							<button
								type="button"
								aria-label="Trang trước"
								disabled={isLoading || page <= 1}
								onClick={() => setPage(page - 1)}
								className="rounded-lg border border-[#dfe8df] p-2 hover:bg-[#f1f5f0] disabled:cursor-not-allowed disabled:opacity-40"
							>
								<ChevronLeft className="size-4" />
							</button>
							<span>
								Trang {page} / {Math.max(totalPages, 1)}
							</span>
							<button
								type="button"
								aria-label="Trang sau"
								disabled={isLoading || page >= totalPages}
								onClick={() => setPage(page + 1)}
								className="rounded-lg border border-[#dfe8df] p-2 hover:bg-[#f1f5f0] disabled:cursor-not-allowed disabled:opacity-40"
							>
								<ChevronRight className="size-4" />
							</button>
						</div>
					</div>
				</Card>
			</div>

			<ConfirmTransferModal
				refund={selectedRefundForConfirm}
				open={Boolean(selectedRefundForConfirm)}
				isSubmitting={isConfirming}
				onClose={() => setSelectedRefundForConfirm(null)}
				onConfirm={handleConfirm}
			/>

			<RejectRefundModal
				refund={selectedRefundForReject}
				open={Boolean(selectedRefundForReject)}
				isSubmitting={isRejecting}
				onClose={() => setSelectedRefundForReject(null)}
				onReject={handleReject}
			/>
		</AdminLayout>
	);
}
