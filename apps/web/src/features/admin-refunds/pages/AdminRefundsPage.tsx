import { CheckCircle2, ReceiptText, Search } from "lucide-react";
import { useMemo, useState } from "react";
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
			search: searchInput.trim() || undefined,
		}),
		[page, currentStatus, searchInput]
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

	return (
		<AdminLayout activeItem="refunds" onLogout={onLogout}>
			<div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
				<div>
					<h1 className="flex items-center gap-3 text-2xl font-extrabold text-[#10221b]">
						<ReceiptText className="size-7 text-[#164027]" /> Quản lý hoàn tiền
					</h1>
					<p className="mt-1 text-sm text-[#667a6d]">
						Đối soát thông tin tài khoản ngân hàng và xác nhận chuyển tiền thủ công cho Camper.
					</p>
				</div>

				{successNotification && (
					<output className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
						<CheckCircle2 className="size-5 shrink-0" />
						{successNotification}
					</output>
				)}

				<div className="space-y-4">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="flex flex-wrap gap-1.5 rounded-xl border border-[#cbd9ce] bg-white p-1">
							{ADMIN_REFUND_STATUS_TABS.map((tab) => {
								const active = statusTab === tab.key;
								return (
									<button
										key={tab.key}
										type="button"
										onClick={() => {
											setStatusTab(tab.key);
											setPage(1);
										}}
										className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
											active
												? "bg-[#164027] text-white shadow-sm"
												: "text-[#52665b] hover:bg-[#f4f7f2]"
										}`}
									>
										{tab.label}
									</button>
								);
							})}
						</div>

						<div className="relative min-w-[240px]">
							<Search className="absolute left-3 top-2.5 size-4 text-[#667a6d]" />
							<input
								type="search"
								value={searchInput}
								onChange={(e) => {
									setSearchInput(e.target.value);
									setPage(1);
								}}
								placeholder="Tìm tên, email, mã đơn..."
								className="w-full rounded-xl border border-[#cbd9ce] bg-white py-2 pl-9 pr-3 text-xs focus:border-[#164027] focus:outline-none"
							/>
						</div>
					</div>

					{isError && (
						<div
							role="alert"
							className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900"
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

					<AdminRefundsTable
						refunds={refunds}
						isLoading={isLoading}
						onOpenConfirm={(item) => setSelectedRefundForConfirm(item)}
						onOpenReject={(item) => setSelectedRefundForReject(item)}
					/>

					{totalPages > 1 && (
						<div className="flex items-center justify-between pt-2">
							<p className="text-xs text-[#667a6d]">
								Trang {page} / {totalPages} (Tổng cộng {refundsData?.total ?? 0} yêu cầu)
							</p>
							<div className="flex gap-2">
								<button
									type="button"
									disabled={page <= 1}
									onClick={() => setPage((p) => Math.max(1, p - 1))}
									className="rounded-lg border border-[#cbd9ce] bg-white px-3 py-1.5 text-xs font-bold text-[#10221b] hover:bg-gray-50 disabled:opacity-40"
								>
									Trước
								</button>
								<button
									type="button"
									disabled={page >= totalPages}
									onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
									className="rounded-lg border border-[#cbd9ce] bg-white px-3 py-1.5 text-xs font-bold text-[#10221b] hover:bg-gray-50 disabled:opacity-40"
								>
									Sau
								</button>
							</div>
						</div>
					)}
				</div>
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
